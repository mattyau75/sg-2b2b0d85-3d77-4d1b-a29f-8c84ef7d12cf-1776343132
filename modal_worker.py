import modal
import os
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any

# MODAL ELITE PIPELINE v16.13 - NATIVE FASTAPI ENDPOINTS
VERSION = "16.13"

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
    
    supabase = create_client(supabase_url.strip(), supabase_key.strip())

    def now_iso():
        return datetime.utcnow().isoformat() + "Z"

    def send_heartbeat(message: str, progress: int = None):
        try:
            supabase.table("game_analysis").upsert({
                "game_id": game_id,
                "status": "processing",
                "status_message": f"v{VERSION}: {message}",
                "progress_percentage": progress or 0,
                "last_heartbeat": now_iso()
            }).execute()
        except:
            pass

    send_heartbeat("Engine Ignited", progress=1)
    return {"status": "success", "version": VERSION}

@app.function(image=image)
@modal.fastapi_endpoint(method="POST", label="process")
async def process(payload: Dict):
    """Native Web Endpoint - No local FastAPI required"""
    process_game_internal.spawn(
        payload["gameId"],
        payload["videoUrl"],
        payload["supabaseUrl"],
        payload["supabaseKey"],
        payload.get("metadata")
    )
    return {"status": "accepted", "version": VERSION}

@app.function(image=image)
@modal.fastapi_endpoint(method="GET", label="health")
async def health():
    """Native Web Endpoint - Reliable handshake"""
    return {"status": "operational", "version": VERSION}
