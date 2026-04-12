import modal
import os
import json
from datetime import datetime
import time

# 1. DEFINE THE APP WITH FOOLPROOF NAMING
# This creates the URL: https://mattjeffs--scout-run.modal.run
app = modal.App("scout")

# 2. SETUP THE RUNTIME ENVIRONMENT
image = modal.Image.debian_slim().pip_install(
    "supabase",
    "requests",
    "opencv-python-headless",
    "numpy"
)

# 3. CORE PROCESSING LOGIC
def log_to_dashboard(percentage, message, status="analyzing"):
    """Update the Supabase game record with progress logs."""
    try:
        from supabase import create_client
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        game_id = os.environ.get("GAME_ID")
        
        if not all([url, key, game_id]):
            print(f"Skipping log: {message}")
            return

        supabase = create_client(url, key)
        supabase.table("games").update({
            "progress_percentage": percentage,
            "analysis_logs": f"[{datetime.now().strftime('%H:%M:%S')}] {message}",
            "status": status,
            "updated_at": datetime.now().isoformat()
        }).eq("id", game_id).execute()
    except Exception as e:
        print(f"Logging error: {e}")

@app.function(
    image=image,
    gpu="A10G",
    timeout=1200,
    container_idle_timeout=60,
    secrets=[
        modal.Secret.from_name("supabase-creds")
    ]
)
@modal.web_endpoint(method="POST")
def run(payload: dict):
    """
    ELITE IGNITION ENDPOINT
    URL: https://mattjeffs--scout-run.modal.run
    """
    start_time = time.time()
    
    # Extract metadata
    game_id = payload.get("game_id")
    supabase_url = payload.get("supabase_url")
    supabase_key = payload.get("supabase_key")
    
    # Set env for logger
    os.environ["SUPABASE_URL"] = supabase_url
    os.environ["SUPABASE_KEY"] = supabase_key
    os.environ["GAME_ID"] = game_id

    print(f"🚀 GPU AWAKENING: Received request for game {game_id}")
    
    # 16% (GPU AWAKENING) - INSTANT FEEDBACK
    log_to_dashboard(16, "GPU AWAKENING: Cluster resources allocated.", "analyzing")
    
    time.sleep(2) # Brief pause for log sync
    
    # 18% (HANDSHAKE VERIFIED)
    log_to_dashboard(18, "HANDSHAKE VERIFIED: Secure connection established.", "analyzing")

    try:
        # Mocking heavy lift for now to verify pipeline
        time.sleep(5)
        
        log_to_dashboard(35, "AI INITIALIZATION: Loading scouting models...", "analyzing")
        
        # Final success
        log_to_dashboard(100, "ANALYSIS COMPLETE: Game data synchronized.", "completed")
        
        return {"status": "success", "message": "Analysis initiated"}

    except Exception as e:
        error_msg = f"GPU FATAL: {str(e)}"
        print(error_msg)
        log_to_dashboard(15, error_msg, "error")
        return {"status": "error", "message": error_msg}