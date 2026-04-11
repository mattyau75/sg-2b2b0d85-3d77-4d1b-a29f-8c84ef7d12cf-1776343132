---
title: Implement Dynamic JWT Exchange for GPU-to-DB Auth
status: in_progress
priority: urgent
type: feature
tags: ["security", "supabase", "modal", "jwt"]
created_by: agent
created_at: 2026-04-11
position: 63
---

## Notes:
Replace static SERVICE_ROLE_KEY usage with dynamic, scoped JWTs for GPU worker authentication to improve security and reliability.

## Checklist:
- [ ] Create `src/services/jwtService.ts` to generate scoped Supabase tokens.
- [ ] Update `src/pages/api/process-game.ts` to generate and pass JWT to Modal.
- [ ] Update `modal_worker.py` to use the dynamic JWT for all Supabase interactions.
- [ ] Verify bi-directional communication via the 15% Ignition pulse.