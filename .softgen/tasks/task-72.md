---
title: Deterministic Pipeline UI & Mapping Engine
status: done
priority: urgent
type: feature
tags: ["ui", "workflow", "mapping"]
created_by: agent
created_at: 2026-04-13
position: 72
---

## Notes:
Implement the full 4-module interactive workflow on the Game Detail page. Ensure strict manual gating between modules (Payload -> Ignition -> Analysis -> Mapping).

## Checklist:
- [x] Implement Module 01: Payload Calibration (Metadata verification & R2 check)
- [x] Implement Module 02: GPU Swarm Ignition (Manual handshake trigger)
- [x] Implement Module 03: Analysis Stream (Live progress & terminal trace)
- [x] Implement Module 04: Mapping & Finalization (Transition to Roster Personnel)
- [x] Update src/components/MappingDashboard.tsx for UUID & Raw Entity support
- [x] Final UI polish and validation