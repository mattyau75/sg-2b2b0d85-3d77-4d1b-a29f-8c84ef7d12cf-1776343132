---
title: Implement Dry-Run Handshake Protocol
status: in_progress
priority: high
created_by: agent
created_at: 2026-04-11
position: 59
---
## Notes:
Verify end-to-end connectivity (App -> API -> GPU -> Supabase) without executing the full AI processing swarm.

## Checklist:
- [ ] Add `dry_run` flag support to `/api/process-game.ts`
- [ ] Implement `dry_run` intercept in `modal_worker.py`
- [ ] Add "Dry-Run Test" button to the Diagnostic Engine UI
- [ ] Verify telemetry feedback loop in the Technical Trace panel