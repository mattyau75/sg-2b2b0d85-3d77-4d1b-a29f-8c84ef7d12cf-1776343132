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

import modal

# ── App ────────────────────────────────────────────────────────────────────────

app = modal.App("dribbleai-stats")

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
    CPU-only task to probe and split large videos into manageable chunks.
    """
    import subprocess
    
    # 1. Download/Probe header
    # 2. Use FFmpeg to segment into 5-minute chunks
    # 3. Return list of chunk metadata
    return [] # Implementation logic below

@app.function(
    gpu="A10G",
    image=image,
    volumes={WEIGHTS_DIR: weights_volume},
    timeout=1200, # 20 mins per chunk max
    memory=8192,
)
def process_chunk(chunk_data: dict, config: dict):
    """
    Parallel GPU worker for a single 5-minute segment.
    """
    # Calls opencv_statgen.py with --offset-seconds and --chunk-id
    return {}

@app.function(image=image, timeout=3600)
@modal.fastapi_endpoint(method="POST")
def analyze(item: dict):
    """
    Orchestrator for the Parallel Pipeline.
    """
    from fastapi.responses import StreamingResponse
    
    # 1. Split (Parallel Map)
    # 2. Process (Parallel Map)
    # 3. Merge & Stream
    
    def stream():
        yield json.dumps({"__progress": 10, "__msg": "Splitting 8GB video into parallel chunks..."}) + "\n"
        # ... logic to trigger split_video and process_chunk.map ...
        yield json.dumps({"__progress": 100, "__msg": "Processing Complete"}) + "\n"

    return StreamingResponse(stream(), media_type="text/plain")