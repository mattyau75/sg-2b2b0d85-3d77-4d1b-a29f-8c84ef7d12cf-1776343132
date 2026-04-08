---
title: Robust Background Uploads
status: in_progress
priority: urgent
type: feature
tags: [storage, ux]
created_by: agent
created_at: 2026-04-08
position: 18
---

## Notes:
Ensure 8GB+ video uploads continue even if the user closes the modal or navigates away.

## Checklist:
- [x] Create UploadContext.tsx to manage global upload state and background tasks
- [x] Update Layout.tsx to include the UploadProvider
- [x] Refactor NewGameModal.tsx to delegate upload to the global context
- [x] Trigger immediate redirect to /analysis-queue upon upload start