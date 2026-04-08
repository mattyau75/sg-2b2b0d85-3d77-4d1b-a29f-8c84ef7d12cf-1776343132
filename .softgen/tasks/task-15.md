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
- [ ] Implement Resumable (Tus) Uploads in `storageService.ts` for 8GB files
- [ ] Update `NewGameModal.tsx` with chunked upload progress tracking
- [ ] Create `ffmpegService.ts` (Next.js API) for initial video probing/metadata
- [ ] Update `modal_worker.py` to support "Proxy Transcoding" (CPU-first step)
- [ ] Optimize `opencv_statgen.py` for long-running processes (checkpointing)