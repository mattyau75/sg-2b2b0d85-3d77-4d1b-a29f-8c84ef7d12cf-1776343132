---
title: Resolve GPU Provisioning Progress Hang
status: in_progress
priority: urgent
type: bug
tags: ["gpu", "handshake", "telemetry"]
created_by: agent
created_at: 2026-04-11
position: 1
---

## Notes:
System hangs at 10% (INIT) because the GPU worker cannot update progress. Likely due to missing/invalid SERVICE_ROLE_KEY in Modal Secrets or a failed volume mount.

## Checklist:
- [ ] Add explicit `SERVICE_ROLE_KEY` validation check in `modal_worker.py`
- [ ] Implement a "Provisioning Heartbeat" in the worker to update progress immediately upon container start
- [ ] Add a "Stuck Progress" diagnostic alert to the UI for 120s+ inactivity
- [ ] Verify `append_worker_log` RPC connectivity