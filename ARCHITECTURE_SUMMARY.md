# Reka Sports Highlights - Current Architecture Summary

**Project Location**: `/root/reka-sports-highlights`

## Project Overview

A sports video highlights application with AI-powered clip generation, player tracking, commentary generation, and multi-format export capabilities. Built with React + Vite frontend, FastAPI/Deno Edge Functions backend, and Supabase (Postgres + pgvector).

---

## Core Architecture

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui | Web interface for video upload, clip generation, and export |
| **Backend** | Deno Edge Functions (Supabase) | Serverless video processing orchestration |
| **Database** | PostgreSQL (Supabase) with pgvector | Video metadata, clips, jobs, tracking data, statistics |
| **Storage** | Supabase Storage | Video file storage (uploaded videos) |
| **AI/Video Processing** | Reka API | Clip generation from video URLs (AI-powered highlight extraction) |
| **Video Encoding** | FFmpeg (in export function) | Video transcoding and rendering for export |
| **Authentication** | Supabase Auth | User registration, login, session management |

### Key Design Patterns

1. **Stateless Processing**: All state managed explicitly via database and RLS (Row Level Security)
2. **Job Queue Pattern**: Jobs table tracks async processing with status polling
3. **Signed URLs**: For secure file uploads and downloads
4. **Real-time Updates**: Supabase Realtime for live job status updates
5. **Edge Functions**: Serverless functions handle async processing (Deno runtime)

---

## Database Schema

### Core Tables

#### 1. **videos**
```sql
- id (UUID) - Primary key
- user_id (UUID) - Owner reference
- title (TEXT) - Video title
- source_type (TEXT) - 'upload' | 'youtube' | 'twitch'
- source_url (TEXT) - URL for YouTube/Twitch
- storage_path (TEXT) - Path in Supabase Storage for uploads
- duration_seconds (INT) - Video duration
- resolution (TEXT) - Video resolution (e.g., "1920x1080")
- status (TEXT) - 'uploaded' | 'processing' | 'completed' | 'failed'
- team_id (UUID) - Optional team ownership
- created_at / updated_at (TIMESTAMPTZ)
```

#### 2. **clips**
```sql
- id (UUID) - Primary key
- video_id (UUID) - Parent video reference (FK)
- user_id (UUID) - Owner reference
- reka_clip_id (TEXT) - ID from Reka API response
- clip_url (TEXT) - URL to generated clip
- title (TEXT) - Clip title
- caption (TEXT) - AI-generated caption
- hashtags (TEXT[]) - Auto-generated hashtags
- quality_score (INT) - Reka quality score (0-100)
- start_time (NUMERIC) - Start timestamp in seconds
- end_time (NUMERIC) - End timestamp in seconds
- aspect_ratio (TEXT) - DEFAULT '9:16' | '16:9' | '4:5' | '1:1'
- resolution (TEXT) - DEFAULT '720p'
- team_id (UUID) - Optional team ownership
- created_at (TIMESTAMPTZ)
```

#### 3. **jobs**
```sql
- id (UUID) - Primary key
- user_id (UUID) - Owner reference
- video_id (UUID) - Parent video reference (FK)
- job_type (TEXT) - 'clip_generation' | 'tagging' | 'analysis'
- status (TEXT) - 'queued' | 'processing' | 'completed' | 'failed'
- progress (INT) - 0-100 progress percentage
- result (JSONB) - Job result data
- error (TEXT) - Error message if failed
- metadata (JSONB) - Job-specific metadata (includes reka_clip_id, settings)
- created_at / updated_at (TIMESTAMPTZ)
```

#### 4. **export_jobs**
```sql
- id (UUID) - Primary key
- clip_id (UUID) - Parent clip reference (FK)
- user_id (UUID) - Owner reference
- config (JSONB) - Export configuration (format, resolution, fps, overlays, music, etc.)
- status (TEXT) - 'pending' | 'processing' | 'completed' | 'failed'
- progress (INT) - 0-100 progress percentage
- output_url (TEXT) - Public URL of exported video
- error (TEXT) - Error message if failed
- created_at / updated_at (TIMESTAMPTZ)
```

