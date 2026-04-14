---
title: "Bypass GitHub Limits: Direct Modal GPU Deployment"
status: "done"
priority: "urgent"
type: "chore"
tags: ["infrastructure", "gpu", "modal"]
created_by: "agent"
created_at: "2026-04-14T16:35:00Z"
position: 75
---

## Notes:
The user is hitting GitHub Action run limits. We need a way to deploy the `modal_worker.py` directly from the development environment to Modal.

## Checklist:
- [x] Create `deploy_modal.sh` for direct terminal deployment.
- [x] Update `MODAL_SETUP_GUIDE.md` with the direct deployment command.
- [x] Add `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` validation to the script.