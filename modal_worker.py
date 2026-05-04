import modal
import os
import logging
import asyncio
import time
from datetime import datetime
from typing import Dict, Any

# MODAL ELITE PIPELINE v16.18 - ROBUST FASTAPI BRIDGE
VERSION = "16.18"

image = (
    modal.Image.debian_slim()
    .pip_install(
        "ultralytics",
        "opencv-python-headless",
        "supabase",
        "httpx",
        "fastapi",
        "pydantic"
    )
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
    import httpx
    
    # Trim inputs strictly to avoid leading/trailing whitespace errors
    supabase = create_client(supabase_url.strip(), supabase_key.strip())

    def now_iso():
        return datetime.utcnow().isoformat() + "Z"

    def send_trace(message: str, severity: str = "info", progress: int = None):
        try:
            # Sync Global State
            supabase.table("game_analysis").upsert({
                "game_id": game_id,
                "status": "processing",
                "status_message": f"v{VERSION}: {message}",
                "progress_percentage": progress or 0,
                "last_heartbeat": now_iso(),
                "updated_at": now_iso()
            }).execute()

            # Sync GPU Trace Console
            supabase.table("game_events").insert({
                "game_id": game_id,
                "event_type": "gpu_worker_trace",
                "severity": severity,
                "payload": {"message": f"v{VERSION}: {message}", "progress": progress},
                "timestamp_ms": int(time.time() * 1000),
                "created_at": now_iso()
            }).execute()
        except Exception as e:
            print(f"Trace Sync Error: {e}")

    send_trace("Engine Initialized - Processing tactical video", progress=25)
    
    # Simulated processing loop for testing
    for i in range(1, 4):
        await asyncio.sleep(2)
        send_trace(f"Vision Stage {i}/3 - Calibrating data", progress=25 + (i * 20))
    
    send_trace("Personnel Discovery Complete", severity="success", progress=100)
    
    # Final cleanup/status update
    supabase.table("game_analysis").update({
        "status": "completed",
        "status_message": f"v{VERSION}: Analysis finished successfully",
        "progress_percentage": 100,
        "updated_at": now_iso()
    }).eq("game_id", game_id).execute()

    return {"status": "success", "version": VERSION}

@app.function(image=image)
@modal.asgi_app()
def web_app():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    from fastapi.middleware.cors import CORSMiddleware
    
    web_app = FastAPI(title="DribbleStats AI Elite Bridge")

    # Explicitly enable CORS for local dev and preview environments
    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @web_app.post("/process")
    async def process(request: Request):
        try:
            payload = await request.json()
            if not payload.get("gameId"):
                return JSONResponse(status_code=400, content={"error": "gameId required"})
            
            # Use spawn to trigger the heavy function asynchronously
            process_game_internal.spawn(
                payload["gameId"],
                payload["videoUrl"],
                payload["supabaseUrl"],
                payload["supabaseKey"],
                payload.get("metadata")
            )
            return {"status": "accepted", "version": VERSION, "timestamp": datetime.utcnow().isoformat()}
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": str(e)})

    @web_app.get("/health")
    async def health():
        return {"status": "operational", "version": VERSION}

    return web_app
