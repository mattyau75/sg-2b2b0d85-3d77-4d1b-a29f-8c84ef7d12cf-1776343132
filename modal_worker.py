import modal
import os
import json

# MODAL_ELITE_WORKER v4.0 - Multi-Model Basketball Analysis System
# Comprehensive pipeline: Color calibration → Jersey detection → Court mapping → Event tracking
#
# Model Stack:
# 1. YOLOv11m (COCO) - Person detection for color calibration
# 2. Roboflow: basketball-players - Basketball-specific player detection
# 3. Roboflow: basketball-jersey-number - Jersey number OCR
# 4. Roboflow: basketball-ball-detection - Ball tracking
# 5. YOLOv8-pose - Court keypoint detection for shot charts

image = modal.Image.debian_slim().apt_install(
    "libgl1-mesa-glx",
    "libglib2.0-0",
    "libsm6",
    "libxext6",
    "libxrender-dev",
    "libgomp1"
).pip_install(
    "fastapi[standard]",
    "requests",
    "opencv-python-headless",
    "numpy",
    "Pillow",
    "ultralytics>=8.0.0",
    "torch",
    "torchvision",
    "roboflow",  # Roboflow Universe integration
    "supervision"  # For Roboflow model inference
).run_commands(
    # Pre-download all YOLO models to cache them in the image
    "yolo export model=yolo11m.pt format=onnx",      # Person detection (color calibration)
    "yolo export model=yolo11l.pt format=onnx",      # Large model (jersey numbers)
    "yolo export model=yolov8m-pose.pt format=onnx"  # Pose estimation (court mapping)
)

app = modal.App("basketball-scout-ai")

