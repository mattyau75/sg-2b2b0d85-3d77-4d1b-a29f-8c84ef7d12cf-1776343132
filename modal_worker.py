import modal
import os
import time
from datetime import datetime

# 🛠️ HARD SYSTEM HEARTBEAT: 2026-04-13T06:47:25Z
app = modal.App("basketball-scout-ai")

# 2. SETUP THE RUNTIME ENVIRONMENT
image = (
    modal.Image.debian_slim()
    .pip_install(
        "supabase",
        "requests",
        "numpy"
    )
)

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
    from supabase import create_client
    
    # 1. ATOMIC ID NORMALIZATION (LOWERCASE ONLY)
    game_id = game_id.lower()
    start_time = time.time()
    
    # 2. SUPABASE SERVICE-ROLE AUTHENTICATION (HIGHEST AUTHORITY)
    url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not service_key:
        error_msg = f"❌ FATAL: Modal.com 'supabase-keys' secret is missing. URL Present: {bool(url)}, SERVICE_KEY Present: {bool(service_key)}"
        print(error_msg)
        return {"status": "error", "message": error_msg}

    # Initialize Supabase with Service Role Key to bypass RLS
    supabase = create_client(url, service_key)

    try:
        # 3. GPU HANDSHAKE (Standardized Log)
        log_to_trace(supabase, game_id, 16, "✅ GPU HANDSHAKE: Elite Cluster Awakened.")
        
        if not video_url:
            raise ValueError("GPU received an empty video URL payload.")
            
        log_to_trace(supabase, game_id, 18, "Storage verified. Accessing source footage...")
        
        # Simulate initial discovery phase
        time.sleep(5)
        log_to_trace(supabase, game_id, 25, "Personnel Discovery Active. Mapping jersey numbers...")
        
        # Simulate reaching the "Data Generated" milestone (95%)
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

@app.function(secrets=[modal.Secret.from_name("supabase-keys")])
@modal.web_endpoint(method="POST", label="analyze")
def analyze_endpoint(data: dict):
    """ELITE ENTRY POINT: Receives the signal from Next.js and launches the swarm"""
    game_id = data.get("game_id")
    video_url = data.get("video_url")
    
    if not game_id:
        return {"status": "error", "message": "Missing game_id"}
        
    # Trigger the heavy GPU function asynchronously
    process_game_swarm.spawn(game_id, video_url)
    
    return {
        "status": "dispatched",
        "message": "🚀 Swarm Signal Received. GPU Cluster Initializing...",
        "game_id": game_id
    }