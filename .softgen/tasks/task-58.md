---
title: Fix GPU Metadata Discrepancy & Align Schema
status: in_progress
priority: urgent
created_by: agent
created_at: 2026-04-11
position: 58
---
## Notes:
Resolve the "Missing required game metadata" error by aligning field names between the Next.js API, Supabase, and the Modal.com Python worker.

## Checklist:
- [ ] Align `video_path` and `game_id` keys in `process-game.ts`
- [ ] Update `modal_worker.py` to accept the aligned metadata structure
- [ ] Perform a full pre-flight validation of the JSON payload
- [ ] Verify Supabase RPC function `append_worker_log` parameters match