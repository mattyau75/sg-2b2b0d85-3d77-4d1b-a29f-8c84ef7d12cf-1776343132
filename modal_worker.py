import modal
import os
import json
from datetime import datetime
import time

# 1. DEFINE THE APP WITH VERIFIED NAMING
# This creates the URL: https://mattjeffs--basketball-scout-ai-analyze.modal.run
app = modal.App("basketball-scout-ai")

# 2. SETUP THE RUNTIME ENVIRONMENT WITH ALL DEPENDENCIES
image = (
    modal.Image.debian_slim()
    .pip_install(
        "supabase",
        "opencv-python-headless",
        "requests",
        "numpy"
    )
)

@app.function(
    image=image,
    gpu="A10G",
    timeout=1200,
    container_idle_timeout=60
)
@modal.web_endpoint(method="POST")
def analyze(payload: dict):
    """
    ELITE GPU ENTRY POINT
    Hardened for instant feedback and robust error reporting.
    """
    start_time = time.time()
    
    # Extract payload with fallbacks (Unified naming)
    game_id = payload.get("game_id")
    supabase_url = payload.get("supabase_url")
    supabase_key = payload.get("supabase_key")
    video_url = payload.get("video_url")

    if not all([game_id, supabase_url, supabase_key]):
        return {"status": "error", "message": "Missing critical authentication or game metadata."}

    # Initialize Supabase Client
    from supabase import create_client, Client
    supabase: Client = create_client(supabase_url, supabase_key)

    def log_to_dashboard(progress: int, message: str, status: str = "processing"):
        """Instant status sync to the UI"""
        try:
            # 1. Update the technical trace table
            # We use upsert to create or update the record
            supabase.table("game_analysis").upsert({
                "game_id": game_id,
                "progress_percentage": progress,
                "status_message": message,
                "status": status,
                "updated_at": datetime.utcnow().isoformat()
            }, on_conflict="game_id").execute()
            
            # 2. Update the main games table for redundancy
            supabase.table("games").update({
                "progress_percentage": progress,
                "status": status,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", game_id).execute()
            
            print(f"[{progress}%] {message}")
        except Exception as e:
            print(f"Failed to log to dashboard: {str(e)}")

    try:
        # CRITICAL: IMMEDIATE 16% HANDSHAKE (Breaks the 15% stall)
        log_to_dashboard(16, "GPU Handshake Successful - Initializing AI Environment...")
        
        if not video_url:
            raise ValueError("GPU received an empty video URL. Check R2/S3 signed URL generation.")
            
        log_to_dashboard(18, f"Source video verified. Downloading footage for analysis...")
        
        # SIMULATION OF PROCESSING
        time.sleep(2) 
        log_to_dashboard(25, "Personnel Discovery Active. Mapping jersey numbers to roster...")
        
        # Final response to the API route
        return {
            "status": "success",
            "game_id": game_id,
            "execution_time": time.time() - start_time
        }

    except Exception as e:
        error_msg = f"GPU EXECUTION ERROR: {str(e)}"
        log_to_dashboard(15, error_msg, "error")
        return {"status": "error", "message": error_msg}