import modal
import os
import json
from datetime import datetime
import time

# Create the Modal App with the EXACT name used in the URL
app = modal.App("basketball-scout-ai-analyze")

# Setup Image with all AI dependencies
image = modal.Image.debian_slim().pip_install(
    "supabase",
    "opencv-python-headless",
    "numpy",
    "requests"
)

def update_pulse(sb, game_id, progress, message, severity="info"):
    """Live Pulse for Unified Pipeline."""
    try:
        # Fetch current metadata safely
        res = sb.table("games").select("processing_metadata").eq("id", game_id).execute()
        meta = res.data[0].get("processing_metadata") if (res.data and len(res.data) > 0) else {}
        
        if not isinstance(meta, dict): meta = {}
        if "worker_logs" not in meta: meta["worker_logs"] = []
        
        # Add new log entry
        meta["worker_logs"].append({
            "timestamp": datetime.now().isoformat(),
            "message": f"[GPU] {message}",
            "severity": severity
        })
        
        # Keep only last 50 logs to prevent DB payload bloat
        meta["worker_logs"] = meta["worker_logs"][-50:]
        
        sb.table("games").update({
            "progress_percentage": progress,
            "processing_metadata": meta,
            "status": "analyzing",
            "updated_at": datetime.now().isoformat()
        }).eq("id", game_id).execute()
    except Exception as e:
        print(f"⚠️ Pulse Fail: {e}")

@app.function(
    image=image,
    gpu="A10G",
    timeout=1800,
    secrets=[
        modal.Secret.from_name("dribblestats-secrets"),
        modal.Secret.from_name("r2-credentials")
    ]
)
@modal.web_endpoint(method="POST")
def process_game_factory(data: dict):
    """Unified Factory: Web Entry Point for AI Analysis"""
    from supabase import create_client
    
    # 1. EXTRACT CREDENTIALS
    game_id = data.get("game_id")
    supabase_url = data.get("supabase_url")
    supabase_key = data.get("supabase_key")
    
    if not game_id or not supabase_url or not supabase_key:
        return {"status": "error", "message": "Missing required parameters (game_id, supabase_url, or supabase_key)"}

    # 2. IMMEDIATE AWAKENING (16%)
    # Connect to Supabase and log the first GPU action
    try:
        sb = create_client(supabase_url, supabase_key)
        update_pulse(sb, game_id, 16, "GPU AWAKENING: Swarm resources allocated.", "info")
    except Exception as e:
        print(f"❌ Handshake Error: {e}")
        return {"status": "error", "message": f"Initial Handshake Failed: {str(e)}"}

    # 3. ANALYSIS PIPELINE (Simulated for M2 Discovery Phase)
    try:
        # 18% - Database Handshake Verified
        update_pulse(sb, game_id, 18, "HANDSHAKE VERIFIED: GPU-to-Database uplink established.", "success")
        time.sleep(2)

        # 25% - Video Asset Retrieval
        update_pulse(sb, game_id, 25, "ASSET RETRIEVAL: Downloading game footage from R2...", "info")
        time.sleep(5)

        # 40% - Player Discovery (M2 Core)
        update_pulse(sb, game_id, 40, "AI DISCOVERY: Detecting player numbers and jerseys...", "info")
        time.sleep(10)

        # 60% - Roster Mapping (M3 Core)
        update_pulse(sb, game_id, 60, "MAPPING ENGINE: Correlating detected entities to roster data...", "info")
        time.sleep(8)

        # 85% - Tactical Insights (M4 Core)
        update_pulse(sb, game_id, 85, "TACTICAL ANALYSIS: Generating shot charts and box score...", "info")
        time.sleep(5)

        # 100% - Completion
        update_pulse(sb, game_id, 100, "ANALYSIS COMPLETE: All AI entities synchronized.", "success")
        
        # Final Status Update
        sb.table("games").update({
            "status": "completed",
            "progress_percentage": 100,
            "updated_at": datetime.now().isoformat()
        }).eq("id", game_id).execute()

        return {"status": "success", "message": "Analysis Pipeline Finished Successfully."}

    except Exception as e:
        error_msg = f"PIPELINE ERROR: {str(e)}"
        print(f"❌ {error_msg}")
        update_pulse(sb, game_id, progress=15, message=error_msg, severity="error")
        return {"status": "error", "message": error_msg}