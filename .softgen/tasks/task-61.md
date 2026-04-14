---
title: Implement Resumable TUS Uploads
status: in_progress
priority: high
type: feature
created_by: softgen
created_at: 2026-04-14
---

## Notes:
Upgrade the storage pipeline to use the TUS protocol for video uploads to provide resumability and real-time progress.

## Checklist:
- [ ] Re-install tus-js-client
- [ ] Update storageService.ts with uploadVideoResumable method
- [ ] Update UploadContext.tsx to handle granular progress events
- [ ] Add error handling for interrupted uploads