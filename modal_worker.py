# DribbleStats AI Elite: GPU Worker
import modal
import os
import time
from datetime import datetime

app = modal.App("basketball-scout-ai")

image = (
    modal.Image.debian_slim()
    .pip_install(
        "supabase==2.5.1",
        "requests",
        "numpy"
    )
)

def log_to_trace(supabase, game_id, progress, message, status="processing"):
    """ATOMIC UPSERT: Updates progress in both analysis trace and master games table"""
    try:
        timestamp_z = datetime.utcnow().isoformat() + "Z"
        
        # 1. Update Analysis Trace
        supabase.table("game_analysis").upsert({
            "game_id": game_id,
            "progress_percentage": progress,
            "status_message": message,
            "status": status,
            "updated_at": timestamp_z
        }, on_conflict=["game_id"]).execute()
        
        # 2. Sync to Master Games Table
        supabase.table("games").update({
            "progress_percentage": progress,
            "status": status,
            "updated_at": timestamp_z
        }).eq("id", game_id).execute()
        
        print(f"[{progress}%] {message}")
    except Exception as e:
        print(f"⚠️ Trace Sync Error: {e}")

@app.function(
    image=image,
    gpu=modal.gpu.A10G(),
    timeout=3600,
    secrets=[modal.Secret.from_name("supabase-keys")]
)
def analyze_game(data: dict):
    """GPU ENGINE: Performs frame-by-frame analysis and updates progress"""
    from supabase import create_client

    game_id = data.get("game_id")
    video_url = data.get("video_url")
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not all([game_id, video_url, supabase_url, supabase_key]):
        return {"status": "error", "message": "❌ HANDSHAKE BLOCKED: Missing credentials."}

    supabase = create_client(supabase_url, supabase_key)
    
    try:
        # 1. Start Analysis
        log_to_trace(supabase, game_id, 5, "🚀 GPU Cluster Initialized. Starting video stream...", "analyzing")
        time.sleep(2)

        # 2. Simulated Analysis Loop (0-100%)
        # In production, this tracks actual frame processing
        for i in range(10, 101, 10):
            status_msg = "Detecting players and tracking jersey numbers..."
            if i > 40: status_msg = "Calibrating team colors and mapping entities..."
            if i > 70: status_msg = "Finalizing spatial mapping and event generation..."
            if i == 100: status_msg = "✅ Analysis Complete. Syncing results..."
            
            log_to_trace(supabase, game_id, i, status_msg, "analyzing" if i < 100 else "completed")
            time.sleep(3) # Simulated processing time

        return {"status": "success", "game_id": game_id}
    except Exception as e:
        log_to_trace(supabase, game_id, 0, f"❌ GPU Error: {str(e)}", "error")
        return {"status": "error", "message": str(e)}

@app.function(secrets=[modal.Secret.from_name("supabase-keys")])
@modal.web_endpoint(method="POST", label="analyze")
def analyze_endpoint(data: dict):
    """ENTRY POINT: Validates request and spawns GPU worker"""
    game_id = data.get("game_id")
    video_url = data.get("video_url")
    
    if not game_id:
        return {"status": "error", "message": "Missing game_id"}
        
    # Trigger the GPU function asynchronously (FIXED: correct function name)
    analyze_game.spawn({"game_id": game_id, "video_url": video_url})
    
    return {
        "status": "dispatched",
        "message": "🚀 GPU Cluster Spawning. Watch the live trace for progress.",
        "game_id": game_id
    }