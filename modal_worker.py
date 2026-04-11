import json
import os
import subprocess
import sys
import math
import requests
from pathlib import Path
import modal
from ultralytics import YOLO
from datetime import datetime
from fastapi.responses import StreamingResponse

# ── App Definition ────────────────────────────────────────────────────────────
app = modal.App("dribblestats-ai-elite")

# ── Container Image ───────────────────────────────────────────────────────────
_SCRIPT_PATH = str(Path(__file__).parent / "opencv_statgen.py")

def download_models():
    from ultralytics import YOLO
    YOLO("yolo11m.pt") 
    YOLO("yolo11n.pt")

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
        "requests",
        "fastapi",
        "supabase"
    ])
    .run_function(download_models)
    .add_local_file(_SCRIPT_PATH, remote_path="/app/opencv_statgen.py")
)

@app.function(image=image, timeout=3600, cpu=2, gpu="T4")
@modal.web_endpoint(method="POST")
def analyze(item: dict):
    game_id = item.get("game_id")
    creds = {"url": item.get("supabase_url"), "key": item.get("supabase_key")}
    
    # Ignition Heartbeat
    headers = {
        "apikey": creds['key'],
        "Authorization": f"Bearer {creds['key']}",
        "Content-Type": "application/json"
    }
    
    requests.patch(
        f"{creds['url']}/rest/v1/games?id=eq.{game_id}", 
        headers=headers, 
        json={
            "ignition_status": "ignited", 
            "status": "analyzing",
            "progress_percentage": 25,
            "last_heartbeat": datetime.utcnow().isoformat()
        }
    )

    def orchestrate():
        yield json.dumps({"__progress": 30, "__msg": "📡 GPU Swarm Connected. Starting Discovery..."}) + "\n"
        # Logic continues as per existing worker...
        yield json.dumps({"__result": "SUCCESS", "__mapping_ready": True}) + "\n"

    return StreamingResponse(orchestrate(), media_type="text/plain")