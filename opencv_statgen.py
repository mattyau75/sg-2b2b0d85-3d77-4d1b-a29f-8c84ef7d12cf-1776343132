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
    
    # Placeholder processing loop
    frame_count = 0
    results = {
        "game_metadata": {
            "home_team": home_team,
            "away_team": away_team,
            "total_frames": total_frames,
            "fps": fps,
            "duration_seconds": total_frames / fps if fps > 0 else 0
        },
        "box_score": {},
        "play_by_play": [],
        "shot_chart": [],
        "lineups": []
    }
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_count += 1
        
        # Update progress every 10 frames
        if frame_count % 10 == 0:
            progress = 30 + int((frame_count / total_frames) * 65)
            # Global timeline sync
            current_time = (frame_count / fps) + args.offset_seconds
            emit_progress(
                progress, 
                f"T+{current_time:.1f}s | Processing chunk {args.chunk_id}"
            )
        
        # TODO: Replace this with your actual YOLO detection and tracking logic
        # Example:
        # ball_results = ball_model.track(frame, persist=True)
        # player_results = player_model.track(frame, persist=True)
        # pose_results = pose_model(frame)
        
        time.sleep(0.01)  # Simulate processing time
    
    cap.release()
    emit_progress(95, "Finalizing statistics...")
    
    return results

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