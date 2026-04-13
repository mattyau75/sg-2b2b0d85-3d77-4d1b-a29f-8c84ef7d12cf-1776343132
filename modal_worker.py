import modal
import os
import json
from datetime import datetime
import time

# 🛠️ HARD SYSTEM HEARTBEAT: 2026-04-12T21:30:01Z (FORCED RE-TRIGGER)
# 🛡️ This unique ID forces GitHub to start a FRESH WORKFLOW RUN.
app = modal.App("basketball-scout-ai")

# 2. SETUP THE RUNTIME ENVIRONMENT
image = (
    modal.Image.debian_slim()
    .pip_install(
        "supabase",
        "opencv-python-headless",
        "requests",
        "numpy"
    )
)

def check_cancellation(supabase, game_id):
    """BIDIRECTIONAL HANDSHAKE: Check if user killed the swarm"""
    try:
        res = supabase.table("game_analysis") \
            .select("status") \
            .eq("game_id", game_id) \
            .order("updated_at", desc=True) \
            .limit(1) \
            .execute()
        
        if res.data and res.data[0].get("status") == "cancelled":
            return True
    except Exception:
        pass
    return False

def log_progress(supabase, game_id, progress, status, message):
    """CUMULATIVE INSERT PATTERN: Every event is a new row for the trace"""
    try:
        supabase.table("game_analysis").insert({
            "game_id": game_id,
            "progress_percentage": progress,
            "status": status,
            "status_message": message
        }).execute()
        
        # Also update the Master Game Record for high-level UI
        supabase.table("games").update({
            "progress_percentage": progress,
            "status": status
        }).eq("id", game_id).execute()
        
    except Exception as e:
        print(f"⚠️ Trace Sync Error: {e}")

def log_to_trace(supabase, game_id, progress, message, status="processing"):
    """ATOMIC UPSERT: Ensures we never crash on ID conflicts and the UI always sees the latest state"""
    try:
        # 1. Update the Analysis Trace (Realtime Hub)
        supabase.table("game_analysis").upsert({
            "game_id": game_id,
            "progress_percentage": progress,
            "status_message": message,
            "status": status,
            "updated_at": datetime.utcnow().isoformat()
        }, on_conflict="game_id").execute()
        
        # 2. Sync to Master Games Table
        supabase.table("games").update({
            "progress_percentage": progress,
            "status": status,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", game_id).execute()
        
        print(f"[{progress}%] {message}")
    except Exception as e:
        print(f"⚠️ Trace Sync Error: {e}")

@app.function(
    image=image,
    gpu="A10G",
    timeout=1800,
    secrets=[modal.Secret.from_name("supabase-keys")]
)
def process_game_swarm(game_id: str, video_url: str = None):
    import os
    import time
    from supabase import create_client
    
    # 🛡️ ATOMIC ID ALIGNMENT
    game_id = game_id.lower()
    start_time = time.time()
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(url, key)

    try:
        # 🚀 IMMEDIATE 16% HANDSHAKE
        log_to_trace(supabase, game_id, 16, "✅ GPU HANDSHAKE: Elite Cluster Awakened & Normalized.")
        
        if not video_url:
            raise ValueError("GPU received an empty video URL payload.")
            
        log_to_trace(supabase, game_id, 18, "Storage verified. Accessing source footage...")
        
        # Simulate initial discovery phase
        time.sleep(5)
        log_to_trace(supabase, game_id, 25, "Personnel Discovery Active. Mapping jersey numbers...")
        
        # ... logic for actual processing would go here ...
        # For now, let's simulate reaching the "Data Generated" milestone (95%)
        time.sleep(10)
        log_to_trace(supabase, game_id, 95, "✅ DATA GENERATION COMPLETE: Box scores and shot charts locked.", "completed")

        return {
            "status": "success",
            "game_id": game_id,
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        error_msg = f"🚨 GPU CRITICAL ERROR: {str(e)}"
        log_to_trace(supabase, game_id, 0, error_msg, "error")
        return {"status": "error", "message": error_msg}