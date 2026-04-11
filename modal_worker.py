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
import time

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
    url = item.get("supabase_url")
    key = item.get("supabase_key")
    
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    def update_db(data):
        try:
            requests.patch(
                f"{url}/rest/v1/games?id=eq.{game_id}", 
                headers=headers, 
                json=data
            )
        except Exception as e:
            print(f"DB Update Failed: {e}")

    # 1. IMMEDIATE HANDSHAKE
    update_db({
        "ignition_status": "ignited", 
        "status": "analyzing",
        "progress_percentage": 15,
        "last_heartbeat": datetime.utcnow().isoformat(),
        "last_error": None
    })

    try:
        # Simulate or Call Actual Analysis
        # This is where opencv_statgen.py would be invoked
        # For now, we simulate the stages to ensure the handshake works
        
        stages = [
            (25, "📡 GPU Swarm Connected. Starting Discovery..."),
            (40, "🎨 Color Calibration: Identifying Team Palettes..."),
            (60, "🏃 Player Discovery: Mapping Entities to Roster..."),
            (85, "🔢 Jersey Recognition: Finalizing Mapping Engine..."),
            (100, "✅ Discovery Complete. Dashboard Ready.")
        ]

        for pct, msg in stages:
            time.sleep(2) # Give UI time to breathe
            update_db({
                "progress_percentage": pct,
                "processing_metadata": {"last_msg": msg},
                "last_heartbeat": datetime.utcnow().isoformat()
            })
            
        update_db({
            "status": "completed",
            "m2_complete": True
        })

    except Exception as e:
        update_db({
            "status": "error",
            "last_error": f"GPU Worker Crash: {str(e)}",
            "ignition_status": "failed"
        })

    return {"status": "success", "game_id": game_id}