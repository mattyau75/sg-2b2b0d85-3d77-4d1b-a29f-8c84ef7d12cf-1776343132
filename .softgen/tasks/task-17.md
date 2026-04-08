---
title: Migrate Storage to Cloudflare R2
status: done
priority: urgent
type: feature
tags: [storage, r2, cloudflare, cost-optimization]
created_by: agent
created_at: 2026-04-08
position: 17
---

## Notes:
Switch from Supabase Storage to Cloudflare R2 for zero-egress cost handling of large 8GB video files. Uses S3-compatible AWS SDK.

## Checklist:
- [x] Install `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
- [x] Implement `r2Client.ts` utility for shared access
- [x] Rewrite `storageService.ts` for R2 uploads and signed URLs
- [x] Update `api/process-game.ts` to handle R2 signed URL generation
- [x] Update `pages/games/[id].tsx` to fetch R2 video links