# Dual-Mode Video Processing - Implementation Progress

**Date**: 2026-05-01
**Status**: Frontend UI Complete, Backend Integration Pending

## Overview

Successfully implemented dual-mode video processing system that allows users to choose between:
1. **Sports Analysis Mode**: AI automatically detects player moments and key highlights
2. **Short-form Clipping Mode**: Manual segment selection with custom aspect ratios and captions

## ✅ Completed Features

### 1. Database Schema (Migration Created)
**File**: `supabase/migrations/20260501000000_dual_mode_clips.sql`

Added columns to support dual-mode processing:
- `videos.processing_mode`: Track video processing workflow
- `clips.processing_mode`: Track how each clip was generated
- `clips.segment_start` / `segment_end`: Manual segment selection for short-form
- Updated `aspect_ratio` constraint to support: `1:1`, `4:5`, `9:16`, `16:9`

**Note**: Migration file created but needs to be applied to Supabase database.

### 2. TypeScript Types
**File**: `frontend/src/types/video.ts`

Added shared type definitions:
```typescript
export type ProcessingMode = 'sports_analysis' | 'short_form'
export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9'
```

Updated interfaces:
- `VideoRecord`: Added `processing_mode` field
- `ClipRecord`: Added `processing_mode`, `segment_start`, `segment_end` fields

### 3. Upload Interface
**File**: `frontend/src/pages/Upload.tsx`

Implemented beautiful UI components:

**Processing Mode Selector**:
- Two-card layout with icons (Sparkles for AI, Scissors for manual)
- Visual indication of selected mode
- Clear descriptions of each workflow

**Aspect Ratio Picker** (Short-form mode only):
- 4-button grid for quick selection
- Platform-specific labels:
  - 1:1 → Instagram posts
  - 4:5 → Instagram feed
  - 9:16 → Stories, Reels, TikTok
  - 16:9 → YouTube, Twitter

**Backend Integration**:
- All upload methods pass `processingMode` and `aspectRatio` to Edge Functions
- Handles file upload, URL upload, and batch upload

## 🚧 Remaining Work

### 1. Apply Database Migration
```bash
# Navigate to Supabase Dashboard
# Go to SQL Editor
# Copy content from: supabase/migrations/20260501000000_dual_mode_clips.sql
# Execute the migration
```

### 2. Update Edge Functions

**Files to modify**:
- `supabase/functions/upload-video/index.ts`
- `supabase/functions/generate-clips/index.ts`
- `supabase/functions/poll-clip-jobs/index.ts`

**Changes needed**:
1. Accept `processingMode` and `aspectRatio` from upload request
2. Store in `videos` table
3. Pass to Reka API based on mode:
   - **Sports Analysis**: Full video analysis with player tracking
   - **Short-form**: Segment-based processing with custom aspect ratio

### 3. Segment Selector Component

**New file**: `frontend/src/components/video/SegmentSelector.tsx`

Features needed:
- Video timeline with playback controls
- Draggable start/end markers
- Time display (MM:SS format)
- Visual preview of selected segment
- Integrate with VideoDetail page

### 4. VideoDetail Page Updates

**File**: `frontend/src/pages/VideoDetail.tsx`

Updates needed:
- Display processing mode badge
- Show segment selector for short-form mode
- Update clip generation UI based on mode
- Handle aspect ratio selection per clip

### 5. Reka API Integration

**File**: `supabase/functions/_shared/reka-client.ts`

Update API calls:
- Pass aspect ratio to Reka
- Handle different analysis types based on mode
- Update clip metadata structure

## Testing Checklist

Once backend is complete:

- [ ] Upload video in Sports Analysis mode
- [ ] Verify AI detects highlights automatically
- [ ] Upload video in Short-form mode
- [ ] Select segment using timeline
- [ ] Choose aspect ratio (test all 4)
- [ ] Generate clip with custom settings
- [ ] Verify clip exports with correct aspect ratio
- [ ] Test batch upload with mixed modes
- [ ] Verify database stores all fields correctly

## UI Screenshots Needed

After migration is applied:
1. Upload page with mode selector
2. Aspect ratio picker (short-form mode)
3. Segment selector component
4. VideoDetail with dual-mode support

## Next Steps

**Immediate**:
1. Apply database migration via Supabase Dashboard
2. Update Edge Functions to handle new fields
3. Test upload flow end-to-end

**Next session**:
1. Build SegmentSelector component
2. Integrate into VideoDetail page
3. Update Reka API client
4. Full end-to-end testing

## Architecture Diagrams

### Sports Analysis Flow
```
Upload Video → Set Mode: Sports Analysis → Reka AI Analysis
→ Auto-detect Highlights → Generate Clips → Export (9:16)
```

### Short-form Flow
```
Upload Video → Set Mode: Short-form → Choose Aspect Ratio
→ Play Video → Select Segment (timeline) → Add Captions
→ Generate Clip → Export (custom aspect ratio)
```

## Files Modified

### Created
- `supabase/migrations/20260501000000_dual_mode_clips.sql`
- `DUAL_MODE_PROGRESS.md` (this file)

### Modified
- `frontend/src/types/video.ts` - Added dual-mode types
- `frontend/src/pages/Upload.tsx` - Mode selector + aspect ratio picker
- `frontend/src/pages/VideoDetail.tsx` - Updated types

### Pending
- `supabase/functions/upload-video/index.ts`
- `supabase/functions/generate-clips/index.ts`
- `frontend/src/components/video/SegmentSelector.tsx` (new)

## Technical Notes

- Migration is backward compatible (all new fields have defaults)
- Existing videos will default to `sports_analysis` mode
- Aspect ratio defaults to `9:16` for backward compatibility
- Frontend validates aspect ratio selection based on mode
- No breaking changes to existing functionality

## Questions/Decisions

1. **Should we allow mode switching after upload?**
   - Current: Mode set at upload time
   - Consider: Allow re-processing with different mode

2. **Segment limits for short-form?**
   - Min duration: 3 seconds?
   - Max duration: 60 seconds?
   - Multiple segments per video?

3. **Caption templates?**
   - Pre-built caption styles for different platforms
   - Custom caption positioning/animation

---

**Ready to continue?** Apply the migration and we'll move on to Edge Functions!
