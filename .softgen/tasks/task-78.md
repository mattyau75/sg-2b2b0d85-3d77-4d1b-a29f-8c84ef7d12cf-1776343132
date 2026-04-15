---
title: "Scout Profile & Tactical Identity"
status: "in_progress"
priority: "high"
type: "feature"
tags: ["profile", "auth", "ui"]
created_by: "agent"
created_at: "2026-04-15"
position: 78
---

## Notes:
Create a dedicated space for scouts to manage their profile details and tactical settings. Include a personalized welcome experience in the main navigation.

## Checklist:
- [ ] Create profile.tsx: Profile management page with editable fields (first name, last name, email)
- [ ] Update Layout.tsx: Add "Welcome, [Name]" badge and a tactical logout button to the header
- [ ] Create profileService.ts: Service to handle profile updates in Supabase
- [ ] Implement profile guard: Ensure users are redirected to login if they try to access the profile while logged out