#### 5. **tags**
```sql
- id (UUID) - Primary key
- clip_id (UUID) - Optional clip reference (FK)
- video_id (UUID) - Optional video reference (FK)
- tag_type (TEXT) - 'play_type' | 'player' | 'score' | 'custom'
- tag_value (TEXT) - Tag value/content
- timestamp (NUMERIC) - When tag occurs in video
- created_at (TIMESTAMPTZ)
```

### Extended Tables (Infrastructure)

#### 6. **teams**
- Teams for collaboration (created_by, members with roles)

#### 7. **team_members**
- Team membership with roles (admin, editor, viewer)

#### 8. **players**
- Player roster for teams with stats and metadata

#### 9. **video_tracks**
- Player tracking data (bounding boxes per frame)
- frame_data: JSONB array of tracking boxes

#### 10. **commentary_tracks**
- AI-generated commentary for videos/clips
- Types: pre_game, live_action, post_game, player_intro
- Stores transcript and audio_url

#### 11. **player_stats & team_stats**
- Comprehensive statistics tables for players and teams
- Includes: goals, assists, passes, tackles, heatmaps, etc.

#### 12. **social_posts**
- Tracking of exported clips posted to social media
- Platforms: instagram, tiktok, twitter, youtube, facebook
- Stores aspect_ratio and caption per platform

---

## Frontend Components

### Key Pages & Components

**Location**: `/root/reka-sports-highlights/frontend/src`

#### Upload System (`pages/Upload.tsx`)
- **Three upload methods**:
  1. Single file upload with drag-and-drop
  2. Batch multiple video uploads
  3. URL-based (YouTube/Twitch)
- **Features**:
  - Pre-upload video analysis (duration, resolution, size)
  - Processing time estimation
  - Real-time progress tracking
  - Video metadata extraction

#### Video Detail Page (`pages/VideoDetail.tsx`)
- Displays video metadata
- Shows generated clips with thumbnails
- Job status tracking with polling
- Handles clip generation trigger
- Lists all clips and their metadata

#### Export Components (`components/export/`)
- `ExportConfig.tsx`: Configure export settings (format, resolution, fps, music, overlays)
- `ExportProgress.tsx`: Display export job progress

#### Commentary Editor (`components/commentary/CommentaryEditor.tsx`)
- Edit AI-generated commentary
- Multiple voice styles
- Language selection

#### Tracking Components (`components/tracking/`)
- `TrackingEditor.tsx`: Edit player bounding boxes
- `BoundingBoxEditor.tsx`: Draw/edit boxes per frame
- `PlayerAssignmentPanel.tsx`: Assign tracked objects to players
- `TrackValidation.tsx`: Validate tracking data

#### Advanced Player (`components/video/AdvancedPlayer.tsx`)
- Custom video player with overlay canvas
- Support for bounding box rendering
- Player tracking visualization
- Timeline scrubbing

#### Stats Components (`components/stats/`)
- `PlayerStatsCard.tsx`: Display individual player stats
- `HeatmapVisualizer.tsx`: Show spatial heatmaps

### Key Hooks

**Location**: `/root/reka-sports-highlights/frontend/src/hooks/video/`

- `useVideoPlayer.ts`: Video playback state management
- `useCanvasOverlay.ts`: Canvas overlay rendering for tracking visualization

### Utilities

**Location**: `/root/reka-sports-highlights/frontend/src/lib/`

- `videoPreprocessing.ts`:
  - `getVideoMetadata()`: Extract video dimensions, duration, file size
  - `estimateProcessingTime()`: Calculate processing duration
  - Uses native HTML5 Video API

- `supabase.ts`: Supabase client initialization with auth context

- `commentaryTemplates.ts`: Pre-built commentary templates

---

## Edge Functions (Serverless Processing)

**Location**: `/root/reka-sports-highlights/supabase/functions/`

