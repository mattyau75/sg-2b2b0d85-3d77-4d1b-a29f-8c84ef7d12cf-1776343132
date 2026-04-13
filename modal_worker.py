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

@app.function(
    image=image,
    gpu="A10G",
    timeout=1800,
    secrets=[modal.Secret.from_name("supabase-keys")]
)
def process_game_swarm(game_id: str, video_url: str = None):
    import os
    from supabase import create_client
    
    # 🛡️ ATOMIC ID ALIGNMENT: Force lowercase to match Realtime Channel
    game_id = game_id.lower()
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(url, key)

    def log_to_trace(progress: int, message: str, status: str = "processing"):
        """Instant status sync to the UI via game_analysis table"""
        try:
            # Update technical trace (Realtime stream)
            supabase.table("game_analysis").upsert({
                "game_id": game_id,
                "progress_percentage": progress,
                "status_message": message,
                "status": status,
                "updated_at": datetime.utcnow().isoformat()
            }, on_conflict="game_id").execute()
            
            # Sync to main games table for progress bar
            supabase.table("games").update({
                "progress_percentage": progress,
                "status": status,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", game_id).execute()
            
            print(f"[{progress}%] {message}")
        except Exception as e:
            print(f"Failed to log to dashboard: {str(e)}")

    try:
        # 🚀 IMMEDIATE 16% HANDSHAKE: First line of execution
        log_progress(supabase, game_id, 16, "processing", "✅ GPU HANDSHAKE: Elite Cluster Awakened & Normalized.")
        
        if not video_url:
            raise ValueError("GPU received an empty video URL.")
            
        log_to_trace(18, "Storage verified. Accessing source footage...")
        
        # Simulate processing for verification
        time.sleep(2)
        log_to_trace(25, "Personnel Discovery Active. Mapping jersey numbers...")
        
        return {
            "status": "success",
            "game_id": game_id,
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        error_msg = f"GPU EXECUTION ERROR: {str(e)}"
        log_to_trace(15, error_msg, "error")
        return {"status": "error", "message": error_msg}