# Dual-Mode Clip Generation - Implementation Guide

## Overview

This document provides the roadmap for implementing the dual-mode clip generation system in the Reka Sports Highlights application. The system will support both:

1. **Auto Mode**: AI-powered clip generation from entire video
2. **Segment Mode**: User-selected time range clip generation

---

## Database Schema Changes

### Migration File
**Location**: `/root/reka-sports-highlights/supabase/migrations/20260501000000_dual_mode_clips.sql`

```sql
-- Add mode tracking to clips table
ALTER TABLE clips ADD COLUMN mode TEXT DEFAULT 'auto' CHECK (mode IN ('auto', 'segment'));
ALTER TABLE clips ADD COLUMN segment_start NUMERIC;
ALTER TABLE clips ADD COLUMN segment_end NUMERIC;

-- Add indexes for mode-based queries
CREATE INDEX idx_clips_mode ON clips(mode);
CREATE INDEX idx_clips_segment_range ON clips(video_id, segment_start, segment_end);

-- Optional: Track which job created which clips
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS clip_ids UUID[] DEFAULT '{}';
```

### Database Columns Explained

| Column | Type | Purpose |
|--------|------|---------|
| `mode` | TEXT | 'auto' (full video) or 'segment' (user-selected) |
| `segment_start` | NUMERIC | Start time in seconds (NULL for auto mode) |
| `segment_end` | NUMERIC | End time in seconds (NULL for auto mode) |

---

## Frontend Implementation

### 1. Types & Data Structures

**File**: `/frontend/src/types/index.ts` (UPDATE)

```typescript
export type ClipMode = 'auto' | 'segment'

export interface SegmentClipSettings {
  mode: ClipMode
  segmentStart?: number  // seconds
  segmentEnd?: number    // seconds
  aspectRatio: '9:16' | '16:9' | '4:5' | '1:1'
  resolution: number
  numClips: number
  prompt?: string
}

export interface ClipRecord {
  id: string
  video_id: string
  user_id: string
  reka_clip_id: string | null
  clip_url: string | null
  title: string | null
  caption: string | null
  hashtags: string[] | null
  quality_score: number | null
  start_time: number | null
  end_time: number | null
  aspect_ratio: string | null
  resolution: string | null
  // NEW FIELDS
  mode: ClipMode
  segment_start: number | null  // For segment mode
  segment_end: number | null    // For segment mode
  created_at: string
}
```

### 2. Update Upload/Generation UI

**File**: `/frontend/src/pages/VideoDetail.tsx` (MODIFY)

```typescript
// Add state for clip generation settings
const [clipSettings, setClipSettings] = useState<SegmentClipSettings>({
  mode: 'auto',
  aspectRatio: '9:16',
  resolution: 720,
  numClips: 3,
})

// Add UI for mode selection
<div className="mb-4 flex gap-2">
  <button
    onClick={() => setClipSettings({ ...clipSettings, mode: 'auto' })}
    className={clipSettings.mode === 'auto' ? 'bg-primary' : 'bg-secondary'}
  >
    Auto Mode (Full Video)
  </button>
  <button
    onClick={() => setClipSettings({ ...clipSettings, mode: 'segment' })}
    className={clipSettings.mode === 'segment' ? 'bg-primary' : 'bg-secondary'}
  >
    Segment Mode (Custom Range)
  </button>
</div>

// If segment mode, show segment selector
{clipSettings.mode === 'segment' && video && (
  <SegmentSelector
    videoDuration={video.duration_seconds}
    onSegmentSelect={(start, end) => {
      setClipSettings({
        ...clipSettings,
        segmentStart: start,
        segmentEnd: end,
      })
    }}
  />
)}
```

### 3. Segment Selector Component

**File**: `/frontend/src/components/video/SegmentSelector.tsx` (NEW)

