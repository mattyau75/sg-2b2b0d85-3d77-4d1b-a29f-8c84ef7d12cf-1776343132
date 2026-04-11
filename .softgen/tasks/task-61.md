---
title: Module 2 Strict Manual Control & Handshake Diagnostics
status: in_progress
priority: urgent
type: bug
tags: ["gpu", "handshake", "manual-ignition"]
created_by: agent
created_at: 2026-04-11
---

## Notes:
- Fix auto-start after publish by isolating database status from client-side ignition logic.
- Add "Verify Swarm Handshake" button to Diagnostic Engine.
- Implement bottleneck detection banners for failed handshakes.

## Checklist:
- [x] Implement `manual_start_requested` state guard in `games/[id].tsx`
- [x] Add "Verify Swarm Handshake" button to Diagnostic Engine UI
- [x] Update `/api/process-game` to support lightweight handshake verification
- [x] Implement bottleneck-aware banner notifications for handshake failures
- [x] Verify `ignition_status` real-time badge updates