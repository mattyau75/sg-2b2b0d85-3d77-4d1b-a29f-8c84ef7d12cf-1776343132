import modal
import os

# MODAL_ELITE_PIPELINE v7.0 - Basketball Scouting AI
# Fixed Syntax, Aligned Schema, Robust Error Handling

app = modal.App("basketball-scout-ai")

# Persistent volume for 24h video caching + YOLO weights
volume = modal.Volume.from_name("basketball-cache", create_if_missing=True)

# Container image with YOLO11m pre-installed
image = (
    modal.Image.from_registry("ultralytics/ultralytics:latest")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "fastapi[standard]",
        "requests",
        "opencv-python-headless",
        "numpy",
        "supabase",
        "boto3"
    )
)

# ============================================================================
# STAGE 2: JERSEY CALIBRATION & TEAM ASSIGNMENT
# ============================================================================
def stage2_calibration(video_url: str, game_id: str):
    """Extract team colors from first 5 minutes of footage"""
    import cv2
    import numpy as np
    import requests
    import base64
    from supabase import create_client
    
    print(f"[STAGE 2] Calibrating colors for game {game_id}")
    
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    api_key = os.environ.get("ROBOFLOW_API_KEY")

    if not all([supabase_url, supabase_key, api_key]):
        return {"status": "error", "message": "Missing required API keys in Modal environment"}

    try:
        supabase = create_client(supabase_url, supabase_key)
        
        # Update processing queue
        supabase.table("processing_queue").upsert({
            "game_id": game_id,
            "stage": "stage2_calibration",
            "status": "in_progress",
            "started_at": "now()"
        }).execute()
        
        try:
            model_id = "basketball-jersey-numbers-ocr/2"
            inference_url = f"https://detect.roboflow.com/{model_id}?api_key={api_key}"
            
            cap = cv2.VideoCapture(video_url)
            if not cap.isOpened():
                raise Exception("Video source unreachable")
            
            fps = cap.get(cv2.CAP_PROP_FPS) or 30
            sample_points = [int(fps * s) for s in range(5, 305, 10)]
            
            all_jersey_colors = []
            
            for frame_idx in sample_points:
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                ret, frame = cap.read()
                if not ret: continue
                
                h, w = frame.shape[:2]
                target_w = 1280
                target_h = int(h * (target_w / w))
                frame_resized = cv2.resize(frame, (target_w, target_h))
                
                _, buffer = cv2.imencode('.jpg', frame_resized)
                img_base64 = base64.b64encode(buffer).decode('utf-8')
                
                try:
                    res = requests.post(
                        f"{inference_url}&confidence=15",
                        data=img_base64,
                        headers={"Content-Type": "application/x-www-form-urlencoded"},
                        timeout=4
                    )
                    preds = res.json().get('predictions', [])
                    
                    for pred in preds:
                        x, y, pw, ph = pred['x'], pred['y'], pred['width'], pred['height']
                        x1, y1 = int(x - pw/5), int(y - ph/5)
                        x2, y2 = int(x + pw/5), int(y + ph/5)
                        
                        crop = frame_resized[max(0, y1):min(target_h, y2), max(0, x1):min(target_w, x2)]
                        if crop.size < 15: continue
                        
                        pixels = crop.reshape(-1, 3).astype(np.float32)
                        _, _, centers = cv2.kmeans(pixels, 2, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 5, 1.0), 5, cv2.KMEANS_PP_CENTERS)
                        
                        for center in centers:
                            b, g, r = center
                            saturation = max(r, g, b) - min(r, g, b)
                            is_court = (r > 130 and g > 100 and abs(r-g) < 45 and saturation < 65)
                            if not is_court:
                                all_jersey_colors.append([r, g, b])
                except: continue
                
                if len(all_jersey_colors) >= 30: break
            
            cap.release()
            
            if len(all_jersey_colors) < 2:
                raise Exception("Insufficient jersey samples detected")
            
            _, _, final_centers = cv2.kmeans(
                np.array(all_jersey_colors, dtype=np.float32), 2, None, 
                (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0), 10, cv2.KMEANS_PP_CENTERS
            )
            
            sorted_centers = sorted(final_centers.tolist(), key=lambda c: sum(c), reverse=True)
            home_hex = f"#{int(sorted_centers[0][0]):02x}{int(sorted_centers[0][1]):02x}{int(sorted_centers[0][2]):02x}"
            away_hex = f"#{int(sorted_centers[1][0]):02x}{int(sorted_centers[1][1]):02x}{int(sorted_centers[1][2]):02x}"
            
            supabase.table("game_config").upsert({
                "game_id": game_id,
                "home_color_hex": home_hex,
                "away_color_hex": away_hex,
                "calibration_method": "auto"
            }).execute()
            
            supabase.table("processing_queue").update({
                "status": "completed",
                "completed_at": "now()",
                "metadata": {"home_color": home_hex, "away_color": away_hex}
            }).eq("game_id", game_id).eq("stage", "stage2_calibration").execute()
            
            return {"status": "success", "colors": {"home": home_hex, "away": away_hex}}
            
        except Exception as e:
            supabase.table("processing_queue").update({
                "status": "failed", "completed_at": "now()", "error_message": str(e)
            }).eq("game_id", game_id).eq("stage", "stage2_calibration").execute()
            return {"status": "error", "message": str(e)}

    except Exception as e:
        return {"status": "error", "message": f"Global failure: {str(e)}"}