### 1. **upload-video** (`upload-video/index.ts`)
**Purpose**: Initialize video upload and create database record

**Workflow**:
1. Verify user authentication via Authorization header
2. For direct uploads:
   - Generate signed upload URL (60 min validity)
   - Generate public URL for uploaded file
   - Create video record with `status='uploaded'`
3. For YouTube/Twitch:
   - Create video record with source_url
   - Create initial job with `status='queued'`

**Returns**:
- Video ID and metadata
- Signed upload URL (for direct uploads)
- Status confirmation

**Triggers**: POST `/functions/v1/upload-video`

---

### 2. **generate-clips** (`generate-clips/index.ts`)
**Purpose**: Initiate Reka API clip generation job

**Workflow**:
1. Get video from database
2. Determine video URL (storage path for uploads, source_url for URL sources)
3. Create job record with `status='processing'`
4. Call Reka API with:
   - Video URL
   - Settings (aspect_ratio, resolution, num_clips, template, prompt)
5. Update job with Reka clip ID
6. Return job ID (client polls for completion)

**Reka Request Format**:
```javascript
{
  video_urls: ["https://..."],
  template: "moments" | "compilation",
  num_generations: 1-3,
  aspect_ratio: "9:16" | "16:9" | "4:5" | "1:1",
  resolution: 240-1080 (default: 720),
  subtitles_enabled: boolean,
  prompt?: string
}
```

**Triggers**: POST `/functions/v1/generate-clips`

---

### 3. **poll-clip-jobs** (`poll-clip-jobs/index.ts`)
**Purpose**: Poll Reka API for job completion and save clips

**Workflow**:
1. Get job from database
2. Check Reka API status
3. If completed:
   - Extract clip data from Reka response
   - Create clip records in database
   - Update job with `status='completed'`
4. If failed:
   - Update job with `status='failed'` and error message

**Triggers**: POST `/functions/v1/poll-clip-jobs` (called periodically by client)

---

### 4. **fetch-clip-urls** (`fetch-clip-urls/index.ts`)
**Purpose**: Retrieve complete clip information including URLs

