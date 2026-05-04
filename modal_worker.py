import modal
import os
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any
from functools import partial
import time

# MODAL ELITE PIPELINE v16.7 - PRODUCTION STABLE
VERSION = "16.7"

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
    from ultralytics import YOLO
    import httpx
    from tenacity import retry, stop_after_attempt, wait_exponential

    supabase = create_client(supabase_url, supabase_key)

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
            # KILL SWITCH CHECK: Read status row defensively
            res = supabase.table("game_analysis").select("status").eq("game_id", game_id).maybe_single().execute()
            row = getattr(res, "data", None)
            if row and row.get("status") != "processing":
                log(f"Kill Switch Detected: Status is {row.get('status')}. Terminating GPU.")
                return False
                
            update_data = {
                "status": "completed" if progress == 100 else "processing",
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

    async def is_cancelled():
        try:
            res = supabase.table("game_analysis").select("status").eq("game_id", game_id).maybe_single().execute()
            row = getattr(res, "data", None)
            if not row: return True
            return row.get("status") != "processing"
        except Exception:
            return True

    if not send_heartbeat("Elite Engine Ignited.", progress=1): return {"status": "cancelled"}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    def download_video(url, out_path):
        with httpx.Client(timeout=60.0) as client:
            with client.stream("GET", url, timeout=120.0) as r:
                r.raise_for_status()
                with open(out_path, "wb") as f:
                    for chunk in r.iter_bytes(1024 * 1024):
                        if chunk: f.write(chunk)
        if not os.path.exists(out_path) or os.path.getsize(out_path) < 1024:
            raise RuntimeError("Downloaded file invalid or empty")
        return out_path

    try:
        video_path = f"/tmp/{game_id}.mp4"
        download_video(video_url, video_path)
        if not send_heartbeat("Footage Synced.", progress=5): return {"status": "cancelled"}

        # Initialize model
        model = await asyncio.to_thread(YOLO, "yolo11m.pt")

        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 25.0)

        frame_idx = 0
        BATCH_SIZE = 8
        read_batch = []

        def process_batch(frames, start_idx):
            results = model(frames, conf=0.25, device=0, verbose=False)
            batch_data = []
            for i, r in enumerate(results):
                f_idx = start_idx + i
                detections = []
                for det in r.boxes:
                    detections.append({
                        "xyxy": det.xyxy.cpu().numpy().tolist()[0],
                        "conf": float(det.conf.cpu().numpy()[0]),
                        "cls": int(det.cls.cpu().numpy()[0])
                    })
                batch_data.append((f_idx, detections))
            return batch_data

        while True:
            if await is_cancelled():
                cap.release()
                return {"status": "cancelled"}

            ret, frame = cap.read()
            if not ret: break
            
            read_batch.append(frame)
            frame_idx += 1

            if len(read_batch) >= BATCH_SIZE or frame_idx == total_frames:
                start_idx = frame_idx - len(read_batch)
                batch_results = await asyncio.to_thread(process_batch, read_batch, start_idx)
                
                # Bulk insert raw events
                payload = []
                for f_idx, detections in batch_results:
                    ts_ms = int((f_idx / fps) * 1000)
                    payload.append({
                        "game_id": game_id,
                        "frame_number": f_idx,
                        "timestamp_ms": ts_ms,
                        "event_type": "tracking",
                        "ai_track_id": "0", # Placeholder
                        "metadata": {"detections": detections},
                        "created_at": now_iso()
                    })
                
                if payload:
                    try:
                        supabase.table("raw_events").insert(payload).execute()
                    except Exception as e:
                        log(f"Batch insert failure: {e}")

                read_batch = []
                progress = min(10 + int((frame_idx / total_frames) * 85), 99)
                if frame_idx % 200 == 0:
                    if not send_heartbeat(f"Processing frames ({frame_idx}/{total_frames})", progress=progress):
                        cap.release()
                        return {"status": "cancelled"}

        cap.release()
        send_heartbeat("Elite Scouting Complete.", progress=100)
        return {"status": "success"}

    except Exception as e:
        send_heartbeat(f"GPU Error: {str(e)}")
        raise e

@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
async def process(payload: Dict):
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