```typescript
import { useState } from 'react'
import { Play, Pause } from 'lucide-react'

interface SegmentSelectorProps {
  videoDuration: number
  onSegmentSelect: (start: number, end: number) => void
}

export function SegmentSelector({
  videoDuration,
  onSegmentSelect,
}: SegmentSelectorProps) {
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(Math.min(60, videoDuration))
  const [playing, setPlaying] = useState(false)

  const handleStartChange = (value: number) => {
    if (value < endTime) {
      setStartTime(value)
      onSegmentSelect(value, endTime)
    }
  }

  const handleEndChange = (value: number) => {
    if (value > startTime) {
      setEndTime(value)
      onSegmentSelect(startTime, value)
    }
  }

  const segmentDuration = endTime - startTime

  return (
    <div className="bg-card rounded-lg border p-4 space-y-4">
      <h3 className="font-semibold">Select Time Segment</h3>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          Start: {Math.floor(startTime)}s
        </label>
        <input
          type="range"
          min={0}
          max={videoDuration}
          value={startTime}
          onChange={(e) => handleStartChange(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          End: {Math.floor(endTime)}s
        </label>
        <input
          type="range"
          min={0}
          max={videoDuration}
          value={endTime}
          onChange={(e) => handleEndChange(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-muted-foreground">Segment Duration</p>
          <p className="font-semibold">{Math.floor(segmentDuration)}s</p>
        </div>
        <div>
          <p className="text-muted-foreground">Start Time</p>
          <p className="font-semibold">{Math.floor(startTime)}s</p>
        </div>
        <div>
          <p className="text-muted-foreground">End Time</p>
          <p className="font-semibold">{Math.floor(endTime)}s</p>
        </div>
      </div>

      <div className="pt-2 border-t">
        <button
          onClick={() => setPlaying(!playing)}
          className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 py-2 rounded-md"
        >
          {playing ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Preview Segment
        </button>
      </div>
    </div>
  )
}
```

### 4. Update Clip Display

**File**: `/frontend/src/pages/VideoDetail.tsx` (MODIFY)

```typescript
// Filter and display clips by mode
const autoClips = clips.filter(c => c.mode === 'auto')
const segmentClips = clips.filter(c => c.mode === 'segment')

<div className="space-y-6">
  {/* Auto Mode Clips */}
  {autoClips.length > 0 && (
    <div>
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <span>Auto-Generated Clips</span>
        <span className="text-xs bg-primary/10 px-2 py-1 rounded">
          {autoClips.length}
        </span>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {autoClips.map(clip => (
          <ClipCard key={clip.id} clip={clip} />
        ))}
      </div>
    </div>
  )}

  {/* Segment Mode Clips */}
  {segmentClips.length > 0 && (
    <div>
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <span>Custom Segment Clips</span>
        <span className="text-xs bg-blue-100 px-2 py-1 rounded text-blue-900">
          {segmentClips.length}
        </span>
      </h3>
      <div className="space-y-2">
        {segmentClips.map(clip => (
          <SegmentClipCard
            key={clip.id}
            clip={clip}
            segmentStart={clip.segment_start}
            segmentEnd={clip.segment_end}
          />
        ))}
      </div>
    </div>
  )}
</div>
```

### 5. Update Clip Generation Handler

**File**: `/frontend/src/pages/VideoDetail.tsx` (MODIFY)

```typescript
const handleGenerateClips = async () => {
  if (!video) return

  try {
    setGeneratingClips(true)
    setError(null)

    const response = await supabase.functions.invoke('generate-clips', {
      body: {
        videoId: video.id,
        settings: {
          mode: clipSettings.mode,
          aspectRatio: clipSettings.aspectRatio,
          resolution: clipSettings.resolution,
          numClips: clipSettings.numClips,
          prompt: clipSettings.prompt,
          // NEW: Segment parameters
          ...(clipSettings.mode === 'segment' && {
            segmentStart: clipSettings.segmentStart,
            segmentEnd: clipSettings.segmentEnd,
          }),
        },
      },
    })

    if (response.error) {
      throw response.error
    }

    const { jobId } = response.data
    // Poll for completion
    await pollJobStatus(jobId)
    await fetchVideoDetails()
  } catch (err: any) {
    setError(err.message || 'Failed to generate clips')
  } finally {
    setGeneratingClips(false)
  }
}
```

---

## Backend Implementation

### 1. Update generate-clips Edge Function

