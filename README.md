# CourtVision Elite 🏀

High-performance basketball scouting and analytics platform for professional-grade game analysis.

## 🚀 Key Features
- **Elite Video Pipeline**: Process 8GB, 1080p, 60-minute games in minutes using Parallel GPU Swarms on Modal.com.
- **Resumable Storage**: Secure video storage with 500MB+ upload support via Tus-js-client.
- **Interactive Shot Charts**: Dynamic visualization of player and team shooting efficiency.
- **Advanced Box Scores**: Live-updating metrics including AI-generated highlights and chronological play-by-play.
- **Multi-Source Support**: Analyze both YouTube URLs and direct local video uploads.

## 🛠 Tech Stack
- **Frontend**: Next.js 15 (Page Router), Tailwind CSS, Shadcn/UI, Lucide Icons, Recharts.
- **Backend**: Supabase (Auth, Database, Storage).
- **GPU Processing**: Python (OpenCV, YOLO11, yt-dlp) running on Modal.com A10G GPU nodes.

## 📦 Project Structure
- `src/components`: UI components including specialized `Court`, `ShotChart`, and `VideoPlayer`.
- `src/services`: Integration services for Modal.com, Supabase Storage, and Roster management.
- `src/pages/games/[id].tsx`: The core analysis dashboard for detailed game review.
- `modal_worker.py`: The orchestrator for parallel GPU processing chunks.

## 📝 Setup
1. Configure `.env.local` with Supabase and Modal.com credentials.
2. Deploy the Modal worker: `modal deploy modal_worker.py`.
3. Create the `game-videos` bucket in Supabase Storage.
4. Export YouTube cookies to a Modal secret for YouTube support.

© 2026 CourtVision Elite. All rights reserved.