---
title: Implement Zero-Fail Handshake for GPU Worker
status: in_progress
priority: urgent
type: bug
tags: [backend, gpu, supabase]
created_by: agent
created_at: 2026-04-11
position: 52
---

## Notes:
The GPU worker is hanging at 10%. We need to ensure a robust bidirectional communication loop between Modal.com and Supabase.

## Checklist:
- [ ] Enhance modal_worker.py with robust error handling and direct Supabase PATCH updates
- [ ] Update process-game.ts to pass required environment variables to Modal
- [ ] Verify RLS policies for worker updates on 'games' table
- [ ] Implement pre-flight connectivity check in the worker