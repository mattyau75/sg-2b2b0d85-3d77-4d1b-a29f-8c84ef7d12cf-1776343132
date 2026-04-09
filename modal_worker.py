#!/usr/bin/env python3
"""
DribbleAI Stats — Modal GPU Worker (Modal 1.x API)
====================================================
Deploys opencv_statgen.py to a T4 GPU container on Modal and exposes it as a
streaming HTTP endpoint that emits the same JSON-line protocol the local
subprocess uses (__progress / __result / __error).

Quick-start
-----------
1.  pip install modal
2.  modal token set --token-id <id> --token-secret <secret>
3.  (OPTIONAL) Export YouTube cookies and create a Modal secret:
    modal secret create youtube-cookies YOUTUBE_COOKIES="$(cat cookies.txt)"
4.  modal deploy modal_worker.py
5.  Copy the printed endpoint URL to your Next.js environment variables.

GPU options (change gpu= below)
--------------------------------
  "T4"   — ~$0.59/hr  — ~0.8 s/frame yolo11m  → 129 frames ≈  2 min
  "A10G" — ~$1.10/hr  — ~0.4 s/frame yolo11m  → 129 frames ≈  1 min
  "A100" — ~$3.70/hr  — ~0.2 s/frame yolo11m  → 129 frames ≈ 30 sec

YouTube Cookie Authentication
------------------------------
To bypass YouTube's bot detection, you have two options:

Option 1 - Use Modal Secret (Recommended):
  1. Export cookies from your browser using "Get cookies.txt LOCALLY" extension
  2. Create Modal secret: modal secret create youtube-cookies YOUTUBE_COOKIES="$(cat cookies.txt)"
  3. The worker will automatically use these cookies

Option 2 - Use Browser Cookie Extraction:
  1. Uncomment the Chrome/Firefox installation in the image setup below
  2. Uncomment the cookiesfrombrowser line in the subprocess args
  3. Note: This adds ~500MB to the container and increases cold start time
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
import math
import cv2
import numpy as np
import torch
from typing import List, Dict, Any
import time
from typing import Generator
import boto3
from botocore.config import Config

import modal

# Define persistent storage for models to avoid Roboflow/Ultralytics download glitches
models_volume = modal.Volume.from_name("courtvision-models", create_if_missing=True)

# ── App ────────────────────────────────────────────────────────────────────────

app = modal.App("courtvision-elite-worker")

# ── Container image ────────────────────────────────────────────────────────────
# In Modal 1.x, local files are bundled into the image via .add_local_file()
# rather than the removed modal.Mount API.

_SCRIPT_PATH = str(Path(__file__).parent / "opencv_statgen.py")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install([
        "libgl1",
        "libglib2.0-0",
        "libsm6",
        "libxext6",
        "libxrender-dev",
        "tesseract-ocr",
        "tesseract-ocr-eng",
        "ffmpeg",
        # OPTIONAL: Uncomment to enable browser cookie extraction (adds ~500MB to image)
        # "chromium",
        # "chromium-driver",
    ])
    .pip_install([
        "ultralytics>=8.3",
        "opencv-python-headless>=4.9",
        "pytesseract>=0.3.10",
        "numpy>=1.26",
        "yt-dlp>=2024.4",
        "requests",
        "fastapi[standard]",
    ])
    .add_local_file(_SCRIPT_PATH, remote_path="/app/opencv_statgen.py")
)

# Define the high-performance GPU image
cuda_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "ultralytics",
        "opencv-python-headless",
        "numpy",
        "requests",
        "supabase",
        "boto3"
    )
    .run_commands(
        # Pre-download the model into the image or volume path
        "mkdir -p /models",
        "curl -L https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11m.pt -o /models/yolo11m.pt"
    )
)

# ── Persistent volume — caches YOLO weight files across cold starts ─────────────
# On first invocation ultralytics auto-downloads yolo11m.pt / yolo11n.pt /
# yolo11n-pose.pt from GitHub releases into this volume.  Subsequent cold starts
# skip the download entirely.

weights_volume = modal.Volume.from_name("dribbleai-yolo-weights", create_if_missing=True)
WEIGHTS_DIR = "/cache/yolo"


# ── Combined GPU web endpoint ──────────────────────────────────────────────────
# Runs entirely inside the GPU container (no cross-function generator hop).
# Modal 1.x supports combining @modal.web_endpoint with gpu= on the same
# function — the HTTP handler itself executes on the GPU machine and streams
# the subprocess stdout back to the caller.

@app.function(image=image, volumes={WEIGHTS_DIR: weights_volume}, timeout=600)
def split_video(video_url: str, chunk_duration: int = 300):
    """
    Splits video into 5-minute segments for parallel processing.
    """
    import subprocess
    import tempfile
    
    # Probe duration
    probe_cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", video_url]
    duration = float(subprocess.check_output(probe_cmd).decode().strip())
    
    num_chunks = math.ceil(duration / chunk_duration)
    chunks = []
    
    for i in range(num_chunks):
        chunks.append({
            "url": video_url,
            "start": i * chunk_duration,
            "duration": chunk_duration,
            "chunk_id": i
        })
    return chunks

# Use a global variable to cache the model in VRAM across function calls
_cached_model = None

def get_model():
    global _cached_model
    if _cached_model is None:
        from ultralytics import YOLO
        model_path = "/models/yolo11m.pt"
        _cached_model = YOLO(model_path)
        print("🔥 Model loaded into VRAM and cached.")
    return _cached_model

@app.function(
    gpu="A10G",
    image=image,
    volumes={WEIGHTS_DIR: weights_volume},
    timeout=1800,
)
def process_chunk(chunk_data: dict, config: dict):
    """
    Processes a single 5-minute segment on a dedicated GPU.
    """
    import subprocess
    import sys
    import json
    
    cmd = [
        sys.executable, "/app/opencv_statgen.py",
        "--url", chunk_data["url"],
        "--offset-seconds", str(chunk_data["start"]),
        "--chunk-id", str(chunk_data["chunk_id"]),
        "--home", config["home_team"],
        "--away", config["away_team"],
        "--home-roster", json.dumps(config.get("home_roster", [])),
        "--away-roster", json.dumps(config.get("away_roster", []))
    ]
    
    # Run and capture final __result JSON line
    result = subprocess.check_output(cmd).decode().splitlines()
    for line in result:
        if "__result" in line:
            return json.loads(line)["__result"]
    return {}

@app.function(image=image, timeout=3600)
@modal.fastapi_endpoint(method="POST")
def analyze(item: dict):
    from fastapi.responses import StreamingResponse
    
    def orchestrate():
        yield json.dumps({"__progress": 10, "__msg": "Probing video structure..."}) + "\n"
        chunks = split_video.remote(item["video_url"])
        
        yield json.dumps({"__progress": 20, "__msg": f"Launching GPU Swarm ({len(chunks)} nodes)..."}) + "\n"
        
        # Parallel Execution
        results = list(process_chunk.map(chunks, kwargs={"config": item}, order_outputs=True))
        
        yield json.dumps({"__progress": 90, "__msg": "Merging parallel results..."}) + "\n"
        
        # Merge results logic...
        final_result = {
            "game_metadata": results[0].get("game_metadata", {}),
            "play_by_play": [item for r in results for item in r.get("play_by_play", [])],
            "shot_chart": [item for r in results for item in r.get("shot_chart", [])],
            "box_score": {} # Aggregation logic
        }
        
        yield json.dumps({"__result": final_result}) + "\n"

    return StreamingResponse(orchestrate(), media_type="text/plain")

class PlayerTracker:
    """ByteTrack-inspired tracker to maintain ID consistency during pans."""
    def __init__(self, det_thresh=0.4, track_thresh=0.3, match_thresh=0.7, frame_rate=30):
        self.det_thresh = det_thresh
        self.track_thresh = track_thresh
        self.match_thresh = match_thresh
        self.frame_rate = frame_rate
        self.tracks = {} # ID -> {bbox, color, last_frame, velocity}
        self.next_id = 0

    def update(self, detections, frame_id):
        """Update tracks with new detections."""
        # 1. Prediction (Kalman-lite)
        for tid in list(self.tracks.keys()):
            track = self.tracks[tid]
            # Simple linear prediction for motion during pans
            if 'velocity' in track:
                track['bbox'][0] += track['velocity'][0]
                track['bbox'][1] += track['velocity'][1]
            
            # Remove stale tracks
            if frame_id - track['last_frame'] > self.frame_rate * 2: # 2 seconds
                del self.tracks[tid]

        # 2. Matching (IOU + Color)
        # Simplified for worker integration:
        # Match detections to tracks based on IOU and color consistency
        ... 
        return matched_detections

# Self-provisioning volume logic
volume = modal.Volume.from_name("courtvision-models", create_if_missing=True)

@app.function(
    image=cuda_image,
    gpu="A100",
    volumes={"/models": volume},
    secret=modal.Secret.from_name("courtvision-r2-keys"), # Ensure keys are in secrets
    timeout=3600
)
def run_analysis(video_url: str, config: dict):
    from ultralytics import YOLO
    
    # 1. Self-provision weights if missing from the volume
    weights_path = "/models/yolo11m.pt"
    if not os.path.exists(weights_path):
        print("📦 First run: Downloading YOLOv11m weights to persistent volume...")
        model = YOLO("yolo11m.pt")
        model.save(weights_path)
        # Commit ensures the weights are saved for ALL future GPU runs
        volume.commit()
    else:
        model = YOLO(weights_path)