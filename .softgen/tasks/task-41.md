---
title: "Fix Cancel Upload Functionality"
status: "done"
priority: "high"
type: "bug"
tags: ["upload", "ux", "fix"]
created_by: "agent"
created_at: "2026-04-10T20:20:00Z"
---

## Notes:
The 'Cancel' button in the New Game modal either doesn't exist during upload or doesn't correctly abort the network request.

## Checklist:
- [x] Add 'Cancel Upload' button to `NewGameModal.tsx` during active upload state.
- [x] Verify `UploadContext.tsx` `cancelUpload` uses `AbortController.abort()`.
- [x] Implement cleanup logic to remove cancelled tasks from `activeUploads` state.
- [x] Add toast notification for 'Upload Cancelled'.