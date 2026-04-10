---
title: Upgrade Game Detail to Supabase Realtime
status: in_progress
priority: high
type: feature
tags: ["supabase", "realtime", "ux"]
created_by: agent
created_at: 2026-04-10
position: 32
---

## Notes:
Replace the 10-second polling interval with a Supabase Realtime subscription on the specific game row. This provides instant feedback for the GPU analysis process and makes the tactical terminal feel alive.

## Checklist:
- [x] Initialize Supabase Realtime subscription in GameDetail useEffect
- [x] Update state immediately when row changes are detected
- [x] Remove the legacy 10-second polling interval
- [x] Add visual "Live Connection" indicator to the UI