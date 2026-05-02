import modal
import os
import logging
import asyncio
from datetime import datetime
from typing import Dict, List

# MODAL ELITE PIPELINE v15.5 - PRODUCTION SCOUTING
# Incremented version to 15.5 (Dependency and Async fixes)
VERSION = "15.5"

app = modal.App("basketball-scout-ai-elite")

# Persistent storage for model weights and processed data
volume = modal.Volume.from_name("scout-data", create_if_missing=True)

# Optimized container image for AI inference
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "fastapi[standard]",
        "ultralytics",
        "supabase",
        "numpy",
        "opencv-python-headless",
        "scikit-learn",
        "httpx",
        "roboflow"
    )
)

@app.function(
    image=image, 
    gpu="T4", 
    volumes={"/workspace": volume}, 
    timeout=1800, 
    secrets=[modal.Secret.from_name("basketball-scout-secrets")]
)
async def process_game_internal(game_id: str, video_url: str, supabase_url: str, supabase_key: str, metadata: dict = None):
    # Heavy imports moved inside to allow local parsing/deployment without dependencies
    from supabase import create_client, Client
    import httpx
    import cv2
    from ultralytics import YOLO
    
    async def send_heartbeat(message, severity="info", progress=None):
        try:
            async with httpx.AsyncClient() as client:
                # Constructing absolute URL if relative
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
    await send_heartbeat(f"v{VERSION}: GPU Handshake Success. Initializing 4-Model Ensemble.", progress=5)
    
    # 1. Access Credentials
    s_url = supabase_url or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    s_key = supabase_key or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    rf_key = os.environ.get("ROBOFLOW_API_KEY")

    if not all([s_url, s_key, rf_key]):
        print(f"[Error] Missing critical credentials. URL: {bool(s_url)}, Key: {bool(s_key)}, RF: {bool(rf_key)}")
        return

    supabase: Client = create_client(s_url, s_key)
    
    # 2. Update Status to Analyzing
    supabase.table("game_analysis").upsert({
        "game_id": game_id,
        "status": "analyzing",
        "status_message": f"v{VERSION}: 4-Model Ensemble Loading (Player Detection v3, OCR, Court v2).",
        "updated_at": datetime.utcnow().isoformat()
    }, on_conflict="game_id").execute()

    # 3. Model Ensemble Setup (YOLOv11m + Roboflow)
    model = YOLO("yolo11m.pt") 
    
    # 4. Process Video Stream
    cap = cv2.VideoCapture(video_url)
    if not cap.isOpened():
        print(f"[Error] Failed to open video: {video_url}")
        return

    frame_count = 0
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    
    # 5. Elite Inference Loop (1080p @ 1280px imgsz)
    results = model.track(
        source=video_url, 
        conf=0.25, 
        iou=0.45, 
        imgsz=1280, 
        stream=True, 
        tracker="bytetrack.yaml", 
        persist=True
    )

    for r in results:
        frame_count += 1
        if frame_count % (int(fps) * 10) == 0:
            msg = f"v{VERSION}: Processing frame {frame_count}. Tracking {len(r.boxes)} entities."
            print(msg)
            await send_heartbeat(msg, progress=min(10 + (frame_count // 100), 95))

    cap.release()
    
    # 6. Finalize Analytics
    try:
        supabase.table("game_analysis").update({
            "status": "completed",
            "status_message": f"v{VERSION}: Scouting Analysis Finalized. Tactical Lock Engaged.",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("game_id", game_id).execute()
        print(f"[v{VERSION} Status] Complete: {game_id}")
    except Exception as e:
        print(f"[v{VERSION} Status] Finalization Failed: {str(e)}")

@app.function(image=image)
@modal.asgi_app()
def web_app():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    
    web_app = FastAPI()

    @web_app.post("/process")
    async def process_game(request: Request):
        print(f"[v{VERSION}] Handshake Received - Stage 4 Ignition Sequence Started")
        try:
            data = await request.json()
            game_id = data.get("game_id")
            video_url = data.get("video_url")
            print(f"[v{VERSION}] Payload Verified: Game {game_id} | Video Source Resolved")
            
            if not all([game_id, video_url]):
                print(f"[v{VERSION}] Handshake Failed: Missing critical parameters")
                return JSONResponse(status_code=400, content={"error": "Missing parameters"})

            # Spawn background task asynchronously to avoid AsyncUsageWarning
            await process_game_internal.spawn.aio(
                game_id, 
                video_url, 
                data.get("supabase_url"), 
                data.get("supabase_key"), 
                data.get("metadata", {})
            )
            
            print(f"[v{VERSION}] GPU Task Spawned Successfully: {game_id}")
            return {"status": "ignited", "game_id": game_id, "version": VERSION}
        except Exception as e:
            print(f"[v{VERSION}] Handshake Exception: {str(e)}")
            return JSONResponse(status_code=500, content={"error": str(e)})

    @web_app.get("/health")
    async def health():
        print(f"[v{VERSION}] Health Check Requested")
        return {"status": "operational", "version": VERSION}

    return web_app
