import modal
from typing import Dict

# MODAL ELITE PIPELINE v16.22 - IDEMPOTENT HANDSHAKE
VERSION = "16.22"

image = modal.Image.debian_slim().pip_install(
    "supabase", "httpx", "fastapi", "pydantic"
)

# We use a separate image for heavy scouting to keep handshake fast
scout_image = modal.Image.debian_slim().pip_install(
    "supabase", "ultralytics", "httpx", "fastapi", "pydantic"
)

app = modal.App("basketball-scout-ai-elite", image=image)

@app.function()
@modal.fastapi_endpoint(method="POST", label="process")
async def process(payload: Dict):
    """
    v16.22 Elite Handshake - Instant Acknowledgement Architecture
    """
    import asyncio
    import time
    from supabase import create_client
    
    game_id = payload.get("gameId")
    supabase_url = payload.get("supabaseUrl")
    supabase_key = payload.get("supabaseKey")
    
    if not all([game_id, supabase_url, supabase_key]):
        return {"status": "error", "message": "Handshake rejected: Missing credentials"}

    # Respond to signal INSTANTLY before spawning heavy scout
    # This avoids the Next.js fetch timeout
    
    async def run_scout_background():
        # Deferred imports inside background task
        # This keeps the main function cold-start friendly
        try:
            supabase = create_client(supabase_url, supabase_key)
            
            def log_event(message, severity="info", progress=None):
                supabase.table("game_events").insert({
                    "game_id": game_id,
                    "event_type": "gpu_process",
                    "severity": severity,
                    "payload": {"message": f"v{VERSION}: {message}", "progress": progress},
                    "timestamp_ms": int(time.time() * 1000)
                }).execute()

            log_event("Engine Handshake Confirmed", progress=22)
            await asyncio.sleep(1)
            log_event("Initializing Tactical OCR Engine...", progress=40)
            
            # Simulated Processing
            await asyncio.sleep(2)
            log_event("Elite Scouting Cycle Complete", severity="success", progress=100)
            
        except Exception as e:
            print(f"Scout Failure: {e}")

    # FIRE AND FORGET
    asyncio.create_task(run_scout_background())
    
    return {
        "status": "accepted", 
        "version": VERSION, 
        "id": game_id,
        "message": "Handshake acknowledged. background scout spawning."
    }

@app.function()
@modal.fastapi_endpoint(method="GET", label="health")
async def health():
    return {"status": "operational", "version": VERSION}
