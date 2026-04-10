import argparse
import json
import os
import sys
import cv2
import numpy as np
import tempfile
from pathlib import Path
from collections import Counter
import yt_dlp
from ultralytics import YOLO

def emit_progress(progress: int, msg: str = ""):
    print(json.dumps({"__progress": progress, "__msg": msg}), flush=True)

def emit_error(error_msg: str):
    print(json.dumps({"__error": error_msg}), flush=True)

def emit_result(result: dict):
    print(json.dumps({"__result": result}), flush=True)

class TemporalIdentityEngine:
    """
    The 'Elite' Mapping Engine.
    Uses multi-frame consensus (Temporal Voting) to resolve identities.
    """
    def __init__(self, roster_home, roster_away):
        self.roster_home = {str(p['number']): p for p in roster_home}
        self.roster_away = {str(p['number']): p for p in roster_away}
        self.votes = {} # track_id -> Counter(jersey_numbers)
        self.confirmed_identities = {} # track_id -> {player_id, team_id, number}

    def add_vote(self, track_id, jersey_number, team_hint):
        if track_id not in self.votes:
            self.votes[track_id] = Counter()
        
        # Only vote for numbers actually in the roster
        valid_roster = self.roster_home if team_hint == 'home' else self.roster_away
        if str(jersey_number) in valid_roster:
            self.votes[track_id][str(jersey_number)] += 1

    def resolve(self, track_id):
        if track_id in self.confirmed_identities:
            return self.confirmed_identities[track_id]
        
        if track_id in self.votes:
            most_common = self.votes[track_id].most_common(1)
            if most_common and most_common[0][1] > 5: # Threshold for consensus
                number = most_common[0][0]
                # In a real scenario, we'd determine team_hint from shirt color
                # For now, we'll try to find it in either roster
                if number in self.roster_home:
                    self.confirmed_identities[track_id] = {**self.roster_home[number], "team": "home"}
                elif number in self.roster_away:
                    self.confirmed_identities[track_id] = {**self.roster_away[number], "team": "away"}
                
                return self.confirmed_identities.get(track_id)
        return None

def process_video_elite(args):
    emit_progress(10, "Initializing Elite AI Vision Engines...")
    
    # Load Models (Pre-baked in Modal image)
    model = YOLO("yolo11m.pt") # Upgraded to Medium for better small-object detection
    
    # Download Video
    output_path = str(Path(tempfile.gettempdir()) / f"game_{args.chunk_id}.mp4")
    ydl_opts = {'format': 'best[ext=mp4]/best', 'outtmpl': output_path, 'quiet': True}
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([args.url])
    
    cap = cv2.VideoCapture(output_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    # Initialize Engines
    home_roster = json.loads(args.home_roster)
    away_roster = json.loads(args.away_roster)
    identity_engine = TemporalIdentityEngine(home_roster, away_roster)
    
    play_by_play = []
    frame_count = 0
    
    emit_progress(30, "Analyzing frames and extracting tracking vectors...")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        
        frame_count += 1
        if frame_count % 3 != 0: continue # Adaptive sampling for speed

        # 1. Detection & Tracking
        results = model.track(frame, persist=True, classes=[0], verbose=False) # Only players (class 0)
        
        if results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            track_ids = results[0].boxes.id.cpu().numpy().astype(int)
            
            for box, track_id in zip(boxes, track_ids):
                # 2. High-Res ROI Crop (Torso Area)
                x1, y1, x2, y2 = map(int, box)
                torso_h = (y2 - y1) // 3
                crop = frame[y1:y1+torso_h*2, x1:x2] # Focus on upper 2/3rds
                
                if crop.size > 0:
                    # Digital Zoom (3x resolution for small jersey recognition)
                    zoom = cv2.resize(crop, (crop.shape[1]*3, crop.shape[0]*3), interpolation=cv2.INTER_CUBIC)
                    
                    # 3. Simulate OCR/Number Detection (Mock for current sandbox logic)
                    # In production, we'd pass 'zoom' to Tesseract or a secondary YOLO number model
                    # For this demo, we're mapping based on the Temporal Identity Engine
                    
                    identity = identity_engine.resolve(track_id)
                    if identity:
                        # Log a detected presence/event every few seconds
                        if frame_count % (fps * 10) == 0:
                            play_by_play.append({
                                "game_id": args.game_id,
                                "player_id": identity.get('id'),
                                "jersey_number": identity['number'],
                                "event_type": "PRESENCE",
                                "description": f"{identity['name']} (# {identity['number']}) active on court",
                                "timestamp_seconds": int(args.offset_seconds + (frame_count / fps))
                            })

        if frame_count % (fps * 30) == 0:
            progress = 30 + int((frame_count / cap.get(cv2.CAP_PROP_FRAME_COUNT)) * 60)
            emit_progress(progress, f"Processed {int(frame_count/fps)}s of footage...")

    cap.release()
    os.remove(output_path)
    
    emit_result({
        "play_by_play": play_by_play,
        "mapped_ids": list(identity_engine.confirmed_identities.keys())
    })

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--game-id", required=True)
    parser.add_argument("--offset-seconds", type=float, default=0.0)
    parser.add_argument("--chunk-id", type=int, default=0)
    parser.add_argument("--home-roster", required=True)
    parser.add_argument("--away-roster", required=True)
    args = parser.parse_args()
    
    try:
        process_video_elite(args)
    except Exception as e:
        emit_error(str(e))
        sys.exit(1)