# ============================================================================
# STAGE 3: RAW DATA GENERATION (INFERENCE ENGINE)
# ============================================================================
def stage3_inference(video_url: str, game_id: str):
    """Multi-model inference with YOLO11m + Roboflow + ByteTrack"""
    import cv2
    import numpy as np
    from ultralytics import YOLO
    from supabase import create_client
    import boto3
    import requests
    import base64
    
    print(f"[STAGE 3] Starting inference for game {game_id}")
    
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    api_key = os.environ.get("ROBOFLOW_API_KEY")
    
    if not all([supabase_url, supabase_key, api_key]):
        return {"status": "error", "message": "Missing credentials"}

    try:
        supabase = create_client(supabase_url, supabase_key)
        
        # Update queue
        supabase.table("processing_queue").upsert({
            "game_id": game_id, "stage": "stage3_inference", "status": "in_progress", "started_at": "now()"
        }).execute()

        try:
            model_path = "/data/yolo11m.pt"
            try: model = YOLO(model_path)
            except:
                model = YOLO("yolo11m.pt")
                model.save(model_path)
            
            config = supabase.table("game_config").select("*").eq("game_id", game_id).single().execute()
            if not config.data: raise Exception("Run Stage 2 first")
            
            home_color = np.array([int(config.data["home_color_hex"][i:i+2], 16) for i in (1, 3, 5)])
            away_color = np.array([int(config.data["away_color_hex"][i:i+2], 16) for i in (1, 3, 5)])
            
            cap = cv2.VideoCapture(video_url)
            fps = cap.get(cv2.CAP_PROP_FPS) or 30
            frame_number = 0
            
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret: break
                
                frame_number += 1
                if frame_number % 5 != 0: continue # Process every 5th frame for speed
                
                timestamp_ms = int((frame_number / fps) * 1000)
                results = model.track(frame, classes=[0, 32], conf=0.3, imgsz=1280, persist=True, verbose=False)
                
                for r in results:
                    boxes = r.boxes
                    if not boxes: continue
                    for box in boxes:
                        cls, track_id = int(box.cls[0]), int(box.id[0]) if box.id is not None else None
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        
                        if cls == 0 and track_id: # Person
                            torso_y1, torso_y2 = int(y1 + (y2-y1)*0.2), int(y1 + (y2-y1)*0.6)
                            torso = frame[torso_y1:torso_y2, int(x1):int(x2)]
                            if torso.size < 100: continue
                            
                            pixels = torso.reshape(-1, 3).astype(np.float32)
                            _, _, centers = cv2.kmeans(pixels, 1, None, (cv2.TERM_CRITERIA_EPS, 5, 1.0), 3, cv2.KMEANS_PP_CENTERS)
                            dom = centers[0][::-1]
                            team_side = "home" if np.linalg.norm(dom - home_color) < np.linalg.norm(dom - away_color) else "away"
                            
                            supabase.table("raw_events").insert({
                                "game_id": game_id, "frame_number": frame_number, "timestamp_ms": timestamp_ms,
                                "event_type": "tracking", "ai_track_id": str(track_id), "team_side": team_side,
                                "x_coord": (x1+x2)/2, "y_coord": (y1+y2)/2
                            }).execute()
            
            cap.release()
            supabase.table("processing_queue").update({
                "status": "completed", "completed_at": "now()", "metadata": {"frames": frame_number}
            }).eq("game_id", game_id).eq("stage", "stage3_inference").execute()
            
            return {"status": "success", "frames": frame_number}

        except Exception as e:
            supabase.table("processing_queue").update({
                "status": "failed", "error_message": str(e)
            }).eq("game_id", game_id).eq("stage", "stage3_inference").execute()
            return {"status": "error", "message": str(e)}

    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.function(
    image=image, gpu="A10G", timeout=3600, volumes={"/data": volume},
    secrets=[
        modal.Secret.from_dict({
            "NEXT_PUBLIC_SUPABASE_URL": os.environ.get("NEXT_PUBLIC_SUPABASE_URL", ""),
            "NEXT_PUBLIC_SUPABASE_ANON_KEY": os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""),
            "ROBOFLOW_API_KEY": os.environ.get("ROBOFLOW_API_KEY", "oyGufxqxrSK33efrhQBb")
        })
    ]
)
@modal.asgi_app()
def process():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    web_app = FastAPI()
    
    @web_app.post("/")
    async def endpoint(request: Request):
        try:
            data = await request.json()
            game_id = data.get("game_id") or data.get("gameId")
            video_url = data.get("video_url") or data.get("videoUrl")
            mode = data.get("pipeline_mode")
            
            if mode == "ping": return {"status": "warm"}
            if not all([game_id, video_url]): return JSONResponse({"error": "Missing params"}, 400)
            
            if mode in ["stage2_calibration", "color_calibration"]:
                return stage2_calibration(video_url, game_id)
            if mode in ["stage3_inference", "analyze"]:
                return stage3_inference(video_url, game_id)
            
            return JSONResponse({"error": "Invalid mode"}, 400)
        except Exception as e:
            return JSONResponse({"error": str(e)}, 500)
    return web_app
