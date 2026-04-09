#!/usr/bin/env python3
"""
OpenCV Basketball Stats Generator with yt-dlp Cookie Support
============================================================
This script processes basketball game videos and generates detailed statistics
using YOLO object detection and OCR.

Usage:
    python opencv_statgen.py --url <VIDEO_URL> --home "Lakers" --away "Celtics" \
        --home-roster '[{"name":"LeBron","number":"23"}]' \
        --away-roster '[{"name":"Tatum","number":"0"}]' \
        --cookies cookies.txt
"""

import argparse
import json
import sys
import tempfile
import os
from pathlib import Path
import cv2
import time
import numpy as np
from concurrent.futures import ThreadPoolExecutor

def emit_progress(progress: int, msg: str = ""):
    """Emit progress update in JSON-line format"""
    print(json.dumps({"__progress": progress, "__msg": msg}), flush=True)

def emit_error(error_msg: str):
    """Emit error in JSON-line format"""
    print(json.dumps({"__error": error_msg}), flush=True)

def emit_result(result: dict):
    """Emit final result in JSON-line format"""
    print(json.dumps({"__result": result}), flush=True)

def download_video(url: str, cookies_file: str = None, cookies_browser: str = None) -> str:
    """
    Download video using yt-dlp with cookie support
    
    Args:
        url: Video URL (YouTube, Vimeo, or direct link)
        cookies_file: Path to cookies.txt file (Netscape format)
        cookies_browser: Browser name to extract cookies from ('chrome', 'firefox', etc.)
    
    Returns:
        Path to downloaded video file
    """
    import yt_dlp
    
    emit_progress(5, "Downloading video...")
    
    output_path = str(Path(tempfile.gettempdir()) / "basketball_game.mp4")
    
    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'outtmpl': output_path,
        'quiet': False,
        'no_warnings': False,
    }
    
    # Add cookie authentication if provided
    if cookies_file:
        if not os.path.exists(cookies_file):
            raise FileNotFoundError(f"Cookies file not found: {cookies_file}")
        ydl_opts['cookiefile'] = cookies_file
        print(f"Using cookies file: {cookies_file}", file=sys.stderr)
    elif cookies_browser:
        ydl_opts['cookiesfrombrowser'] = (cookies_browser,)
        print(f"Extracting cookies from browser: {cookies_browser}", file=sys.stderr)
    else:
        print("WARNING: No cookies provided - YouTube videos may fail", file=sys.stderr)
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        
        if not os.path.exists(output_path):
            raise FileNotFoundError("Video download failed - file not created")
        
        emit_progress(15, "Video downloaded successfully")
        return output_path
    
    except Exception as e:
        error_msg = f"Video download failed: {str(e)}"
        emit_error(error_msg)
        raise

class PlayerTracker:
    """ByteTrack-inspired tracker to maintain ID consistency during pans."""
    def __init__(self, iou_thresh=0.3, max_age=30):
        self.iou_thresh = iou_thresh
        self.max_age = max_age
        self.tracks = [] # List of {id, bbox, color, age, velocity}
        self.next_id = 1

    def _iou(self, boxA, boxB):
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])
        interArea = max(0, xB - xA) * max(0, yB - yA)
        boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
        boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
        return interArea / float(boxAArea + boxBArea - interArea)

    def update(self, detections):
        """
        detections: list of [x1, y1, x2, y2, conf, cls, color_vector]
        returns: list of [x1, y1, x2, y2, track_id, color_vector]
        """
        # 1. Predict (Simple linear motion)
        for t in self.tracks:
            t['age'] += 1
            if 'velocity' in t:
                t['bbox'][0] += t['velocity'][0]
                t['bbox'][1] += t['velocity'][1]
                t['bbox'][2] += t['velocity'][0]
                t['bbox'][3] += t['velocity'][1]

        matched_tracks = []
        unmatched_detections = list(range(len(detections)))

        # 2. Match based on IOU
        if self.tracks and detections:
            ious = np.zeros((len(self.tracks), len(detections)))
            for i, t in enumerate(self.tracks):
                for j, d in enumerate(detections):
                    ious[i, j] = self._iou(t['bbox'], d[:4])

            # Greedy matching
            for i in range(len(self.tracks)):
                best_j = np.argmax(ious[i])
                if ious[i, best_j] > self.iou_thresh:
                    t = self.tracks[i]
                    d = detections[best_j]
                    
                    # Update velocity
                    dx = d[0] - t['bbox'][0]
                    dy = d[1] - t['bbox'][1]
                    t['velocity'] = [dx, dy]
                    
                    t['bbox'] = d[:4]
                    t['age'] = 0
                    t['color'] = d[6] if len(d) > 6 else t['color']
                    matched_tracks.append(i)
                    if best_j in unmatched_detections:
                        unmatched_detections.remove(best_j)

        # 3. Handle unmatched
        # Create new tracks for high-confidence detections
        for j in unmatched_detections:
            d = detections[j]
            if d[4] > 0.5: # Confidence threshold
                self.tracks.append({
                    'id': self.next_id,
                    'bbox': d[:4],
                    'color': d[6] if len(d) > 6 else None,
                    'age': 0,
                    'velocity': [0, 0]
                })
                self.next_id += 1

        # 4. Cleanup stale tracks
        self.tracks = [t for i, t in enumerate(self.tracks) if t['age'] < self.max_age]
        
        return [[*t['bbox'], t['id'], t['color']] for t in self.tracks if t['age'] == 0]