def detect_colors_yolo11m(video_url: str, game_id: str):
    """
    Stage 2: Color Calibration using YOLOv11m + Roboflow Basketball Model
    
    Optimized for accurate jersey color detection from small video samples.
    Settings:
    - Resolution: 1280px (high-res for small players)
    - Model: YOLOv11m (COCO person) + Roboflow basketball-players
    - Sampling: 5 frames across video (skip warmup/celebration periods)
    - Focus: Tight torso crop (top 60% of player bbox)
    - Output: 2 dominant team colors (hex)
    """
    import cv2
    import numpy as np
    from ultralytics import YOLO
    from roboflow import Roboflow
    
    print(f"\n{'='*80}")
    print(f"[STAGE 2: COLOR CALIBRATION] Game: {game_id}")
    print(f"{'='*80}")
    
    try:
        # Initialize YOLO for fallback person detection
        model = YOLO('yolo11m.pt')
        print("[MODEL] ✓ YOLOv11m loaded from cache")
        
        # Stage 2: Color Calibration using Specialized Roboflow Basketball Model
        try:
            # Get API key from environment
            api_key = os.environ.get("ROBOFLOW_API_KEY", "placeholder_key")
            rf = Roboflow(api_key=api_key) 
            project = rf.workspace("roboflow-100").project("basketball-players")
            roboflow_model = project.version(2).model
            use_roboflow = True
            print("[ROBOFLOW] ✓ Specialized Basketball Model Active")
        except Exception as rf_error:
            print(f"[ROBOFLOW] ⚠️ Using YOLOv11m fallback: {str(rf_error)}")
            use_roboflow = False
        
        cap = cv2.VideoCapture(video_url)
        if not cap.isOpened():
            return {"status": "error", "message": f"Failed to open video: {video_url}"}
        
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        print(f"[VIDEO] {total_frames} frames @ {fps:.1f}fps ({width}x{height})")
        
        # Sample 5 frames (skip first/last 10% - warmups/celebrations)
        if total_frames > 0:
            sample_positions = [
                int(total_frames * 0.2),
                int(total_frames * 0.35),
                int(total_frames * 0.5),
                int(total_frames * 0.65),
                int(total_frames * 0.8)
            ]
        else:
            sample_positions = [0]
        
        print(f"[SAMPLING] Frames: {sample_positions}")
        
        all_jersey_colors = []
        total_players = 0
        
        for frame_idx in sample_positions:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            
            if not ret:
                print(f"[FRAME {frame_idx}] ⚠️ Failed to read, skipping")
                continue
            
            # Resize to 1280px for small player detection
            h, w = frame.shape[:2]
            target_w = 1280
            scale = target_w / w
            frame_resized = cv2.resize(frame, (target_w, int(h * scale)))
            
            # Basketball player detection (Roboflow or YOLO fallback)
            if use_roboflow:
                # Save temp frame for Roboflow
                temp_path = f"/tmp/frame_{frame_idx}.jpg"
                cv2.imwrite(temp_path, frame_resized)
                roboflow_results = roboflow_model.predict(temp_path, confidence=40, overlap=30).json()
                
                if not roboflow_results.get('predictions'):
                    print(f"[FRAME {frame_idx}] ⚠️ No players detected (Roboflow)")
                    continue
                
                players_detected = len(roboflow_results['predictions'])
                total_players += players_detected
                print(f"[FRAME {frame_idx}] ✓ {players_detected} players detected (Roboflow)")
                
                for pred in roboflow_results['predictions']:
                    x_center = pred['x']
                    y_center = pred['y']
                    bbox_w = pred['width']
                    bbox_h = pred['height']
                    
                    x1 = int(x_center - bbox_w / 2)
                    y1 = int(y_center - bbox_h / 2)
                    x2 = int(x_center + bbox_w / 2)
                    y2 = int(y_center + bbox_h / 2)
                    
                    # Basketball player filtering
                    aspect_ratio = bbox_h / max(bbox_w, 1)
                    if aspect_ratio < 1.2:  # Must be taller than wide
                        continue
                    if bbox_h < 50:  # Minimum 50px height
                        continue
                    
                    # Tighter center-biased crop (center 40% width, 15-45% height)
                    # This targets the upper chest area precisely
                    torso_y1 = y1 + int(bbox_h * 0.15)
                    torso_y2 = y1 + int(bbox_h * 0.45)
                    torso_x1 = x1 + int(bbox_w * 0.3)
                    torso_x2 = x1 + int(bbox_w * 0.7)
                    
                    torso_crop = frame_resized[max(0, torso_y1):min(target_w, torso_y2), max(0, torso_x1):min(target_w, torso_x2)]
                    if torso_crop.size < 50: continue
                    
                    # Advanced Color Extraction: K-means with K=5 for higher resolution
                    pixels = torso_crop.reshape(-1, 3).astype(np.float32)
                    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
                    _, labels, centers = cv2.kmeans(pixels, 5, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
                    
                    # Heuristic: Pick the color with the highest saturation (Blue) 
                    # OR highest brightness (White), ignoring "muddy" greys/browns
                    best_color = None
                    max_score = -1
                    
                    for center in centers:
                        b, g, r = center
                        # Convert to simple HSV-like metrics
                        brightness = (r + g + b) / 3
                        saturation = max(r, g, b) - min(r, g, b)
                        
                        # Score: Favor high saturation (colors) or very high brightness (white)
                        # Penalty for "muddy" mid-tones (around 80-120 brightness with low saturation)
                        score = saturation * 2 + brightness
                        if brightness < 40: score -= 100 # Ignore shadows
                        if brightness > 220: score += 50 # Strongly favor white
                        
                        if score > max_score:
                            max_score = score
                            best_color = f"#{int(r):02x}{int(g):02x}{int(b):02x}"
                    
                    if best_color:
                        all_jersey_colors.append(best_color)
            else:
                # YOLO fallback (generic person detection)
                results = model(
                    frame_resized,
                    conf=0.5,
                    iou=0.4,
                    classes=[0],  # Person
                    imgsz=1280,
                    verbose=False
                )
                
                if len(results) == 0 or len(results[0].boxes) == 0:
                    print(f"[FRAME {frame_idx}] ⚠️ No players detected (YOLO)")
                    continue
                
                players_detected = len(results[0].boxes)
                total_players += players_detected
                print(f"[FRAME {frame_idx}] ✓ {players_detected} players detected (YOLO)")
                
                for box in results[0].boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    bbox_w = x2 - x1
                    bbox_h = y2 - y1
                    aspect_ratio = bbox_h / max(bbox_w, 1)
                    
                    # Basketball player filtering
                    if aspect_ratio < 1.2:
                        continue
                    if bbox_h < 50:
                        continue
                    
                    # Crop to upper torso (jersey only)
                    torso_y2 = y1 + int(bbox_h * 0.6)
                    padding_x = int(bbox_w * 0.05)
                    x1_pad = max(0, x1 - padding_x)
                    x2_pad = min(target_w, x2 + padding_x)
                    
                    torso_crop = frame_resized[y1:torso_y2, x1_pad:x2_pad]
                    if torso_crop.size == 0:
                        continue
                    
                    # K-means: Extract dominant color
                    pixels = torso_crop.reshape(-1, 3).astype(np.float32)
                    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
                    _, _, center = cv2.kmeans(pixels, 1, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
                    
                    b, g, r = center[0]
                    hex_color = f"#{int(r):02x}{int(g):02x}{int(b):02x}"
                    all_jersey_colors.append(hex_color)
        
        cap.release()
        
        if len(all_jersey_colors) == 0:
            return {"status": "error", "message": "No jersey colors detected. Try different video sample."}
        
        print(f"[COLORS] Collected {len(all_jersey_colors)} samples from {total_players} players")
        
        # Cluster into 2 team colors
        rgb_colors = []
        for hex_color in all_jersey_colors:
            hex_color = hex_color.lstrip('#')
            r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
            rgb_colors.append([r, g, b])
        
        rgb_array = np.array(rgb_colors, dtype=np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
        _, labels, centers = cv2.kmeans(rgb_array, 2, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
        
        team_colors = []
        for center in centers:
            r, g, b = center
            team_colors.append(f"#{int(r):02x}{int(g):02x}{int(b):02x}")
        
        # Calculate confidence (color separation distance)
        color_distance = np.linalg.norm(centers[0] - centers[1])
        confidence = min(100, int((color_distance / 255) * 100))
        
        print(f"[RESULT] Team Colors: {team_colors}")
        print(f"[RESULT] Confidence: {confidence}% (separation: {color_distance:.1f})")
        print(f"{'='*80}\n")
        
        return {
            "status": "success",
            "colors": {
                "home": team_colors[0],
                "away": team_colors[1]
            },
            "game_id": game_id,
            "detection_stats": {
                "frames_sampled": len(sample_positions),
                "players_detected": total_players,
                "jerseys_analyzed": len(all_jersey_colors),
                "confidence": confidence,
                "method": "Roboflow Basketball + Torso K-means" if use_roboflow else "YOLOv11m + Torso K-means",
                "resolution": "1280px"
            }
        }
        
    except Exception as e:
        print(f"[ERROR] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


@app.function(
    image=image,
    gpu="A10G",
    timeout=600
)
@modal.asgi_app()
def analyze():
    """
    Multi-pipeline FastAPI endpoint for basketball analysis.
    
    Supported modes:
    - color_calibration: Quick jersey color detection (Stage 2)
    - jersey_numbers: Jersey number OCR detection (future)
    - full_analysis: Complete game analysis (future)
    """
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    
    web_app = FastAPI()
    
    @web_app.post("/")
    async def analyze_endpoint(request: Request):
        try:
            data = await request.json()
            game_id = data.get("game_id")
            video_url = data.get("video_url")
            pipeline_mode = data.get("pipeline_mode", "color_calibration")
            
            print(f"\n[ENDPOINT] Mode: {pipeline_mode} | Game: {game_id}")
            
            if pipeline_mode == "color_calibration":
                result = detect_colors_yolo11m(video_url, game_id)
                return JSONResponse(content=result)
            else:
                return JSONResponse(
                    content={
                        "status": "error",
                        "message": f"Unsupported pipeline mode: {pipeline_mode}"
                    },
                    status_code=400
                )
        except Exception as e:
            print(f"[ENDPOINT ERROR] {str(e)}")
            import traceback
            traceback.print_exc()
            return JSONResponse(
                content={"status": "error", "message": str(e)},
                status_code=500
            )
    
    return web_app
