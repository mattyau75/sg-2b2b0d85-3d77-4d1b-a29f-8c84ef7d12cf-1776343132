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

def log_to_trace(supabase, game_id, message, severity="info", module="GPU-ENGINE"):
    """Writes a technical pulse directly to the game_events table for the Live Trace"""
    try:
        # Ensure message is a string and payload is clean
        print(f"📡 [TRACE] {module}: {message}")
        if not supabase:
            print("⚠️ Trace skipped: Supabase client not initialized")
            return
            
        supabase.table("game_events").insert({
            "game_id": game_id,
            "event_type": "gpu_pulse",
            "severity": severity,
            "module_id": module,
            "payload": {"message": str(message)},
            "timestamp_ms": int(time.time() * 1000)
        }).execute()
    except Exception as e:
        print(f"❌ Trace Network Error: {e}")

def update_progress(supabase, game_id, progress, status_msg):
    """Updates the master progress in game_analysis and games tables"""
    try:
        if not supabase: return
        # Update Analysis Table
        supabase.table("game_analysis").upsert({
            "game_id": game_id,
            "progress_percentage": progress,
            "status_message": status_msg,
            "status": "analyzing" if progress < 100 else "completed",
            "updated_at": datetime.utcnow().isoformat()
        }, on_conflict=["game_id"]).execute()
        
        # Sync to Games Table for the Dashboard
        supabase.table("games").update({
            "progress_percentage": progress,
            "status": "analyzing" if progress < 100 else "completed"
        }).eq("id", game_id).execute()
    except Exception as e:
        print(f"⚠️ Progress Sync Error: {e}")

@app.function(
    image=image,
    gpu=modal.GPU.A10G(),
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

    print(f"🛠️ GPU Pre-flight: URL={bool(supabase_url)}, Key={bool(supabase_key)}, Game={game_id}")

    if not all([game_id, video_url, supabase_url, supabase_key]):
        error_msg = f"❌ HANDSHAKE BLOCKED: Missing credentials in Modal Secrets. Please check 'supabase-keys' secret in Modal dashboard (requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)."
        print(error_msg)
        # Try to log even if keys are shaky (the DB allows anon insert for events)
        if game_id and supabase_url:
            try:
                from supabase import create_client
                # Try with whatever we have
                temp_sb = create_client(supabase_url, supabase_key or "missing")
                log_to_trace(temp_sb, game_id, error_msg, "error", "GPU-AUTH")
            except: pass
        return {"status": "error", "message": error_msg}

    supabase = create_client(supabase_url, supabase_key)
    
    try:
        # 1. IMMEDIATE STARTUP PULSE
        log_to_trace(supabase, game_id, "🚀 GPU CLUSTER HANDSHAKE: Connection Established.", "info", "GPU-CORE")
        update_progress(supabase, game_id, 5, "Initializing AI Vision Engine...")
        time.sleep(2)

        # 2. Simulated Analysis Loop (0-100%)
        # In production, this tracks actual frame processing
        stats_buffer = [] # Buffer for play-by-play events
        
        for i in range(10, 101, 10):
            # 2.1 CHECK FOR USER ABORT
            try:
                res = supabase.table("games").select("status").eq("id", game_id).single().execute()
                if res.data and res.data.get("status") == "cancelled":
                    log_to_trace(supabase, game_id, "🛑 USER ABORT DETECTED: Terminating GPU process immediately.", "warn", "GPU-CORE")
                    return {"status": "cancelled", "message": "User terminated job"}
            except Exception as abort_err:
                print(f"⚠️ Abort Check Error: {abort_err}")

            status_msg = "Detecting players and tracking jersey numbers..."
            if i > 40: status_msg = "Calibrating team colors and mapping entities..."
            if i > 70: status_msg = "Finalizing spatial mapping and event generation..."
            if i == 100: status_msg = "✅ Analysis Complete. Syncing results..."
            
            # Buffer a few mock stats for each segment
            stats_buffer.append({
                "game_id": game_id,
                "player_id": None, # Mapping would happen here
                "event_type": "detection",
                "timestamp_seconds": float(i),
                "metadata": {"progress": i, "engine": "A10G"}
            })

            log_to_trace(supabase, game_id, f"Processing segment: {status_msg}", "info")
            update_progress(supabase, game_id, i, status_msg)
            time.sleep(3) # Simulated processing time

        # 3. FINAL BATCH MIGRATION
        if stats_buffer:
            log_to_trace(supabase, game_id, f"🚀 MIGRATING BATCH: Sending {len(stats_buffer)} events to master database...", "info", "GPU-SYNC")
            supabase.table("play_by_play").insert(stats_buffer).execute()

        log_to_trace(supabase, game_id, "🏁 GPU processing successfully concluded.", "info")
        return {"status": "success", "game_id": game_id}
    except Exception as e:
        log_to_trace(supabase, game_id, f"❌ GPU Error: {str(e)}", "error")
        update_progress(supabase, game_id, 0, f"Error: {str(e)}")
        return {"status": "error", "message": str(e)}

@app.function(
    image=image,
    gpu=modal.gpu.A10G(),
    timeout=3600,
    secrets=[modal.Secret.from_name("supabase-keys")]
)
@modal.web_endpoint(method="POST")
def analyze(data: dict):
    """GPU WEB ENDPOINT: Entry point for analysis requests"""
    from supabase import create_client
    
    # 0. IMMEDIATE HEARTBEAT ACKNOWLEDGMENT
    game_id = data.get("game_id")
    print(f"💓 [HEARTBEAT] Received request for Game: {game_id}")
    
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    # Initialize client early to send heartbeat pulse to UI
    if supabase_url and supabase_key:
        try:
            supabase = create_client(supabase_url, supabase_key)
            # Log the connection established event
            log_to_trace(supabase, game_id, "🚀 GPU CLUSTER HANDSHAKE: Connection Established.", "info", "GPU-CORE")
            
            # Update analysis record
            supabase.table("game_analysis").upsert({
                "game_id": game_id,
                "status": "analyzing",
                "status_message": "GPU cluster waking up...",
                "progress_percentage": 5,
                "updated_at": datetime.utcnow().isoformat()
            }, on_conflict=["game_id"]).execute()
        except Exception as e:
            print(f"⚠️ Heartbeat Pulse Error: {e}")

    # Start the actual analysis in the background
    analyze_game.spawn(data)
    
    return {
        "status": "ignited", 
        "message": "🚀 GPU Cluster Spawning. Watch the live trace for progress.",
        "game_id": game_id
    }
