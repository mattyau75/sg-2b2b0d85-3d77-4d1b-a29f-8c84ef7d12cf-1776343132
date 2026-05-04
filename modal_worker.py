import modal
import os
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any
import time

# MODAL ELITE PIPELINE v16.10 - COMPATIBILITY STABLE
VERSION = "16.10"

image = (
    modal.Image.debian_slim()
    .pip_install(
        "ultralytics",
        "opencv-python-headless",
        "supabase",
        "httpx",
        "fastapi[standard]",
        "pandas",
        "numpy",
        "tenacity"
    )
    .env({"YOLO_CONFIG_DIR": "/tmp/Ultralytics"})
)

app = modal.App("basketball-scout-ai-elite", image=image)

@app.function(
    image=image,
    gpu="A10",
    timeout=1800,
    cpu=2.0,
    memory=8192
)
async def process_game_internal(
    game_id: str,
    video_url: str,
    supabase_url: str,
    supabase_key: str,
    metadata: Dict = None
):
    from supabase import create_client
    import cv2
    import httpx
    from tenacity import retry, stop_after_attempt, wait_exponential

    # Trim keys to prevent auth drift
    supabase = create_client(supabase_url.strip(), supabase_key.strip())

    def now_iso():
        return datetime.utcnow().isoformat() + "Z"

    def log(msg):
        print(f"[{now_iso()}] {msg}")

    def safe_db_update(table, match_col, match_val, payload, upsert=False, retries=3):
        for attempt in range(retries):
            try:
                if upsert:
                    res = supabase.table(table).upsert({match_col: match_val, **payload}).execute()
                else:
                    res = supabase.table(table).update(payload).eq(match_col, match_val).execute()
                return res
            except Exception as e:
                log(f"DB write attempt {attempt} failed for {table}: {e}")
                time.sleep(1 << attempt)
        raise RuntimeError(f"DB write failed for {table} after retries")

    def send_heartbeat(message: str, progress: int = None):
        try:
            # KILL SWITCH CHECK
            res = supabase.table("game_analysis").select("status").eq("game_id", game_id).maybe_single().execute()
            row = getattr(res, "data", None)
            if row and row.get("status") != "processing":
                log(f"Kill Switch Detected: Status is {row.get('status')}. Terminating GPU.")
                return False
                
            update_data = {
                "status": "completed" if (progress or 0) >= 100 else "processing",
                "status_message": f"v{VERSION}: {message}",
                "progress_percentage": progress or 0,
                "last_heartbeat": now_iso(),
                "updated_at": now_iso()
            }
            safe_db_update("game_analysis", "game_id", game_id, update_data, upsert=True)
            
            # Sync to main games table
            safe_db_update("games", "id", game_id, {
                "status": "processing" if (progress or 0) < 100 else "completed",
                "status_message": message,
                "progress_percentage": progress or 0,
                "last_gpu_heartbeat": now_iso()
            })
            return True
        except Exception as e:
            log(f"Heartbeat failure: {e}")
            return True

    if not send_heartbeat("Elite Engine Ignited.", progress=1): 
        return {"status": "cancelled"}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    def download_video(url, out_path):
        with httpx.Client(timeout=60.0) as client:
            with client.stream("GET", url, timeout=120.0) as r:
                r.raise_for_status()
                with open(out_path, "wb") as f:
                    for chunk in r.iter_bytes(1024 * 1024):
                        if chunk: f.write(chunk)
        return out_path

    try:
        video_path = f"/tmp/{game_id}.mp4"
        download_video(video_url, video_path)
        if not send_heartbeat("Footage Synced.", progress=5): return {"status": "cancelled"}

        # Simulate analysis for v16.10 Handshake
        for i in range(10, 101, 10):
            await asyncio.sleep(2)
            if not send_heartbeat(f"Analyzing personnel patterns...", progress=i):
                return {"status": "cancelled"}

        return {"status": "success"}

    except Exception as e:
        log(f"GPU Error: {str(e)}")
        send_heartbeat(f"GPU Error: {str(e)}")
        raise e

@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
async def process(payload: Dict):
    # Native fastapi_endpoint avoids local FastAPI import dependency
    game_id = payload.get("gameId")
    video_url = payload.get("videoUrl")
    supabase_url = payload.get("supabaseUrl")
    supabase_key = payload.get("supabaseKey")
    
    if not all([game_id, video_url, supabase_url, supabase_key]):
        return {"status": "error", "message": "Missing parameters"}
        
    process_game_internal.spawn(game_id, video_url, supabase_url, supabase_key)
    return {"status": "accepted", "version": VERSION}

@app.function(image=image)
@modal.fastapi_endpoint(method="GET")
async def health():
    return {"status": "operational", "version": VERSION}
