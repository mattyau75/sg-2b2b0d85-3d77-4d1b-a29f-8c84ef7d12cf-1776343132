---
title: "Enterprise Auth Guard & Tactical Landing"
status: "todo"
priority: "urgent"
type: "feature"
tags: ["auth", "security", "ux"]
created_by: "agent"
created_at: "2026-04-15"
position: 77
---

## Notes:
Transition the platform from a public-access tool to a secure, role-based scouting environment. This stabilizes the CORS/Authorization handshakes by providing a fixed security context.

## Checklist:
- [x] Create login.tsx: High-performance tactical login/signup page with basketball orange accents
- [x] Implement AuthGuard.tsx: Component to protect routes like /games, /roster, and /analytics
- [x] Update _app.tsx: Integrate Supabase Auth listener to manage global session state
- [x] Update index.tsx: Transform root into a professional landing page that redirects authenticated scouts to the Dashboard
- [ ] Secure R2 Bridge: Ensure presigned URLs are only generated for active authorized sessions