**Workflow**:
1. Get clips by video_id or job_id
2. Return clip data with:
   - clip_url (hosted on Reka's CDN)
   - title, caption, hashtags
   - quality_score
   - aspect_ratio, resolution

**Triggers**: GET `/functions/v1/fetch-clip-urls?videoId=...`

---

### 5. **export-video** (`export-video/index.ts`)
**Purpose**: Render exported video with overlays, music, and commentary

**Workflow**:
1. Verify user authentication
2. Get clip details
3. Create export_jobs record with `status='pending'`
4. Async processing:
   - Download clip video from Reka
   - Download commentary audio (if requested)
   - Download background music (if requested)
   - Build FFmpeg command with:
     - Video scaling to desired resolution
     - FPS adjustment
     - Audio mixing (commentary + music)
   - Run FFmpeg to encode output
   - Upload result to storage
   - Update export_jobs with output_url

**Config Structure**:
```javascript
{
  format: "mp4" | "webm" | "mov",
  resolution: "1080p" | "720p" | "480p",
  fps: 30 | 60,
  includeOverlays: boolean,
  includeCommentary: boolean,
  includeMusic: boolean,
  transitions?: "fade" | "slide" | "none",
  musicUrl?: string,
  musicVolume?: 0-1,
  introText?: string,
  outroText?: string
}
```

**Triggers**: POST `/functions/v1/export-video`

---

### 6. **generate-commentary** (`generate-commentary/index.ts`)
**Purpose**: Generate AI commentary for videos/clips

**Workflow**:
1. Create commentary_tracks record with `status='pending'`
2. Call AI service (likely LLM-based)
3. Generate transcript in requested voice style
4. Convert transcript to audio
5. Upload audio to storage
6. Update commentary_tracks with audio_url and transcript

**Triggers**: POST `/functions/v1/generate-commentary`

---

### 7. **detect-players** (`detect-players/index.ts`)
**Purpose**: AI-based player detection and tracking

**Workflow**:
1. Get video frames
2. Run detection model (identifies players)
3. Create video_tracks with bounding boxes
4. Store frame_data as JSONB array

**Triggers**: POST `/functions/v1/detect-players`

---

### 8. **calculate-stats** (`calculate-stats/index.ts`)
**Purpose**: Extract player statistics from video analysis

**Workflow**:
1. Analyze video/clip with AI
2. Extract statistics (goals, assists, distance, speed, etc.)
3. Create player_stats and team_stats records
4. Calculate derived metrics (pass accuracy, etc.)

**Triggers**: POST `/functions/v1/calculate-stats`

---

## Shared Utilities

### **Reka Client** (`supabase/functions/_shared/reka-client.ts`)

```typescript
class RekaClient {
  // Health check
  async healthCheck(): Promise<boolean>

  // Generate clips
  async generateClips(request: RekaClipRequest): Promise<RekaClipResponse>

  // Get clip status
  async getClipStatus(clipId: string): Promise<RekaClipResponse>

  // Poll until completion
  async pollClipCompletion(
    clipId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<RekaClipResponse>
}
```

**Reka Response Format**:
```javascript
{
  id: "clip-uuid",
  status: "queued" | "processing" | "completed" | "failed",
  output?: [{
    video_url: "https://reka-cdn.com/clip.mp4",
    title: "AI-generated title",
    caption: "AI-generated caption",
    hashtags: ["tag1", "tag2"],
    ai_score: 85  // Quality score 0-100
  }],
  error?: "Error message if failed"
}
```

---

## Data Flow Diagrams

### Video Upload Flow
```
User Upload Form
    ↓
upload-video Edge Function
    ↓
[Direct Upload: Generate signed URL]
[URL Upload: Verify source]
    ↓
Create video record (status='uploaded')
    ↓
For YouTube/Twitch: Create job (status='queued')
    ↓
Return to client
    ↓
[Direct Upload: Client uploads file to Supabase Storage]
```

### Clip Generation Flow
```
User triggers "Generate Clips"
    ↓
generate-clips Edge Function
    ↓
Fetch video URL (storage or source_url)
    ↓
Create job (status='processing')
    ↓
Send request to Reka API
    ↓
Update job with reka_clip_id
    ↓
Return job ID to client
    ↓
[Client polls]
    ↓
poll-clip-jobs Edge Function
    ↓
Check Reka status
    ↓
[If completed]
    ↓
Create clip records in database
    ↓
Update job (status='completed')
    ↓
Client receives clips via fetch-clip-urls
```

### Export Flow
```
User configures export options
    ↓
export-video Edge Function
    ↓
Create export_jobs (status='pending')
    ↓
[Async processing starts]
    ↓
Download clip from Reka
Download optional: commentary audio, music
    ↓
Build FFmpeg command
    ↓
Execute FFmpeg (video encoding + audio mixing)
    ↓
Upload result to storage
    ↓
Update export_jobs (status='completed', output_url)
    ↓
[Client polls or receives Realtime update]
```

---

## Current Aspect Ratio Handling

### In Database (clips table)
- **Default**: `'9:16'` (vertical - mobile/TikTok)
- **Supported**: `'9:16' | '16:9' | '4:5' | '1:1'`
- **Stored per clip** (set during Reka generation)

### In Reka API
- Aspect ratio specified in request:
  ```javascript
  {
    aspect_ratio: "9:16" | "16:9" | "4:5" | "1:1"
  }
  ```
- Reka returns clips in specified ratio

### In Frontend
- Displayed in clip list
- Can be selected before generation
- Shown in export configuration

---

## Key Files to Modify for Dual-Mode System

### Frontend Changes

1. **`/frontend/src/pages/Upload.tsx`**
   - Add clip mode selection UI
   - Modify generation trigger logic
   - Track selected mode per upload

2. **`/frontend/src/pages/VideoDetail.tsx`**
   - Add mode selection for clip generation
   - Filter clips by mode in display
   - Separate UI for full-video vs. segment clips

3. **`/frontend/src/components/video/AdvancedPlayer.tsx`**
   - Add segment selection tool for clip mode
   - Timeline markers for segment boundaries
   - Aspect ratio preview based on mode

4. **`/frontend/src/types/video.ts`**
   - Add mode and segment data types
   - Extend clip type with mode information

### Backend Changes

1. **`/supabase/functions/generate-clips/index.ts`**
   - Accept `mode` and `segmentStart`/`segmentEnd` parameters
   - Pass to Reka API (if supported) or handle locally
   - Update job metadata with segment info

2. **`/supabase/migrations/202604XX000004_dual_mode_clips.sql`** (NEW)
   - Add `mode` column to clips table ('auto' | 'segment')
   - Add `segment_start` and `segment_end` columns for segments
   - Add indexes for mode-based queries
   - Update RLS policies if needed

3. **`/supabase/functions/_shared/reka-client.ts`**
   - Add support for segment timestamps in clip request
   - May need to check Reka API for segment support

### Types & Utilities

1. **`/frontend/src/lib/videoPreprocessing.ts`**
   - Add utility functions for segment validation
   - Calculate segment duration

2. **`/frontend/src/types/index.ts`**
   - Define ClipMode type: `'auto' | 'segment'`
   - Define SegmentClipSettings interface

---

## Current Status & Completeness

### ✅ Implemented Features
- Video upload (file, URL, batch)
- Reka-based clip generation
- Clip storage and retrieval
- Export with FFmpeg rendering
- Commentary generation framework
- Player tracking framework
- Statistics tracking framework
- Team collaboration support
- Social media post tracking

### ⚠️ Partially Implemented
- Video processing (async job queue exists, some functions need completion)
- Statistics calculation
- Commentary synthesis

### ❌ Not Yet Implemented
- Dual-mode clip generation (WHAT YOU'RE BUILDING)
- Advanced segment selection UI
- Batch segment processing

---

## Configuration & Secrets

### Environment Variables Required
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx... (Edge Functions only)
REKA_API_KEY=xxx
```

### Storage Buckets
- `video-uploads`: User-uploaded video files
- Video clips stored on Reka's CDN (clip_url field)
- Exported videos: `videos/exports/` path

---

## Performance Considerations

### Indexing
- All tables have indexes on:
  - user_id (row-level filtering)
  - status (job filtering)
  - video_id/clip_id (relationship queries)
  - created_at (temporal queries)

### RLS Performance
- All queries filtered by auth.uid() at database level
- No client-side filtering needed
- Team-based queries use efficient EXISTS subqueries

### Job Processing
- Async processing via jobs table
- Client polls for updates (Realtime subscription available)
- No blocking operations on upload

---

## Testing & Validation Points

### For Your Implementation

1. **Database Migration**:
   - Test migration runs without errors
   - Verify new columns exist
   - Test RLS still works

2. **Frontend Segment Selection**:
   - Test timeline interaction
   - Validate segment boundaries
   - Test aspect ratio changes

3. **API Integration**:
   - Send segment data to generate-clips
   - Verify job metadata stores segments
   - Test clip retrieval by mode

4. **Display & Export**:
   - Segment clips display correctly
   - Export works with segment clips
   - Social posts track both modes

5. **Edge Cases**:
   - Very short/long segments
   - Overlapping segment selections
   - Mode switching mid-generation

---

## References & Dependencies

### Node Modules (Frontend)
```
react@latest
vite
typescript
tailwindcss
shadcn/ui
@supabase/supabase-js
@tanstack/react-query
lucide-react
```

### Deno/Edge Function Imports
```
https://deno.land/std@0.168.0/http/server.ts
https://esm.sh/@supabase/supabase-js@2
```

### External APIs
- **Reka API**: https://vision-agent.api.reka.ai/v1/clips
- **Supabase**: PostgreSQL, Storage, Auth, Edge Functions

---
