import modal
import os
import logging
import asyncio
from datetime import datetime
from typing import Dict, List

# MODAL ELITE PIPELINE v15.6 - PRODUCTION SCOUTING
# Fixed 403 Forbidden on R2, added local download step, and pre-installed dependencies
VERSION = "15.6"

app = modal.App("basketball-scout-ai-elite")

# Persistent storage for model weights
volume = modal.Volume.from_name("scout-data", create_if_missing=True)

# Optimized container image for AI inference
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0", "wget")
    .pip_install(
        "fastapi[standard]",
        "ultralytics",
        "lap", # Pre-install to avoid AutoUpdate
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
    timeout=1800, 
    secrets=[modal.Secret.from_name("basketball-scout-secrets")]
)
async def process_game_internal(game_id: str, video_url: str, supabase_url: str, supabase_key: str, metadata: dict = None):
    from supabase import create_client, Client
    import httpx
    import cv2
    import os
    from ultralytics import YOLO
    
    async def send_heartbeat(message, severity="info", progress=None):
        try:
            async with httpx.AsyncClient() as client:
                app_url = metadata.get("app_url") or "https://build-a-basketball-boxscore-stats-player-play-by.vercel.app"
                await client.post(f"{app_url}/api/gpu-heartbeat", json={
                    "gameId": game_id,
                    "message": message,
                    "severity": severity,
                    "progress": progress
                })
        except Exception as e:
            print(f"[Heartbeat Error] {e}")

    print(f"[v{VERSION}] Elite Scouting Engine Ignited: {game_id}")
    await send_heartbeat(f"v{VERSION}: GPU Handshake Success. Resolving Video Signal.", progress=5)
    
    # 1. Credentials
    s_url = supabase_url or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    s_key = supabase_key or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not all([s_url, s_key]):
        print(f"[Error] Missing critical credentials.")
        return

    supabase: Client = create_client(s_url, s_key)
    
    # 2. Local Download Step (Bypasses Ultralytics 403 issues)
    local_video_path = f"/tmp/{game_id}.mp4"
    await send_heartbeat(f"v{VERSION}: Downloading Tactical Feed to Local Buffer...", progress=10)
    
    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            async with client.stream("GET", video_url) as response:
                if response.status_code != 200:
                    raise Exception(f"Video Download Failed: HTTP {response.status_code}")
                
                with open(local_video_path, "wb") as f:
                    async for chunk in response.aiter_bytes():
                        f.write(chunk)
        print(f"[v{VERSION}] Download Complete: {local_video_path}")
    except Exception as e:
        error_msg = f"R2 Access Denied: {str(e)}"
        print(f"[Error] {error_msg}")
        await send_heartbeat(error_msg, severity="error")
        supabase.table("game_analysis").upsert({
            "game_id": game_id,
            "status": "error",
            "status_message": f"v{VERSION}: {error_msg}",
            "updated_at": datetime.utcnow().isoformat()
        }, on_conflict="game_id").execute()
        return

    # 3. Model Setup
    await send_heartbeat(f"v{VERSION}: Initializing Inference Engines...", progress=20)
    model = YOLO("yolo11m.pt") 
    
    # 4. Processing
    cap = cv2.VideoCapture(local_video_path)
    if not cap.isOpened():
        print(f"[Error] Failed to open buffered video")
        return

    frame_count = 0
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    
    results = model.track(
        source=local_video_path, 
        conf=0.25, 
        iou=0.45, 
        imgsz=1280, 
        stream=True, 
        tracker="bytetrack.yaml", 
        persist=True
    )

    for r in results:
        frame_count += 1
        if frame_count % (int(fps) * 5) == 0:
            msg = f"v{VERSION}: Analyzing Frame {frame_count}. Tracking {len(r.boxes)} Personnel Units."
            print(msg)
            await send_heartbeat(msg, progress=min(25 + (frame_count // 100), 98))

    cap.release()
    os.remove(local_video_path) # Cleanup
    
    # 5. Finalize
    try:
        supabase.table("game_analysis").update({
            "status": "completed",
            "status_message": f"v{VERSION}: Tactical Analysis Finalized.",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("game_id", game_id).execute()
        print(f"[v{VERSION}] Complete: {game_id}")
    except Exception as e:
        print(f"[Error] Finalization failed: {str(e)}")

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
            game_id = data.get("game_id")
            video_url = data.get("video_url")
            
            if not all([game_id, video_url]):
                return JSONResponse(status_code=400, content={"error": "Missing parameters"})

            await process_game_internal.spawn.aio(
                game_id, 
                video_url, 
                data.get("supabase_url"), 
                data.get("supabase_key"), 
                data.get("metadata", {})
            )
            
            return {"status": "ignited", "game_id": game_id, "version": VERSION}
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": str(e)})

    @web_app.get("/health")
    async def health():
        return {"status": "operational", "version": VERSION}

    return web_app
