# Reka Sports Highlights Generator

AI-powered sports video analysis and highlight generation system using Reka.ai Vision API.

## Overview

Automated sports video processing platform that:
- **Analyzes** large sports videos to detect key moments
- **Clips** highlights automatically with timestamps
- **Generates** tags, titles, and captions for each clip
- **Tags** plays with metadata (player names, play types, scores)
- **Exports** broadcast-ready highlight reels in multiple formats

## Architecture

### Stack (QuakeFC Pattern)
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase Edge Functions (Deno) - serverless API routes
- **Database**: Supabase (Postgres + Storage + Auth + Realtime)
- **AI Processing**: Reka.ai Vision API (Clip Generation + Video Q&A)
- **Video Storage**: Supabase Storage (raw) + Reka Cloud (processed)
- **Queue**: Supabase Realtime for job status updates
- **State Management**: React Query (@tanstack/react-query)
- **Observability**: LangSmith (optional)

### Design Principles
- **Async-first**: Non-blocking video processing with job queues
- **Modular**: Separate services for upload, analysis, clipping, tagging
- **Real-time**: SSE for processing status, Supabase Realtime for updates
- **Scalable**: Batch processing support for multiple videos
- **Export-ready**: Multiple aspect ratios (9:16, 16:9, 4:5, 1:1) and resolutions

## Reka.ai API Capabilities

### Video Clip Generation (`/v1/clips`)
- **Input**: YouTube, Twitch, or direct MP4 URLs (max 2 hours in preview)
- **Templates**:
  - `moments` - Individual highlight clips
  - `compilation` - Combined highlight reel
- **Customization**:
  - Duration: 0-600s (default max: 90s)
  - Aspect ratios: 9:16 (vertical), 16:9 (landscape), 4:5, 1:1
  - Resolution: 240p-1080p (default: 720p)
  - Subtitles: Auto-generated with custom fonts/colors
  - Time windows: Extract from specific segments
- **Output**: Clip URLs, AI titles, captions, hashtags, quality scores (0-100)

### Video Q&A (`/v1/qa/chat`)
- Ask questions about video content
- Identify specific plays, players, timestamps
- Extract game statistics and events

### Video Tagging (`/v1/qa/indexedtag`)
- Auto-generate metadata tags
- Custom tag schemas for sports-specific data

### Video Management
- Upload, list, search, delete videos
- Semantic search across video library

## Development Workflow

### 1. Planning
Use ACE Multi-Agent System for complex features:
```bash
/ace:new-project "Feature Name"
/ace:create-roadmap
/ace:execute-plan
```

### 2. Execution Flow
1. **Plan** → Design in `.agent/plans/`
2. **Build** → Implement with validation tests
3. **Test** → Verify with real sports videos
4. **Deploy** → Production-ready exports

### 3. Complexity Indicators
- ✅ **Simple** - Single API call, basic UI
- ⚠️ **Medium** - Multiple services, state management
- 🔴 **Complex** - Break into sub-plans (e.g., batch processing)

## Core Features (MVP)

### Phase 1: Foundation
1. **Project Setup**
   - Initialize FastAPI backend + React frontend
   - Supabase database schema (users, videos, clips, jobs)
   - Reka.ai API integration layer
   - Environment configuration

2. **Video Upload**
   - Direct file upload to Supabase Storage
   - YouTube/Twitch URL ingestion
   - Video metadata extraction (duration, resolution)
   - Job creation and tracking

### Phase 2: AI Processing
3. **Highlight Detection**
   - Reka Clip API integration (`/v1/clips`)
   - Async job processing with status updates
   - Multiple clip generation (1-3 per video)
   - Quality scoring and ranking

4. **Intelligent Tagging**
   - Video Q&A for play identification
   - Auto-tag generation (play type, players, scores)
   - Custom tag schemas for sports
   - Timestamp extraction

