import json
import os
import subprocess
import sys
import math
import requests
from pathlib import Path
import modal
from ultralytics import YOLO

# ── App Definition ────────────────────────────────────────────────────────────
app = modal.App("courtvision-elite-worker")

# ── Container Image ───────────────────────────────────────────────────────────
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
        "ffmpeg",
    ])
    .pip_install([
        "ultralytics>=8.3",
        "opencv-python-headless>=4.9",
        "numpy>=1.26",
        "yt-dlp>=2024.4",
        "requests",
    ])
    .add_local_file(_SCRIPT_PATH, remote_path="/app/opencv_statgen.py")
)

# ── Persistent Storage ───────────────────────────────────────────────────────
weights_volume = modal.Volume.from_name("dribbleai-yolo-weights", create_if_missing=True)
WEIGHTS_DIR = "/cache/yolo"

# ── GPU Processing Logic ──────────────────────────────────────────────────────

# Model Configuration
MODEL_VARIANT = "yolo11m.pt"
CONFIDENCE_THRESHOLD = 0.25
IOU_THRESHOLD = 0.45

@app.function(image=image, volumes={WEIGHTS_DIR: weights_volume}, timeout=1800, gpu="A10G")
def process_chunk(chunk_data: dict, config: dict):
    """Processes a video segment with full roster awareness."""
    import subprocess
    import sys
    import json
    
    # Map API keys to script arguments
    cmd = [
        sys.executable, "/app/opencv_statgen.py",
        "--url", chunk_data["url"],
        "--offset-seconds", str(chunk_data["start"]),
        "--home", config.get("home_team", "Home"),
        "--away", config.get("away_team", "Away"),
        "--home-roster", json.dumps(config.get("home_roster", [])),
        "--away-roster", json.dumps(config.get("away_roster", []))
    ]
    
    print(f"🚀 Launching Chunk Process for {chunk_data['start']}s offset")
    
    try:
        result = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode().splitlines()
        for line in result:
            if "__result" in line:
                return json.loads(line)["__result"]
    except subprocess.CalledProcessError as e:
        print(f"❌ Chunk processing failed: {e.output.decode()}")
        return {"error": e.output.decode()}
    return {}

@app.function(image=image, timeout=600)
def split_video(video_url: str, chunk_duration: int = 300):
    """Splits video metadata into chunks for parallel swarm processing."""
    import subprocess
    
    probe_cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", video_url]
    try:
        duration = float(subprocess.check_output(probe_cmd).decode().strip())
    except:
        duration = 600 # Fallback for probe failures
        
    num_chunks = math.ceil(duration / chunk_duration)
    return [{"url": video_url, "start": i * chunk_duration, "chunk_id": i} for i in range(num_chunks)]

@app.function(image=image, timeout=3600)
@modal.web_endpoint(method="POST")
def analyze(item: dict):
    """Main entry point for Next.js API calls."""
    from fastapi.responses import StreamingResponse
    import json

    def orchestrate():
        yield json.dumps({"__progress": 10, "__msg": "📡 Handshaking with R2 Storage..."}) + "\n"
        
        chunks = split_video.remote(item["video_url"])
        yield json.dumps({"__progress": 25, "__msg": f"🔥 Igniting GPU Swarm ({len(chunks)} nodes active)..."}) + "\n"
        
        # Parallel Execution across multiple GPUs
        results = list(process_chunk.map(chunks, kwargs={"config": item}, order_outputs=True))
        
        yield json.dumps({"__progress": 90, "__msg": "📊 Aggregating multi-node intelligence..."}) + "\n"
        
        # Merge logic (simplified)
        final_result = {
            "game_id": item.get("game_id"),
            "play_by_play": [p for r in results if "play_by_play" in r for p in r["play_by_play"]],
            "stats": {} # Total aggregation
        }
        
        yield json.dumps({"__result": final_result}) + "\n"

    return StreamingResponse(orchestrate(), media_type="text/plain")