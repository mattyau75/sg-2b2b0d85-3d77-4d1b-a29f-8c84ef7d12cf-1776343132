---
title: Large Scale Video Pipeline
status: in_progress
priority: high
type: feature
tags: [video, storage, performance]
created_by: agent
created_at: 2026-04-08
position: 15
---

## Notes:
Implement a robust pipeline for 8GB+ video files. This includes resumable uploads and updating the GPU worker to handle long-form content via transcoding/chunking strategies.

## Checklist:
- [x] Implement Resumable (Tus) Uploads in `storageService.ts` for 8GB files
- [x] Update `NewGameModal.tsx` with chunked upload progress tracking
- [x] Refactor `modal_worker.py` for Parallel Chunking (A10G swarm)
- [x] Update `opencv_statgen.py` with `--offset-seconds` for global timeline sync
- [x] Implement `merge_results` logic for parallel boxscore aggregation