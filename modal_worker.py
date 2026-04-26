import modal
import os
import json

# MODAL_ELITE_WORKER v2.6 - YOLO-Enhanced Jersey Color Detection
image = modal.Image.debian_slim().pip_install(
    "fastapi[standard]",
    "requests", 
    "opencv-python-headless", 
    "numpy",
    "Pillow",
    "ultralytics",  # YOLOv11
    "torch",
    "torchvision"
)

app = modal.App("basketball-scout-ai")

def detect_colors_from_video(video_url: str, game_id: str):
    """
    YOLO-enhanced jersey color detection.
    Uses YOLOv11 to detect players, crops to torso, extracts jersey colors.
    """
    import cv2
    import numpy as np
    from ultralytics import YOLO
    
    print(f"[COLOR_CAL] ========== YOLO JERSEY DETECTION START ==========")
    print(f"[COLOR_CAL] Game ID: {game_id}")
    print(f"[COLOR_CAL] Video URL: {video_url}")
    
    try:
        # Load pre-trained YOLOv11m for person detection
        print("[COLOR_CAL] Loading YOLOv11m model...")
        model = YOLO('yolo11m.pt')  # Medium model for better accuracy
        print("[COLOR_CAL] ✓ Model loaded")
        
        # Open video stream
        print(f"[COLOR_CAL] Opening video stream...")
        cap = cv2.VideoCapture(video_url)
        
        if not cap.isOpened():
            error_msg = f"Failed to open video stream: {video_url}"
            print(f"[COLOR_CAL] ❌ {error_msg}")
            return {"status": "error", "message": error_msg}
        
        print("[COLOR_CAL] ✓ Video stream opened")
        
        # Get video properties
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        print(f"[COLOR_CAL] Video: {total_frames} frames @ {fps} fps")
        
        # Sample 5 frames throughout the game for robustness
        frame_samples = []
        if total_frames > 0:
            sample_positions = [
                int(total_frames * 0.2),  # 20%
                int(total_frames * 0.35), # 35%
                int(total_frames * 0.5),  # 50%
                int(total_frames * 0.65), # 65%
                int(total_frames * 0.8)   # 80%
            ]
        else:
            sample_positions = [0]
        
        print(f"[COLOR_CAL] Sampling frames at positions: {sample_positions}")
        
        all_jersey_colors = []
        
        for frame_idx in sample_positions:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            
            if not ret or frame is None:
                print(f"[COLOR_CAL] ⚠️  Failed to read frame {frame_idx}, skipping")
                continue
            
            # Resize to 1280px width for high-res YOLO detection
            height, width = frame.shape[:2]
            target_width = 1280
            scale = target_width / width
            new_height = int(height * scale)
            frame_resized = cv2.resize(frame, (target_width, new_height))
            
            print(f"[COLOR_CAL] Frame {frame_idx}: Original {width}x{height} → Resized {target_width}x{new_height}")
            
            # Run YOLO detection (conf=0.5 for reliable detections)
            results = model(frame_resized, conf=0.5, classes=[0])  # class 0 = person
            
            if len(results) == 0 or len(results[0].boxes) == 0:
                print(f"[COLOR_CAL] ⚠️  No players detected in frame {frame_idx}")
                continue
            
            print(f"[COLOR_CAL] ✓ Detected {len(results[0].boxes)} players in frame {frame_idx}")
            
            # Extract jersey colors from each detected player
            for box in results[0].boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                
                # Crop to torso region (upper 60% of bounding box)
                bbox_height = y2 - y1
                torso_y2 = y1 + int(bbox_height * 0.6)
                
                torso_crop = frame_resized[y1:torso_y2, x1:x2]
                
                if torso_crop.size == 0:
                    continue
                
                # Extract dominant color from torso (jersey area)
                pixels = torso_crop.reshape(-1, 3).astype(np.float32)
                
                # K-means with k=1 to get the single most dominant color
                criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
                _, _, center = cv2.kmeans(pixels, 1, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
                
                b, g, r = center[0]
                hex_color = f"#{int(r):02x}{int(g):02x}{int(b):02x}"
                
                all_jersey_colors.append(hex_color)
        
        cap.release()
        
        if len(all_jersey_colors) == 0:
            error_msg = "No jersey colors detected across all frames"
            print(f"[COLOR_CAL] ❌ {error_msg}")
            return {"status": "error", "message": error_msg}
        
        print(f"[COLOR_CAL] Collected {len(all_jersey_colors)} jersey color samples")
        print(f"[COLOR_CAL] Raw samples: {all_jersey_colors[:10]}...")  # Show first 10
        
        # Cluster all jersey colors into 2 teams using K-means
        # Convert hex to RGB arrays
        rgb_colors = []
        for hex_color in all_jersey_colors:
            hex_color = hex_color.lstrip('#')
            r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
            rgb_colors.append([r, g, b])
        
        rgb_array = np.array(rgb_colors, dtype=np.float32)
        
        # K-means to find 2 team colors
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
        _, labels, centers = cv2.kmeans(rgb_array, 2, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
        
        # Convert centers to hex
        team_colors = []
        for center in centers:
            r, g, b = center
            hex_color = f"#{int(r):02x}{int(g):02x}{int(b):02x}"
            team_colors.append(hex_color)
        
        print(f"[COLOR_CAL] Final team colors: {team_colors}")
        
        result = {
            "status": "success",
            "colors": {
                "home": team_colors[0],
                "away": team_colors[1]
            },
            "game_id": game_id,
            "detection_stats": {
                "frames_sampled": len(sample_positions),
                "jerseys_detected": len(all_jersey_colors),
                "method": "YOLOv11m + K-means torso clustering"
            }
        }
        
        print(f"[COLOR_CAL] ========== SUCCESS ==========")
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
    timeout=600,  # Increased timeout for YOLO processing
)
@modal.asgi_app()
def analyze():
    """
    FastAPI application for YOLO-enhanced color calibration.
    """
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    
    web_app = FastAPI()
    
    @web_app.post("/")
    async def analyze_endpoint(request: Request):
        """
        HTTP endpoint for YOLO-based jersey color detection.
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
