import modal
import os
import time
import traceback

# MODAL_ELITE_PIPELINE v8.93 - Hybrid R2 + Workspace Volume
# Purpose: Use local SSD volumes to bypass DNS/timeout issues.

# Initialize the Modal Volume for high-performance video processing
volume = modal.Volume.from_name("video-workspace", create_if_missing=True)

# Define the Image with all necessary scout dependencies
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "requests",
    "opencv-python-headless",
    "numpy",
    "supabase",
    "python-dotenv",
    "pydantic",
    "fastapi",
    "uvicorn"
)

app = modal.App("basketball-scout-ai", image=image)

def download_to_workspace(url: str, game_id: str):
    """Download video from Public R2 to the local Modal /workspace/"""
    import requests 
    
    local_path = f"/workspace/{game_id}.mp4"
    
    # Check if already exists in workspace
    if os.path.exists(local_path):
        print(f"⚡ Local Workspace Hit: {local_path}")
        return local_path
    
    print(f"📥 Pulling to Workspace: {url}")
    try:
        response = requests.get(url, stream=True, timeout=180, allow_redirects=True)
        response.raise_for_status()
        
        os.makedirs("/workspace", exist_ok=True)
        with open(local_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=1024*1024): 
                if chunk:
                    f.write(chunk)
        
        # Ensure persistence across the cluster
        volume.commit()
        print(f"✅ Video ready at {local_path}")
        return local_path
    except Exception as e:
        print(f"❌ Workspace pull failed: {str(e)}")
        return None

@app.function(
    volumes={"/workspace": volume},
    timeout=600,
    cpu=2.0,
    memory=4096,
    gpu="T4"
)
@modal.asgi_app()
def process():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    
    web_app = FastAPI()

    @web_app.post("/")
    async def handle_request(request: Request):
        local_video_path = None
        try:
            import numpy as np
            import cv2
            from supabase import create_client
            
            data = await request.json()
            game_id = data.get("game_id")
            video_url = data.get("video_url")
            supabase_url = data.get("supabase_url")
            supabase_key = data.get("supabase_key")
            pipeline_mode = data.get("pipeline_mode", "stage2_calibration")

            print(f"🚀 AI Hybrid Pipeline: {pipeline_mode} for Game {game_id}")

            # Step 1: Download to Local SSD Workspace
            local_video_path = download_to_workspace(video_url, game_id)
            if not local_video_path:
                return JSONResponse({
                    "status": "error", 
                    "message": "Failed to pull video to local GPU workspace."
                }, 500)

            # Initialize Supabase
            supabase = create_client(supabase_url, supabase_key)

            if pipeline_mode == 'stage2_calibration':
                print("🎨 Running Local Color Calibration...")
                
                # Process from LOCAL disk
                cap = cv2.VideoCapture(local_video_path)
                if not cap.isOpened():
                    raise Exception("Failed to open local video from workspace")
                
                # Mock processing logic
                time.sleep(3)
                
                supabase.table('games').update({
                    "analysis_status": "ready",
                    "calibration_data": {
                        "primary_team": "Away",
                        "home_colors": ["#FFFFFF", "#000000"],
                        "away_colors": ["#1D428A", "#FFC72C"],
                        "last_calibrated_at": time.strftime("%Y-%m-%d %H:%M:%S")
                    }
                }).eq('id', game_id).execute()

                cap.release()
                
                # Cleanup local workspace to save space
                if os.path.exists(local_video_path):
                    os.remove(local_video_path)
                    volume.commit()
                
                return JSONResponse({"status": "success", "message": "Calibration Complete", "processed_locally": True})

            return JSONResponse({"status": "success", "message": "Handshake Complete"})

        except Exception as e:
            error_trace = traceback.format_exc()
            print(f"❌ GPU ERROR: {error_trace}")
            
            # Cleanup on error
            if local_video_path and os.path.exists(local_video_path):
                os.remove(local_video_path)
                volume.commit()
                
            return JSONResponse({"status": "error", "message": str(e)}, 500)
            
    return web_app