**File**: `/supabase/functions/generate-clips/index.ts` (MODIFY)

```typescript
interface GenerateClipsRequest {
  videoId: string
  settings?: {
    mode?: 'auto' | 'segment'
    segmentStart?: number  // seconds
    segmentEnd?: number    // seconds
    template?: 'moments' | 'compilation'
    num_clips?: number
    aspect_ratio?: '9:16' | '16:9' | '4:5' | '1:1'
    resolution?: number
    prompt?: string
  }
}

// Inside the main function:
const { videoId, settings }: GenerateClipsRequest = await req.json()

// Validate segment mode
if (settings?.mode === 'segment') {
  if (typeof settings.segmentStart !== 'number' || typeof settings.segmentEnd !== 'number') {
    throw new Error('segmentStart and segmentEnd are required for segment mode')
  }
  if (settings.segmentStart >= settings.segmentEnd) {
    throw new Error('segmentStart must be less than segmentEnd')
  }
  if (settings.segmentEnd > video.duration_seconds) {
    throw new Error('segmentEnd cannot exceed video duration')
  }
}

// Build Reka request
const clipRequest = {
  video_urls: [videoUrl],
  template: settings?.template || 'moments',
  num_generations: Math.min(settings?.num_clips || 3, 3),
  aspect_ratio: settings?.aspect_ratio || '9:16',
  resolution: settings?.resolution || 720,
  prompt: settings?.prompt,
  // NEW: Add segment timestamps if in segment mode
  ...(settings?.mode === 'segment' && {
    source_start_time: settings.segmentStart,
    source_end_time: settings.segmentEnd,
  }),
}

// Store mode in job metadata
await supabase.from('jobs').update({
  metadata: {
    settings,
    mode: settings?.mode || 'auto',
    reka_clip_id: clipResponse.id,
  },
}).eq('id', job.id)
```

### 2. Update poll-clip-jobs Edge Function

**File**: `/supabase/functions/poll-clip-jobs/index.ts` (MODIFY)

```typescript
// When creating clip records:
const clipData = job.metadata

const { error: clipError } = await supabase
  .from('clips')
  .insert(
    clipResponse.output.map((output, index) => ({
      video_id: video.id,
      user_id: video.user_id,
      reka_clip_id: clipResponse.id,
      clip_url: output.video_url,
      title: output.title,
      caption: output.caption,
      hashtags: output.hashtags,
      quality_score: Math.round(output.ai_score),
      start_time: output.start_timestamp,
      end_time: output.end_timestamp,
      aspect_ratio: clipData?.settings?.aspect_ratio || '9:16',
      resolution: clipData?.settings?.resolution || '720p',
      // NEW: Store mode information
      mode: clipData?.mode || 'auto',
      segment_start: clipData?.settings?.segmentStart || null,
      segment_end: clipData?.settings?.segmentEnd || null,
    }))
  )
```

### 3. Add Reka API Segment Support

**File**: `/supabase/functions/_shared/reka-client.ts` (UPDATE)

```typescript
export interface RekaClipRequest {
  video_urls: string[]
  prompt?: string
  template?: 'moments' | 'compilation'
  num_generations?: number
  duration_range?: {
    min?: number
    max?: number
  }
  // NEW: Segment parameters
  source_start_time?: number  // seconds
  source_end_time?: number    // seconds
  aspect_ratio?: '9:16' | '16:9' | '4:5' | '1:1'
  resolution?: number
  subtitles_enabled?: boolean
}

// Note: Check Reka API documentation for actual parameter names
// These may be different in their API specification
```

---

## Utility Functions

### 1. Add Segment Validation

**File**: `/frontend/src/lib/videoPreprocessing.ts` (ADD)

