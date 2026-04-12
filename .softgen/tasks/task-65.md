---
title: "Replace Toast with Banner Notification System"
status: "done"
priority: "medium"
type: "chore"
tags: ["ui", "refactor", "notifications"]
created_by: "agent"
created_at: "2026-04-12T00:54:00Z"
position: 65
---

## Notes:
Modernize the notification system to use a closable banner instead of disappearing toasts, providing better persistence for critical diagnostic data.

## Checklist:
- [x] Create `DiagnosticBanner.tsx`: Base component with severity levels and "X" close button.
- [x] Implement `GlobalBannerContainer`: Centralized state management for application-wide alerts.
- [x] Update `_app.tsx`: Register the global container to handle `showBanner` events.
- [x] Audit `games/[id].tsx`, `roster/[id].tsx`, and `index.tsx` for toast-to-banner conversion.
- [x] Replace `useToast` in `NewGameModal`, `EditGameTeamsModal`, and `MappingDashboard`.
- [x] Update `UploadContext` to use banners for upload progress and cancellations.