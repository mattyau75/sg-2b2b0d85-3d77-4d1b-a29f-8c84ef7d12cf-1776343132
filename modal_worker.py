import modal
import os
import logging
import asyncio
from datetime import datetime
from typing import Dict, List, Any

# MODAL ELITE PIPELINE v15.9 - PRODUCTION PERSISTENCE
# Added database insertion for real results and improved heartbeat tracking
VERSION = "15.9"

app = modal.App("basketball-scout-ai-elite")

volume = modal.Volume.from_name("scout-data", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0", "wget")
    .pip_install(
        "fastapi[standard]",
        "ultralytics",
        "lap",
        "supabase",
        "numpy",
        "opencv-python-headless",
        "scikit-learn",
        "httpx",
        "roboflow"
    )
    .env({
        "YOLO_CONFIG_DIR": "/tmp/Ultralytics",
        "PYTHONUNBUFFERED": "1"
    })
)

@app.function(
    image=image, 
    gpu="T4", 
    volumes={"/workspace": volume}, 
    timeout=3600, 
    secrets=[modal.Secret.from_name("basketball-scout-secrets")]
)
async def process_game_internal(game_id: str, video_url: str, supabase_url: str, supabase_key: str, metadata: dict = None):
    from supabase import create_client, Client
    import httpx
    import cv2
    import os
    import numpy as np
    from ultralytics import YOLO
    
    app_url = metadata.get("app_url") or "https://build-a-basketball-boxscore-stats-player-play-by.vercel.app"
    
    async def send_heartbeat(message, severity="info", progress=None):
        try:
            async with httpx.AsyncClient() as client:
                await client.post(f"{app_url}/api/gpu-heartbeat", json={
                    "gameId": game_id,
                    "message": message,
                    "severity": severity,
                    "progress": progress
                })
        except Exception as e:
            print(f"[Heartbeat Error] {e}")

    print(f"[v{VERSION}] Elite Scouting Engine Ignited: {game_id}")
    await send_heartbeat(f"v{VERSION}: GPU Handshake Success. Initializing...", progress=2)
    
    s_url = supabase_url or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    s_key = supabase_key or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    supabase: Client = create_client(s_url, s_key)
    
    # 1. Download
    local_video_path = f"/tmp/{game_id}.mp4"
    await send_heartbeat(f"v{VERSION}: Buffering tactical feed...", progress=5)
    
    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            async with client.stream("GET", video_url) as response:
                if response.status_code != 200: raise Exception(f"HTTP {response.status_code}")
                with open(local_video_path, "wb") as f:
                    async for chunk in response.aiter_bytes(): f.write(chunk)
    except Exception as e:
        await send_heartbeat(f"R2 Access Denied: {str(e)}", severity="error")
        supabase.table("game_analysis").upsert({"game_id": game_id, "status": "error", "status_message": str(e)}, on_conflict="game_id").execute()
        return

    # 2. Setup Inference
    await send_heartbeat(f"v{VERSION}: Loading High-Density Models...", progress=15)
    model = YOLO("yolo11m.pt") 
    
    cap = cv2.VideoCapture(local_video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    cap.release()

    # 3. Process & Persist
    await send_heartbeat(f"v{VERSION}: Analyzing Personnel & Ball Mechanics...", progress=20)
    
    results = model.track(
        source=local_video_path, 
        conf=0.25, 
        iou=0.45, 
        imgsz=1280, 
        stream=True, 
        tracker="bytetrack.yaml", 
        persist=True
    )

    detected_tracks = set()
    events_batch = []
    frame_count = 0

    for r in results:
        frame_count += 1
        
        # Extract detections
        if r.boxes and r.boxes.id is not None:
            ids = r.boxes.id.int().cpu().tolist()
            cls = r.boxes.cls.int().cpu().tolist()
            conf = r.boxes.conf.cpu().tolist()
            xywh = r.boxes.xywh.cpu().tolist()

            for i, track_id in enumerate(ids):
                # Class 0 is usually 'person' in COCO/YOLO
                if cls[i] == 0:
                    str_track_id = str(track_id)
                    if str_track_id not in detected_tracks:
                        detected_tracks.add(str_track_id)
                        # Create initial mapping entry
                        supabase.table("ai_player_mappings").upsert({
                            "game_id": game_id,
                            "ai_track_id": str_track_id,
                            "confidence": conf[i],
                            "updated_at": datetime.utcnow().isoformat()
                        }, on_conflict="game_id,ai_track_id").execute()

                # Every 300 frames, save a tracking event (Stage 3 raw data)
                if frame_count % 300 == 0:
                    events_batch.append({
                        "game_id": game_id,
                        "frame_number": frame_count,
                        "timestamp_ms": int((frame_count / fps) * 1000),
                        "event_type": "tracking",
                        "ai_track_id": str(track_id),
                        "x_coord": xywh[i][0],
                        "y_coord": xywh[i][1],
                        "metadata": {"class": cls[i], "conf": conf[i]}
                    })

        # Send heartbeat & flush batch
        if frame_count % (int(fps) * 5) == 0:
            progress = min(20 + int((frame_count / total_frames) * 75), 98)
            msg = f"v{VERSION}: Processed {frame_count}/{total_frames} frames. Tracks: {len(detected_tracks)}"
            await send_heartbeat(msg, progress=progress)
            
            if events_batch:
                supabase.table("raw_events").insert(events_batch).execute()
                events_batch = []

    # Final Flush
    if events_batch:
        supabase.table("raw_events").insert(events_batch).execute()

    # 4. Finalize
    os.remove(local_video_path)
    supabase.table("game_analysis").update({
        "status": "completed",
        "progress_percentage": 100,
        "status_message": f"v{VERSION}: Tactical analysis finalized. {len(detected_tracks)} tracks identified.",
        "updated_at": datetime.utcnow().isoformat()
    }).eq("game_id", game_id).execute()
    
    await send_heartbeat(f"v{VERSION}: Analysis Complete. Results ready for Stage 4 Mapping.", progress=100)

@app.function(image=image)
@modal.asgi_app()
def web_app():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    web_app = FastAPI()

    @web_app.post("/process")
    async def process_game(request: Request):
        try:
            data = await request.json()
            game_id, video_url = data.get("game_id"), data.get("video_url")
            if not all([game_id, video_url]): return JSONResponse(status_code=400, content={"error": "Missing params"})
            await process_game_internal.spawn.aio(game_id, video_url, data.get("supabase_url"), data.get("supabase_key"), data.get("metadata", {}))
            return {"status": "ignited", "game_id": game_id, "version": VERSION}
        except Exception as e: return JSONResponse(status_code=500, content={"error": str(e)})

    @web_app.get("/health")
    async def health(): return {"status": "operational", "version": VERSION}
    return web_app
