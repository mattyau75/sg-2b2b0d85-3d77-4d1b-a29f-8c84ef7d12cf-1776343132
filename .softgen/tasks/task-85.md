<![CDATA[---
title: Implement Premium Heartbeat and Batch Stats Engine
status: todo
priority: high
type: feature
tags: [architecture, gpu, stats]
created_by: agent
created_at: 2026-04-17
position: 85
---

## Notes:
Optimizing the data pipeline using a Hybrid-Batch approach. The GPU will pulse logs for UI feedback but buffer heavy statistical data locally before a final migration to Supabase.

## Checklist:
- [x] Create `play_by_play` and `box_scores` tables with optimized schema
- [x] Implement `HeartbeatLink` component in `WorkerLogs.tsx`
- [ ] Update `modal_worker.py` to buffer stats and perform a single batch-insert at the end
- [ ] Add "momentum" logic to the Dashboard progress bar to prevent perceived stalls
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 858 chars.]