class AnalyticsEngine:
    """Streamlined engine for parallel metric calculation."""
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=4)

    def process_event(self, event_data):
        """Asynchronously calculate advanced metrics for a detected event."""
        # e.g., Shot distance, player spacing, defensive pressure
        return self.executor.submit(self._calculate_metrics, event_data)

    def _calculate_metrics(self, data):
        # Heavy math here...
        time.sleep(0.01) # Simulated complexity
        return {**data, "distance": 24.5, "contested": True}

def process_video(video_path: str, home_team: str, away_team: str, 
                  home_roster: list, away_roster: list) -> dict:
    """
    Process basketball video and extract statistics
    
    This is a placeholder - replace with your actual OpenCV/YOLO processing logic
    """
    import cv2
    import time
    
    emit_progress(20, "Loading YOLO models...")
    
    # Placeholder: Load your YOLO models here
    # from ultralytics import YOLO
    # ball_model = YOLO('yolo11m.pt')
    # player_model = YOLO('yolo11n.pt')
    # pose_model = YOLO('yolo11n-pose.pt')
    
    emit_progress(25, "Initializing video processing...")
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Failed to open video: {video_path}")
    
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    emit_progress(30, f"Processing {total_frames} frames at {fps:.1f} FPS...")
    
    tracker = PlayerTracker(max_age=int(fps)) # 1 second memory
    analytics = AnalyticsEngine()
    
    # Streamlined loop
    for frame_id in range(0, total_frames, 2): # Adaptive sampling
        # ... detection logic ...
        # analytics.process_event(detected_shot)
    
    cap.release()
    emit_progress(95, "Finalizing statistics...")
    
    return results

def process_video_elite(video_path: str, home_color: str, away_color: str):
    """
    Optimized for local file processing (the foolproof way).
    """
    print(f"🚀 Processing Local Video: {video_path}")
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        raise Exception("Fatal: Could not open local video file.")
        
    # High-accuracy tracking logic here...
    # (Matches your White and Navy Blue team colors)

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--home", default="Home")
    parser.add_argument("--away", default="Away")
    parser.add_argument("--offset-seconds", type=float, default=0.0, help="Start time offset for chunked processing")
    parser.add_argument("--chunk-id", type=int, default=0)
    parser.add_argument("--home-roster", required=True, help="Home roster JSON")
    parser.add_argument("--away-roster", required=True, help="Away roster JSON")
    parser.add_argument("--cookies", help="Path to cookies.txt file for yt-dlp")
    parser.add_argument("--cookies-from-browser", help="Browser to extract cookies from (chrome, firefox, etc.)")
    return parser.parse_args()

def main():
    args = parse_args()
    # When emitting play-by-play, add offset-seconds to current frame time
    # This ensures the global timeline is correct
    
    try:
        # Parse roster data
        home_roster = json.loads(args.home_roster)
        away_roster = json.loads(args.away_roster)
        
        emit_progress(0, "Starting video processing...")
        
        # Download video with cookie support
        video_path = download_video(
            args.url, 
            cookies_file=args.cookies,
            cookies_browser=args.cookies_from_browser
        )
        
        # Process video
        results = process_video(
            video_path, 
            args.home, 
            args.away,
            home_roster,
            away_roster
        )
        
        # Emit final result
        emit_result(results)
        
        # Cleanup
        if os.path.exists(video_path):
            os.remove(video_path)
        
        sys.exit(0)
    
    except Exception as e:
        emit_error(str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()