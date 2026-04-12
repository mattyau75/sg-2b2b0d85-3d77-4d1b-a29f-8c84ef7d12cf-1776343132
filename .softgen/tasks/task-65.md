---
title: "Replace Toast with Banner Notification System"
status: "in_progress"
priority: "high"
type: "chore"
tags: ["ui", "notifications", "banners"]
created_by: "agent"
created_at: "2026-04-12T00:50:00Z"
position: 65
---

## Notes:
Replace all `useToast` references with a persistent, closable banner notification system.

## Checklist:
- [ ] Create `DiagnosticBanner.tsx`: A reusable banner component with an "x" close button and support for different notification types (info, error, success).
- [ ] Implement `NotificationProvider`: A global context to manage active banners.
- [ ] Update `src/pages/_app.tsx`: Add the provider and global banner display.
- [ ] Replace `useToast` in `src/pages/games/[id].tsx`: Switch to banner notifications for analysis status.
- [ ] Replace `useToast` in `src/pages/roster/[id].tsx`: Switch to banner notifications for player updates.
- [ ] Replace `useToast` in `src/pages/index.tsx`: Switch to banner notifications for dashboard actions.
- [ ] Audit and replace remaining `useToast` references across the codebase.