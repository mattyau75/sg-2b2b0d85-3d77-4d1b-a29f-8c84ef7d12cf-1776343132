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

def update_supabase_progress(game_id, progress, status=None, credentials=None, log_msg=None, log_level="info"):
    """Callback to update Next.js dashboard via Supabase REST."""
    supabase_url = credentials.get("url") if credentials else os.environ.get("SUPABASE_URL")
    supabase_key = credentials.get("key") if credentials else os.environ.get("SUPABASE_ANON_KEY")
    
    if not (supabase_url and supabase_key and game_id):
        print(f"⚠️ Skipping progress sync: Missing config for game {game_id}")
        return
    
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    # 1. First fetch current metadata to preserve logs
    try:
        current_resp = requests.get(f"{supabase_url}/rest/v1/games?id=eq.{game_id}&select=processing_metadata", headers=headers)
        current_data = current_resp.json()
        metadata = current_data[0].get("processing_metadata") if current_data else {}
    except:
        metadata = {}

    if metadata is None: metadata = {}
    logs = metadata.get("worker_logs", [])
    
    if log_msg:
        import datetime
        logs.append({
            "timestamp": datetime.datetime.now().isoformat(),
            "level": log_level,
            "message": log_msg
        })
        # Keep only last 50 logs to prevent payload bloat
        logs = logs[-50:]

    payload = {
        "progress_percentage": progress,
        "processing_metadata": {**metadata, "worker_logs": logs}
    }
    if status:
        payload["status"] = status
        
    try:
        response = requests.patch(f"{supabase_url}/rest/v1/games?id=eq.{game_id}", headers=headers, json=payload)
        response.raise_for_status()
    except Exception as e:
        print(f"Failed to sync progress to DB: {e}")

@app.function(image=image, timeout=3600)
@modal.web_endpoint(method="POST")
def analyze(item: dict):
    """Main entry point for Next.js API calls."""
    from fastapi.responses import StreamingResponse
    import json
    
    game_id = item.get("game_id")
    # Ensure we use the correct keys from config
    creds = {
        "url": item.get("supabase_url"),
        "key": item.get("supabase_key")
    }

    # CRITICAL: Immediate check-in before the streaming loop
    update_supabase_progress(game_id, 20, "analyzing", credentials=creds, log_msg="GPU Swarm Node Allocated. Initializing DribbleStats AI Elite environment.")

    def orchestrate():
        yield json.dumps({"__progress": 20, "__msg": "📡 GPU Node Online. Downloading video..."}) + "\n"
        
        try:
            # Video split phase
            chunks = split_video.remote(item["video_url"])
            update_supabase_progress(game_id, 25, credentials=creds, log_msg=f"Video partition complete. Igniting {len(chunks)} GPU sub-nodes.")
            yield json.dumps({"__progress": 25, "__msg": f"🔥 Igniting GPU Swarm ({len(chunks)} nodes active)..."}) + "\n"
            
            # Parallel Execution across multiple GPUs
            # We can update progress as chunks complete
            results = []
            for i, result in enumerate(process_chunk.map(chunks, kwargs={"config": item}, order_outputs=True)):
                results.append(result)
                progress = 25 + int((i + 1) / len(chunks) * 60)
                update_supabase_progress(game_id, progress, credentials=creds, log_msg=f"Node {i+1} completed chunk analysis. Recognition vectors stabilized.")
                yield json.dumps({"__progress": progress, "__msg": f"Analyzing chunk {i+1}/{len(chunks)}..."}) + "\n"
            
            update_supabase_progress(game_id, 95, "finalizing", credentials=creds)
            yield json.dumps({"__progress": 95, "__msg": "📊 Aggregating multi-node intelligence..."}) + "\n"
            
            # Merge logic (simplified)
            final_result = {
                "game_id": game_id,
                "play_by_play": [p for r in results if "play_by_play" in r for p in r["play_by_play"]],
                "stats": {} # Total aggregation
            }
            
            update_supabase_progress(game_id, 100, "completed", credentials=creds, log_msg="AI Engine stabilization complete. Identity mapping finalized.")
            yield json.dumps({"__result": final_result}) + "\n"
        except Exception as e:
            update_supabase_progress(game_id, 100, "error", credentials=creds, log_msg=f"CRITICAL ENGINE FAILURE: {str(e)}", log_level="error")
            yield json.dumps({"__error": str(e)}) + "\n"

    return StreamingResponse(orchestrate(), media_type="text/plain")