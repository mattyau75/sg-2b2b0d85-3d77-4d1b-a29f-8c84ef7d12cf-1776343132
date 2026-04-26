import modal
import os
import json

# MODAL_ELITE_WORKER v2.5 - FastAPI Request Handling
image = modal.Image.debian_slim().pip_install(
    "fastapi[standard]",
    "requests", 
    "opencv-python-headless", 
    "numpy",
    "Pillow"
)

app = modal.App("basketball-scout-ai")

def detect_colors_from_video(video_url: str, game_id: str):
    """
    Synchronous color detection - returns colors immediately.
    NO async processing, NO Supabase writes.
    """
    import cv2
    import numpy as np
    
    print(f"[COLOR_CAL] Starting color detection for game {game_id}")
    print(f"[COLOR_CAL] Video URL: {video_url}")
    
    try:
        print(f"[COLOR_CAL] Opening video stream...")
        cap = cv2.VideoCapture(video_url)
        
        if not cap.isOpened():
            error_msg = f"Failed to open video stream: {video_url}"
            print(f"[COLOR_CAL] ❌ {error_msg}")
            return {
                "status": "error",
                "message": error_msg
            }
        
        print("[COLOR_CAL] ✓ Video stream opened")
        
        # Get video properties
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        print(f"[COLOR_CAL] Video: {total_frames} frames @ {fps} fps")
        
        # Skip to middle of video
        if total_frames > 0:
            target_frame = total_frames // 2
            cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
            print(f"[COLOR_CAL] Seeking to frame {target_frame}")
        
        ret, frame = cap.read()
        cap.release()
        
        if not ret or frame is None:
            error_msg = "Failed to extract frame from video"
            print(f"[COLOR_CAL] ❌ {error_msg}")
            return {
                "status": "error",
                "message": error_msg
            }
        
        print(f"[COLOR_CAL] ✓ Extracted frame: {frame.shape}")
        
        # K-means clustering to find 2 dominant colors
        print("[COLOR_CAL] Running K-means clustering...")
        pixels = frame.reshape(-1, 3).astype(np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
        _, labels, centers = cv2.kmeans(pixels, 2, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
        
        print(f"[COLOR_CAL] ✓ K-means complete")
        
        # Convert BGR to RGB and then to hex
        colors = []
        for i, center in enumerate(centers):
            b, g, r = center
            hex_color = f"#{int(r):02x}{int(g):02x}{int(b):02x}"
            colors.append(hex_color)
            print(f"[COLOR_CAL] Color {i+1}: {hex_color}")
        
        result = {
            "status": "success",
            "colors": {
                "home": colors[0],
                "away": colors[1]
            },
            "game_id": game_id
        }
        
        print(f"[COLOR_CAL] ✅ SUCCESS")
        return result
        
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"[COLOR_CAL] ❌ EXCEPTION: {error_msg}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error", 
            "message": error_msg
        }

@app.function(
    image=image,
    gpu="A10G",
    timeout=300,
)
@modal.asgi_app()
def analyze():
    """
    FastAPI application for color calibration endpoint.
    """
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    
    web_app = FastAPI()
    
    @web_app.post("/")
    async def analyze_endpoint(request: Request):
        """
        HTTP endpoint for color calibration.
        Synchronously returns color detection results.
        """
        try:
            data = await request.json()
            
            game_id = data.get("game_id")
            video_url = data.get("video_url")
            pipeline_mode = data.get("pipeline_mode", "color_calibration")
            
            print(f"[ENDPOINT] ========== START ==========")
            print(f"[ENDPOINT] Mode: {pipeline_mode}")
            print(f"[ENDPOINT] Game: {game_id}")
            print(f"[ENDPOINT] Video: {video_url}")
            
            if pipeline_mode == "color_calibration":
                # Run synchronously and return immediately
                result = detect_colors_from_video(video_url, game_id)
                print(f"[ENDPOINT] Result: {json.dumps(result, indent=2)}")
                print(f"[ENDPOINT] ========== END ==========")
                return JSONResponse(content=result)
            else:
                print(f"[ENDPOINT] ❌ Unsupported mode: {pipeline_mode}")
                print(f"[ENDPOINT] ========== END ==========")
                return JSONResponse(
                    content={
                        "status": "error",
                        "message": f"Unsupported pipeline mode: {pipeline_mode}"
                    },
                    status_code=400
                )
        except Exception as e:
            print(f"[ENDPOINT] ❌ EXCEPTION: {str(e)}")
            import traceback
            traceback.print_exc()
            return JSONResponse(
                content={
                    "status": "error",
                    "message": str(e)
                },
                status_code=500
            )
    
    return web_app