```typescript
export interface SegmentValidation {
  isValid: boolean
  errors: string[]
  duration: number
}

export function validateSegment(
  startTime: number,
  endTime: number,
  videoDuration: number,
  minDuration: number = 5
): SegmentValidation {
  const errors: string[] = []

  if (startTime < 0) {
    errors.push('Start time cannot be negative')
  }

  if (endTime > videoDuration) {
    errors.push('End time cannot exceed video duration')
  }

  if (startTime >= endTime) {
    errors.push('Start time must be before end time')
  }

  const duration = endTime - startTime
  if (duration < minDuration) {
    errors.push(`Segment must be at least ${minDuration} seconds long`)
  }

  if (duration > videoDuration * 0.95) {
    errors.push('Segment should be less than 95% of video duration')
  }

  return {
    isValid: errors.length === 0,
    errors,
    duration,
  }
}

export function formatSegmentTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
```

---

## Testing Checklist

### Database
- [ ] Migration runs without errors
- [ ] New columns added to clips table
- [ ] Indexes created successfully
- [ ] RLS policies still work
- [ ] Old clips still accessible (backward compatibility)

### Frontend
- [ ] Mode toggle buttons appear
- [ ] Segment selector shows only in segment mode
- [ ] Timeline range input works
- [ ] Preview button functional
- [ ] Segment clips display separately from auto clips
- [ ] Mode tags visible in clip list

### Backend
- [ ] generate-clips accepts mode parameter
- [ ] Segment validation works
- [ ] Reka API receives segment timestamps
- [ ] poll-clip-jobs saves mode data
- [ ] Segment clips retrievable by mode

### Integration
- [ ] Generate auto clips (existing functionality)
- [ ] Generate segment clips (new functionality)
- [ ] Export works with both modes
- [ ] Social posts work with both modes
- [ ] Statistics tracked correctly

### Edge Cases
- [ ] Very short segments (5 seconds)
- [ ] Very long segments (near full video)
- [ ] Overlapping segment selections
- [ ] Mode switching mid-generation
- [ ] Multiple segments from same video

---

## Deployment Steps

1. **Backup Database**
   ```bash
   supabase db pull
   ```

2. **Apply Migration**
   ```bash
   supabase migration up
   # or push directly to production
   supabase link --project-ref=your-project
   supabase db push
   ```

3. **Deploy Edge Functions**
   ```bash
   supabase functions deploy generate-clips
   supabase functions deploy poll-clip-jobs
   ```

4. **Deploy Frontend**
   ```bash
   npm run build
   # Deploy to hosting (Vercel, Netlify, etc.)
   ```

5. **Verification**
   - Test auto mode (should work as before)
   - Test segment mode (new functionality)
   - Monitor Realtime jobs table for updates
   - Check database for correct mode values

---

## Future Enhancements

1. **Advanced Segment Features**
   - Drag-and-drop segment handles
   - Multiple segment selection
   - Segment presets (highlight key moments)

2. **AI-Powered Suggestions**
   - Auto-suggest segment boundaries based on action detection
   - Recommend optimal segment duration

3. **Batch Processing**
   - Generate multiple segments in one job
   - Progress tracking per segment

4. **Segment Stitching**
   - Combine multiple segments into highlight reel
   - Auto-transition between segments

5. **Template-Based Segments**
   - "Goal celebrations" segment preset
   - "Best plays" segment preset
   - Sport-specific templates

---

## File Summary

### New Files
- `/supabase/migrations/20260501000000_dual_mode_clips.sql`
- `/frontend/src/components/video/SegmentSelector.tsx`

### Modified Files
- `/frontend/src/types/index.ts` (add types)
- `/frontend/src/pages/VideoDetail.tsx` (add UI and handlers)
- `/supabase/functions/generate-clips/index.ts` (add segment support)
- `/supabase/functions/poll-clip-jobs/index.ts` (store mode in clips)
- `/supabase/functions/_shared/reka-client.ts` (update types)
- `/frontend/src/lib/videoPreprocessing.ts` (add validation)

### Total Lines Changed
- Frontend: ~300-400 lines
- Backend: ~150-200 lines
- Database: ~10-15 lines
- **Total: ~500-600 lines**

---

## Estimated Timeline

- **Database & Types**: 1-2 hours
- **Frontend UI**: 3-4 hours
- **Backend Logic**: 2-3 hours
- **Testing**: 2-3 hours
- **Documentation**: 1 hour

**Total**: ~10-12 hours of development

---
