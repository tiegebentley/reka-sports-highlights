# Reka Sports Highlights - ACE Project

**Project ID**: `reka-sports-highlights`
**Type**: Greenfield
**Pattern**: QuakeFC (Vite + React + Supabase Edge Functions)
**Created**: 2026-04-18
**Status**: Active

---

## Project Overview

AI-powered sports video analysis and highlight generation system using Reka.ai Vision API.

### Core Capabilities
- Upload sports videos (YouTube, Twitch, MP4)
- AI-powered highlight detection via Reka.ai
- Automatic clip generation with customization
- Intelligent tagging (plays, players, scores)
- Multi-format export (9:16, 16:9, 4:5, 1:1)

---

## Technical Stack

### Frontend (QuakeFC Pattern)
- **Framework**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State**: React Query + Context API
- **Routing**: React Router v6
- **Auth**: Supabase Auth

### Backend (Serverless)
- **Runtime**: Supabase Edge Functions (Deno)
- **Database**: Supabase Postgres
- **Storage**: Supabase Storage
- **Realtime**: Supabase Realtime subscriptions
- **AI API**: Reka.ai Vision API

### Key Dependencies
```json
{
  "frontend": [
    "@supabase/supabase-js",
    "@tanstack/react-query",
    "react-router-dom",
    "lucide-react",
    "@radix-ui/* (shadcn components)",
    "tailwind-merge",
    "class-variance-authority",
    "zod"
  ],
  "edge-functions": [
    "supabase/supabase-js (Deno)",
    "Reka.ai Vision API client"
  ]
}
```

---

## Architecture Reference

**Source**: `/root/quakefc/`
- Vite + React setup
- Supabase Edge Functions pattern
- shadcn/ui component library
- Supabase client configuration
- TypeScript configuration

---

## Team Assignments

### Alpha Lead - Frontend Foundation
**Responsibilities**:
- Initialize Vite + React + TypeScript project
- Setup Tailwind CSS + shadcn/ui
- Create base layout and routing
- Implement Supabase client
- Build authentication flow
- Create video upload UI

**Deliverables**:
- Running dev server on port 5173
- Auth (login/signup) working
- Upload page with drag-and-drop
- Video library page (list view)

---

### Beta Lead - Backend & Database
**Responsibilities**:
- Initialize Supabase project
- Create database schema (migrations)
- Setup Row-Level Security policies
- Create Supabase Edge Functions:
  - `upload-video` - Handle file uploads
  - `generate-clips` - Reka.ai clip generation
  - `video-qa` - Video Q&A analysis
  - `generate-tags` - Auto-tagging
- Configure Supabase Storage buckets

**Deliverables**:
- Database schema deployed
- RLS policies active
- 4 Edge Functions deployed and tested
- Storage bucket configured

---

### Gamma Lead - AI Integration & Processing
**Responsibilities**:
- Create Reka.ai API client (Deno)
- Implement clip generation logic
- Build job queue system (Realtime)
- Create video processing pipeline
- Implement status tracking
- Build clip preview components

**Deliverables**:
- Reka API client working
- Clip generation tested with sample video
- Job status updates via Realtime
- Clip preview in UI

---

## Success Criteria

### Phase 1 (MVP)
- [x] User can sign up/login
- [x] User can upload video (MP4) or paste URL (YouTube)
- [x] Video appears in library
- [x] User can click "Generate Highlights"
- [x] System generates 1-3 clips via Reka.ai
- [x] User sees clips with preview, title, caption
- [x] User can download clips

### Phase 2 (Enhanced)
- [ ] Batch processing (multiple videos)
- [ ] Custom clip settings (duration, aspect ratio)
- [ ] Tag editing and organization
- [ ] Export presets for social media
- [ ] Analytics dashboard

---

## Validation Tests

### Integration Tests
1. Upload 50MB MP4 file → Success
2. Paste YouTube URL → Video ingested
3. Generate clips → 3 clips returned
4. Download clip → MP4 file downloaded
5. Tag generation → Tags appear in UI

### Performance Tests
1. Upload completes in < 30s
2. Clip generation completes in < 5 min
3. UI remains responsive during processing
4. Realtime updates < 1s latency

---

## Dependencies & Prerequisites

### Required Services
- [x] Supabase project created
- [x] Reka.ai API key obtained
- [ ] Supabase CLI installed
- [ ] Node.js 18+ installed

### Environment Variables
```bash
# Frontend (.env)
VITE_DB_URL=
VITE_DB_ANON_KEY=

# Edge Functions (.env)
DB_URL=
DB_SERVICE_ROLE_KEY=
REKA_API_KEY=
REKA_API_BASE_URL=https://vision-agent.api.reka.ai
```

---

## Risk Assessment

### Technical Risks
- **Reka.ai API limits**: 2-hour video max in preview
- **Processing time**: Large videos may take 5-10 min
- **Cost**: 1080p processing incurs HD fees

### Mitigation
- Default to 720p resolution
- Show clear processing time estimates
- Implement queue system for large batches
- Add cost calculator before processing

---

## Timeline Estimate

### Phase 1 (MVP)
- **Alpha**: 2-3 hours
- **Beta**: 2-3 hours
- **Gamma**: 2-3 hours
- **Integration**: 1 hour
- **Total**: ~8-10 hours (with parallel execution: ~4-5 hours)

### Phase 2 (Enhanced)
- **Additional features**: 3-5 hours
- **Polish & optimization**: 2-3 hours

---

## Next Steps

1. Initialize ACE roadmap
2. Create phase plans
3. Execute Phase 1 with parallel agents
4. Validate and test
5. Deploy to production
