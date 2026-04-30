import modal
import os
import logging
import asyncio
import numpy as np

# MODAL_ELITE_PIPELINE v9.04 - Production Hardened
# Precision K-Means color detection for Elite Basketball Scouting

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0", "ffmpeg")
    .pip_install(
        "opencv-python-headless",
        "numpy",
        "aiohttp",
        "scikit-learn",
        "fastapi",
        "uvicorn"
    )
)

app = modal.App("basketball-scout-ai")
volume = modal.Volume.from_name("video-workspace", create_if_missing=True)

@app.function(
    image=image,
    gpu="T4",
    timeout=600,
    volumes={"/workspace": volume}
)
async def calibrate_colors_internal(game_id: str, video_url: str):
    import aiohttp
    import cv2
    from sklearn.cluster import KMeans
    
    local_path = f"/workspace/{game_id}.mp4"
    
    try:
        logger.info(f"[START] Deep Personnel Scan: {game_id}")
        
        # 1. STREAM DOWNLOAD (Prevents OOM for 1.3GB+ files)
        async with aiohttp.ClientSession() as session:
            async with session.get(video_url, timeout=aiohttp.ClientTimeout(total=600)) as resp:
                if resp.status not in [200, 206]:
                    error_msg = await resp.text()
                    raise Exception(f"R2 Bridge Error {resp.status}: {error_msg[:200]}")
                
                with open(local_path, 'wb') as f:
                    async for chunk in resp.content.iter_chunked(1024 * 1024):
                        f.write(chunk)
        
        await volume.commit.aio()
        logger.info(f"[DOWNLOAD] Video locked to workspace")

        # 2. PIXEL ANALYSIS ENGINE
        cap = cv2.VideoCapture(local_path)
        if not cap.isOpened():
            raise Exception("OpenCV Codec Error: Cannot open video stream.")

        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if frame_count <= 0:
            raise Exception("Video file corrupted or contains 0 frames.")

        # Sample 20 frames across the first 10 minutes
        sample_range = min(18000, frame_count - 1) 
        sample_indices = np.linspace(0, sample_range, 20).astype(int)
        
        all_pixels = []
        for idx in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ret, frame = cap.read()
            if not ret: continue
            
            # ROI: Focus on active play area (ignore stands/ceiling)
            h, w = frame.shape[:2]
            roi = frame[int(h*0.3):int(h*0.7), int(w*0.2):int(w*0.8)]
            
            # Downsample for ML efficiency
            small = cv2.resize(roi, (80, 80))
            all_pixels.append(small.reshape(-1, 3))

        cap.release()
        
        if not all_pixels:
            raise Exception("Frame Sampling Error: No pixels captured.")

        pixel_stack = np.vstack(all_pixels)
        
        # 3. K-MEANS CLUSTERING (8 clusters to find jerseys vs court)
        kmeans = KMeans(n_clusters=8, n_init=5)
        kmeans.fit(pixel_stack)
        centers = kmeans.cluster_centers_
        
        def bgr_to_hex(bgr):
            return "#{:02x}{:02x}{:02x}".format(int(bgr[2]), int(bgr[1]), int(bgr[0]))

        # 4. ELITE JERSEY HEURISTIC
        # Identify Jersey clusters by filtering out the court (Yellow/Orange/Tan) 
        # and shadows/referees (Grays/Blacks).
        
        processed_colors = []
        for center in centers:
            r, g, b = center[2], center[1], center[0]
            # Simple saturation/hue check to avoid common court colors
            is_court = (r > 150 and g > 120 and b < 100) # Tan/Yellowish
            is_muted = (max(r,g,b) - min(r,g,b)) < 15   # Gray/Neutral
            
            if not is_court and not is_muted:
                processed_colors.append(center)

        # If heuristic filters everything, fall back to extremes
        if len(processed_colors) < 2:
            luminosities = [0.299*c[2] + 0.587*c[1] + 0.114*c[0] for c in centers]
            sorted_idx = np.argsort(luminosities)
            away_color = bgr_to_hex(centers[sorted_idx[0]])
            home_color = bgr_to_hex(centers[sorted_idx[-1]])
        else:
            # Pick the two most distinct colors remaining
            # Sort by luminosity for Home/Away convention
            luminosities = [0.299*c[2] + 0.587*c[1] + 0.114*c[0] for c in processed_colors]
            sorted_idx = np.argsort(luminosities)
            away_color = bgr_to_hex(processed_colors[sorted_idx[0]])
            home_color = bgr_to_hex(processed_colors[sorted_idx[-1]])
        
        logger.info(f"[SUCCESS] Signatures Extracted. Home: {home_color}, Away: {away_color}")
        
        # Cleanup
        if os.path.exists(local_path):
            os.remove(local_path)
            await volume.commit.aio()
            
        return {
            "status": "success",
            "game_id": game_id,
            "team_colors": {"home": home_color, "away": away_color}
        }

    except Exception as e:
        logger.exception(f"[FATAL] GPU Pipeline Failure")
        if 'local_path' in locals() and os.path.exists(local_path):
            try:
                os.remove(local_path)
                await volume.commit.aio()
            except: pass
        return {"status": "error", "message": str(e)}

@app.function(image=image)
@modal.asgi_app()
def process():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    
    web_app = FastAPI()
    
    @web_app.post("/")
    @web_app.post("/calibrate")
    async def calibrate(request: Request):
        try:
            body = await request.json()
            game_id = body.get("game_id")
            video_url = body.get("video_url")
            
            if not game_id or not video_url:
                return JSONResponse(
                    content={"status": "error", "message": "Missing ID or URL parameters"},
                    status_code=400
                )
            
            # Async execution
            result = await calibrate_colors_internal.remote.aio(game_id, video_url)
            
            if result.get("status") == "error":
                return JSONResponse(content=result, status_code=500)
                
            return JSONResponse(content=result)
        except Exception as e:
            logger.exception("Bridge Handler Error")
            return JSONResponse(
                content={"status": "error", "message": str(e)},
                status_code=500
            )
            
    return web_app
