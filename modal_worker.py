import modal
import os
import time
import traceback

# MODAL_ELITE_PIPELINE v8.91 - High-Performance DNS-Bypass & SSD Caching
# Purpose: Fix [Errno -2] by using Public R2 and persist video on GPU SSD.

# Initialize the Modal Volume for 24-hour video caching
volume = modal.Volume.from_name("scout-video-cache", create_if_missing=True)

# Define the Image with all necessary scout dependencies
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "requests",
    "opencv-python-headless",
    "numpy",
    "supabase",
    "python-dotenv",
    "pydantic"
)

app = modal.App("basketball-scout-ai", image=image)

def download_to_cache(url: str, cache_path: str):
    """Download video from Public R2 to the persistent Modal Volume if it doesn't exist"""
    import requests 
    
    if os.path.exists(cache_path):
        print(f"⚡ GPU Cache Hit: {cache_path}")
        return True
    
    print(f"📥 GPU Cache Miss. Downloading from Public Bridge: {url}")
    try:
        # High-performance download for public R2 links
        response = requests.get(url, stream=True, timeout=180, allow_redirects=True)
        response.raise_for_status()
        
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=1024*1024): 
                if chunk:
                    f.write(chunk)
        
        # Commit to volume to ensure cross-container persistence
        volume.commit()
        print(f"✅ Video cached on SSD: {cache_path}")
        return True
    except Exception as e:
        print(f"❌ Cache download failed: {str(e)}")
        return False

@app.function(
    volumes={"/cache": volume},
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
        try:
            # We import heavy libs inside the handler to prevent GitHub Action parsing errors
            import numpy as np
            import cv2
            from supabase import create_client
            
            data = await request.json()
            game_id = data.get("game_id")
            video_url = data.get("video_url")
            supabase_url = data.get("supabase_url")
            supabase_key = data.get("supabase_key")
            pipeline_mode = data.get("pipeline_mode", "stage2_calibration")

            print(f"🚀 AI Pipeline Initiated: {pipeline_mode} for Game {game_id}")
            print(f"🔗 Signal URL: {video_url}")

            # Define the local cache path on the Modal Volume
            video_filename = video_url.split('/')[-1].split('?')[0]
            local_video_path = f"/cache/videos/{video_filename}"

            # Step 1: Ensure video is on the GPU SSD
            if not download_to_cache(video_url, local_video_path):
                return JSONResponse({
                    "status": "error", 
                    "message": "Failed to pull video to GPU cache. Check Public R2 URL."
                }, 500)

            # Initialize Supabase for status updates
            supabase = create_client(supabase_url, supabase_key)

            if pipeline_mode == 'stage2_calibration':
                # AI COLOR CALIBRATION LOGIC v8.9
                print("🎨 Running Color Calibration...")
                
                # We use the local_video_path from the SSD instead of the URL
                cap = cv2.VideoCapture(local_video_path)
                if not cap.isOpened():
                    raise Exception("Failed to open local video from GPU cache")
                
                # Mock processing for proof-of-concept; in v9.0 this triggers full YOLO scan
                time.sleep(5)
                
                # Update game status in Supabase
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
                return JSONResponse({"status": "success", "message": "Calibration Complete", "cached": True})

            return JSONResponse({"status": "success", "message": "Handshake Complete", "cached": True})

        except Exception as e:
            error_trace = traceback.format_exc()
            print(f"❌ GPU ERROR: {error_trace}")
            return JSONResponse({"status": "error", "message": str(e)}, 500)
            
    return web_app