### Phase 3: Export & Management
5. **Clip Management**
   - View all generated clips with previews
   - Edit titles, captions, hashtags
   - Re-generate with different settings
   - Download in multiple formats

6. **Batch Processing**
   - Upload multiple videos
   - Queue management
   - Parallel processing
   - Bulk export

## API Endpoints

### Backend (FastAPI)
```
POST   /api/videos/upload          # Upload video file
POST   /api/videos/url              # Add from URL
GET    /api/videos                  # List all videos
GET    /api/videos/{id}             # Get video details
DELETE /api/videos/{id}             # Delete video

POST   /api/clips/generate          # Generate clips
GET    /api/clips                   # List all clips
GET    /api/clips/{id}              # Get clip details
PUT    /api/clips/{id}              # Update clip metadata
DELETE /api/clips/{id}              # Delete clip

POST   /api/videos/{id}/analyze     # Video Q&A analysis
POST   /api/videos/{id}/tag         # Generate tags

GET    /api/jobs/{id}               # Job status
GET    /api/jobs/{id}/stream        # SSE job updates
```

### Database Schema (Supabase)

```sql
-- Users (via Supabase Auth)
-- RLS: Users see only their own data

-- Videos
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'upload' | 'youtube' | 'twitch'
  source_url TEXT,
  storage_path TEXT,
  duration_seconds INT,
  resolution TEXT,
  status TEXT NOT NULL, -- 'uploaded' | 'processing' | 'completed' | 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clips
CREATE TABLE clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  reka_clip_id TEXT,
  clip_url TEXT,
  title TEXT,
  caption TEXT,
  hashtags TEXT[],
  quality_score INT,
  start_time NUMERIC,
  end_time NUMERIC,
  aspect_ratio TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID REFERENCES clips,
  video_id UUID REFERENCES videos,
  tag_type TEXT NOT NULL, -- 'play_type' | 'player' | 'score' | 'custom'
  tag_value TEXT NOT NULL,
  timestamp NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Processing Jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  video_id UUID REFERENCES videos,
  job_type TEXT NOT NULL, -- 'clip_generation' | 'tagging' | 'analysis'
  status TEXT NOT NULL, -- 'queued' | 'processing' | 'completed' | 'failed'
  progress INT DEFAULT 0,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Configuration

```bash
# .env (Edge Functions - supabase/functions/.env)
DB_URL=https://xxx.supabase.co
DB_ANON_KEY=xxx
DB_SERVICE_ROLE_KEY=xxx
REKA_API_KEY=xxx
REKA_POLL_MAX_ATTEMPTS=60 (optional)
REKA_POLL_INTERVAL_MS=5000 (optional)

# .env (Frontend - frontend/.env)
VITE_DB_URL=https://xxx.supabase.co
VITE_DB_ANON_KEY=xxx
```

## Development Commands

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev  # Port 5173

# Database Migrations
cd supabase
supabase migration new migration_name
supabase db push
```

## Sports-Specific Enhancements (Future)

- **Play Type Detection**: Touchdowns, goals, fouls, penalties
- **Player Tracking**: Face recognition, jersey number OCR
- **Score Extraction**: Automatic scoreboard reading
- **Game Context**: Period/quarter detection, time remaining
- **Multi-Angle Support**: Sync clips from multiple camera feeds
- **Live Processing**: Real-time highlight generation during games

## Pricing Considerations (Reka.ai)

- **Clip Generation**: Consumption-based (tokens + video minutes)
- **1080p Processing**: HD fee applies
- **Finetuning**: $0.50/input minute (volume discounts available)
- **API Rate Limits**: Check current tier limits

## Progress Tracking

- Check `PROGRESS.md` for feature completion status
- Use ACE State Management for multi-phase development
- Update after each milestone

## Resources

- [Reka Vision API Docs](https://docs.reka.ai/vision/overview)
- [Reka Clip Examples (GitHub)](https://github.com/reka-ai/clip-api-examples)
- [Supabase Docs](https://supabase.com/docs)
