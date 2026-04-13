---
title: Persistent Background Uploads & Directory Progress
status: in_progress
priority: urgent
type: feature
tags: ["upload", "ui", "real-time"]
created_by: agent
created_at: 2026-04-13
position: 73
---

## Notes:
Redirect user to Games Directory immediately upon "Add Game" click. Use UploadContext to track background progress and display live bars in the Directory UI.

## Checklist:
- [ ] Refactor NewGameModal.tsx to use non-blocking background upload + immediate redirect
- [ ] Update src/contexts/UploadContext.tsx to support persistent background tracking
- [ ] Implement "Active Uploads" section in src/pages/games/index.tsx
- [ ] Enhance GameCard UI with real-time progress indicators