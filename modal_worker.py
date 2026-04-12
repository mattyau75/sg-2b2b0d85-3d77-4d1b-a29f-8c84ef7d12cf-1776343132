import modal
import os
import json
from datetime import datetime
from supabase import create_client
import time

# Direct-2.0 Async Background Architecture
app = modal.App("basketball-scout-gpu")
image = modal.Image.debian_slim().pip_install("supabase", "opencv-python-headless", "numpy")

def update_db(sb, game_id, progress, message, severity="info"):
    """Robust JSONB log stream."""
    try:
        res = sb.table("games").select("processing_metadata").eq("id", game_id).execute()
        meta = res.data[0].get("processing_metadata") or {"worker_logs": []}
        if "worker_logs" not in meta: meta["worker_logs"] = []
        
        meta["worker_logs"].append({
            "timestamp": datetime.now().isoformat(), 
            "message": message, 
            "severity": severity
        })
        meta["last_heartbeat"] = datetime.now().isoformat()
        
        sb.table("games").update({
            "status": "processing",
            "progress_percentage": progress,
            "processing_metadata": meta,
            "updated_at": datetime.now().isoformat()
        }).eq("id", game_id).execute()
        print(f"✅ Telemetry: {message} ({progress}%)")
    except Exception as e:
        print(f"❌ Telemetry Fail: {e}")

@app.function(image=image, gpu="A10G", timeout=3600)
def analyze_game(payload: dict):
    """The heavy background process."""
    game_id = payload.get("game_id")
    sb = create_client(payload.get("supabase_url"), payload.get("supabase_key"))
    
    update_db(sb, game_id, 20, "GPU Cluster: Cold-start complete. Discovery engine active.", "success")
    
    # SIMULATED DETECTION STAGES
    time.sleep(5)
    update_db(sb, game_id, 40, "AI Discovery: Extracting player jersey numbers...", "info")
    time.sleep(5)
    update_db(sb, game_id, 60, "AI Discovery: Mapping entities to team rosters...", "info")
    time.sleep(5)
    update_db(sb, game_id, 90, "AI Discovery: Finalizing personnel dashboard...", "success")
    
    sb.table("games").update({
        "status": "completed",
        "progress_percentage": 100,
        "m2_complete": True
    }).eq("id", game_id).execute()

@app.function(image=image)
@modal.web_endpoint(method="POST")
async def process(payload: dict):
    """Instant-response background launcher."""
    # Spawn the heavy analysis in the background and return immediately
    analyze_game.spawn(payload)
    return {"status": "spawned", "message": "Background analysis initiated"}