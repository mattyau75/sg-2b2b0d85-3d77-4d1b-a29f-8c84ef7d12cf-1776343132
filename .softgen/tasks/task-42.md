---
title: "Multi-Step Elite Game Initialization"
status: "in_progress"
priority: "high"
type: "feature"
tags: ["ui", "ux", "workflow", "metadata"]
created_by: "agent"
created_at: "2026-04-10T20:58:00Z"
---

## Notes:
Transform the New Game workflow into a two-step process: (1) Rapid Video Upload and (2) Elite Metadata & Calibration. Includes color analysis, venue memory, and scoreboard ground truth.

## Checklist:
- [ ] Create `Step1UploadModal.tsx`: High-density upload interface with progress & cancel.
- [ ] Create `Step2MetadataModal.tsx`: Comprehensive game setup with color calibration.
- [ ] Implement `venues` service: Auto-populating searchable dropdown for game locations.
- [ ] Add Color Calibration API: Endpoint to extract dominant colors from video frames.
- [ ] Implement Manual Scoreboard: Persistent fields for actual game results.
- [ ] Wire multi-step logic: Auto-transition from Step 1 to Step 2 upon upload success.