# Transformation Plan: Reka Sports Highlights → Hylytr-Style Platform

**Target**: Transform current basic dashboard into comprehensive AI-powered video analysis platform
**Inspiration**: Hylytr.com feature set
**Estimated Timeline**: 4-6 weeks (phased approach)
**Complexity**: 🔴 Complex - Breaking into 8 major phases

---

## Current State Assessment

### ✅ What We Have
- Basic React + Vite + TypeScript frontend
- Supabase backend (Auth, Database, Storage, Realtime)
- Reka.ai API integration (clip generation)
- Simple dashboard with upload/library pages
- Video processing pipeline foundation

### ❌ What's Missing (Hylytr Features)
1. **Marketing Landing Page** - Professional homepage with hero, features, pricing
2. **Advanced Video Player** - Player tracking, spotlights, filters, zoom controls
3. **AI Commentary System** - Multi-voice, multi-lingual narration
4. **Player Tracking & Analytics** - Bounding boxes, individual player focus
5. **Broadcast Suite** - Pre-game, live, post-game commentary
6. **Social Media Tools** - Auto-captions, hashtags, platform optimization
7. **Team Collaboration** - Multi-user team highlights
8. **Advanced Export** - Multiple formats, aspect ratios, music/transitions
9. **Stats & Progress Tracking** - Performance trends, hot/cold analysis
10. **Coach AI Chat** - Q&A about tactics, training, performance

---

## Architecture Additions Needed

### New Tech Stack Components
- **Video Player**: VideoJS or Plyr with custom overlays
- **Canvas Rendering**: For bounding boxes, spotlights, player tracking
- **Audio Generation**: ElevenLabs or PlayHT for AI commentary
- **Motion Graphics**: Remotion for intros/outros/transitions
- **ML Models**: Player detection (Reka + optional local models)
- **Real-time Collaboration**: Supabase Realtime for team features
- **Analytics Engine**: Custom stats tracking system
- **Export Pipeline**: FFmpeg in Supabase Edge Functions

### Database Schema Extensions
```sql
-- Players
CREATE TABLE players (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  team_id UUID REFERENCES teams,
  name TEXT NOT NULL,
  number INT,
  position TEXT,
  bio TEXT,
  stats JSONB,
  avatar_url TEXT
);

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  members UUID[] -- array of user_ids
);

-- Tracking Data
CREATE TABLE video_tracks (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos,
  player_id UUID REFERENCES players,
  frame_data JSONB, -- [{timestamp, x, y, w, h, confidence}]
  detection_method TEXT -- 'ai' | 'manual'
);

-- AI Commentary
CREATE TABLE commentary_tracks (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos,
  clip_id UUID REFERENCES clips,
  voice_style TEXT, -- 'broadcaster' | 'spanish' | 'energetic'
  audio_url TEXT,
  transcript JSONB, -- [{timestamp, text}]
  status TEXT
);

-- Stats
CREATE TABLE player_stats (
  id UUID PRIMARY KEY,
  player_id UUID REFERENCES players,
  video_id UUID REFERENCES videos,
  stat_type TEXT, -- 'goals' | 'saves' | 'touches' | 'distance'
  value NUMERIC,
  timestamp NUMERIC,
  metadata JSONB
);

-- Social Media
CREATE TABLE social_posts (
  id UUID PRIMARY KEY,
  clip_id UUID REFERENCES clips,
  platform TEXT, -- 'instagram' | 'tiktok' | 'twitter'
  caption TEXT,
  hashtags TEXT[],
  aspect_ratio TEXT,
  published_at TIMESTAMPTZ
);
```

---

## Phase-by-Phase Implementation Plan

## 🎯 Phase 1: Professional Landing Page (Week 1)
**Complexity**: ⚠️ Medium
**Goal**: Transform into marketing site like Hylytr

### Tasks
1. Create new homepage route separate from dashboard
2. Build hero section with video demo
3. Feature showcase sections (8 key features)
4. Pricing/plans section
5. Testimonials carousel
6. FAQ accordion
7. Footer with links
8. Mobile-responsive design
9. Smooth scroll animations (Framer Motion)

### Components to Build
- `pages/Home.tsx` - Main landing page
- `components/landing/Hero.tsx`
- `components/landing/FeatureShowcase.tsx`
- `components/landing/VideoDemo.tsx`
- `components/landing/PricingPlans.tsx`
- `components/landing/Testimonials.tsx`
- `components/landing/FAQ.tsx`

### Validation
- [ ] Homepage loads under 2s
- [ ] Mobile responsive (375px - 1920px)
- [ ] All animations smooth (60fps)
- [ ] CTA buttons route correctly

---

## 🎬 Phase 2: Advanced Video Player (Week 1-2)
**Complexity**: 🔴 Complex
**Goal**: Player tracking, spotlights, filters, zoom controls

### Tasks
1. Integrate VideoJS with custom skin
2. Canvas overlay layer for bounding boxes
3. Player tracking controls (track selection, colors)
4. Spotlight effect (circle follows player)
5. Zoom controls (pan/zoom to player)
6. Filter toggles (boxes, labels, IDs, names)
7. Class filter (select specific play types)
8. Timeline scrubbing with frame accuracy
9. Playback controls (0.25x - 2x speed)

### Components to Build
- `components/video/AdvancedPlayer.tsx`
- `components/video/CanvasOverlay.tsx`
- `components/video/TrackingControls.tsx`
- `components/video/SpotlightLayer.tsx`
- `components/video/ZoomControls.tsx`
- `components/video/FilterPanel.tsx`
- `hooks/usePlayerTracking.ts`
- `hooks/useCanvasRenderer.ts`

### Validation
- [ ] Bounding boxes render at 30fps
- [ ] Spotlight follows player smoothly
- [ ] Zoom/pan responsive to controls
- [ ] Filters toggle instantly
- [ ] Timeline scrub frame-accurate

---

## 🗣️ Phase 3: AI Commentary System (Week 2)
**Complexity**: 🔴 Complex
**Goal**: Multi-voice AI narration like Hylytr

### Tasks
1. Integrate ElevenLabs or PlayHT API
2. Design commentary prompt templates
   - Pre-game (team lineups, player intros)
   - Live action (play-by-play)
   - Post-game (summary, highlights)
3. Voice style selector (4+ voices)
4. Multi-lingual support (English, Spanish)
5. Personality controls (energetic, witty, professional)
6. Commentary generation queue
7. Audio sync with video clips
8. Commentary editing interface

### Edge Functions to Build
- `supabase/functions/generate-commentary/index.ts`
- `supabase/functions/sync-audio-video/index.ts`

### Components to Build
- `components/commentary/VoiceSelector.tsx`
- `components/commentary/CommentaryEditor.tsx`
- `components/commentary/PersonalityControls.tsx`
- `pages/BroadcastSuite.tsx`

### Validation
- [ ] Commentary generates in <60s
- [ ] Audio syncs perfectly with video
- [ ] All voice styles sound professional
- [ ] Spanish commentary accurate

---

## 👤 Phase 4: Player Tracking & Analytics (Week 2-3)
**Complexity**: 🔴 Complex
**Goal**: Track individual players, generate stats

### Tasks
1. Reka.ai object detection for players
2. Manual player tagging interface (for correction)
3. Player database with profiles
4. Jersey number recognition
5. Position tracking (heatmaps)
6. Stats extraction (touches, distance, speed)
7. Auto-spotlight on tracked player
8. Player-specific highlight reels
9. Performance analytics dashboard

### Components to Build
- `components/tracking/PlayerTagger.tsx`
- `components/tracking/Heatmap.tsx`
- `components/analytics/StatsCard.tsx`
- `components/analytics/PerformanceTrends.tsx`
- `pages/PlayerProfile.tsx`
- `pages/Analytics.tsx`

### Validation
- [ ] Player detection >90% accurate
- [ ] Manual corrections save correctly
- [ ] Heatmaps render smoothly
- [ ] Stats calculate accurately

---

## 📡 Phase 5: Broadcast Suite (Week 3)
**Complexity**: ⚠️ Medium
**Goal**: Pre-game, live, post-game broadcasts

### Tasks
1. Pre-game template (lineups, player spotlights)
2. Player intro generator (audio announcements)
3. Live play-by-play template
4. Post-game wrap-up template
5. Starting lineup graphics generator
6. Match context AI (team history, rivalry)
7. Full broadcast compilation (all 3 segments)
8. Custom graphics overlays (scores, timers)

### Components to Build
- `components/broadcast/PreGameBuilder.tsx`
- `components/broadcast/PlayerIntroCard.tsx`
- `components/broadcast/LiveCommentary.tsx`
- `components/broadcast/PostGameWrap.tsx`
- `components/broadcast/LineupGraphic.tsx`

### Validation
- [ ] Pre-game generates in <2min
- [ ] Player intros sound professional
- [ ] Post-game summary accurate
- [ ] Full broadcast compiles correctly

---

## 📱 Phase 6: Social Media Tools (Week 3-4)
**Complexity**: ⚠️ Medium
**Goal**: Auto-captions, hashtags, platform optimization

### Tasks
1. Platform-specific export presets
   - Instagram: 9:16, 4:5, 1:1
   - TikTok: 9:16 with captions
   - Twitter: 16:9, landscape
   - YouTube: 16:9, 1080p
2. Auto-caption generation (Reka transcription)
3. Hashtag suggestion AI
4. Caption optimizer for each platform
5. Thumbnail generator
6. Music library integration
7. One-click share to platforms
8. Post scheduling

### Components to Build
- `components/social/ExportPresets.tsx`
- `components/social/CaptionGenerator.tsx`
- `components/social/HashtagSuggester.tsx`
- `components/social/ThumbnailEditor.tsx`
- `components/social/MusicSelector.tsx`
- `pages/SocialStudio.tsx`

### Validation
- [ ] All aspect ratios render correctly
- [ ] Captions sync with audio
- [ ] Hashtags relevant to content
- [ ] Music licensing clear

---

## 👥 Phase 7: Team Collaboration (Week 4)
**Complexity**: ⚠️ Medium
**Goal**: Multi-user teams, combined highlights

### Tasks
1. Team creation/invitation system
2. Shared video library
3. Team highlight builder (combine clips)
4. Role-based permissions (admin, editor, viewer)
5. Real-time collaboration (Supabase Realtime)
6. Comment/annotation system
7. Team roster management
8. Combined stats dashboard

### Components to Build
- `components/teams/TeamInvite.tsx`
- `components/teams/SharedLibrary.tsx`
- `components/teams/TeamReelBuilder.tsx`
- `components/teams/RosterManager.tsx`
- `components/teams/CollabControls.tsx`
- `pages/Team.tsx`

### Validation
- [ ] Invites send correctly
- [ ] Real-time updates work
- [ ] Permissions enforce properly
- [ ] Team reels combine seamlessly

---

## 📊 Phase 8: Advanced Export & Stats (Week 4-5)
**Complexity**: 🔴 Complex
**Goal**: Professional exports, progress tracking

### Tasks
1. FFmpeg edge function for exports
2. Music/transition library
3. Multi-format export (MP4, MOV, WebM)
4. Quality presets (720p, 1080p, 4K)
5. Progress tracking database
6. Hot/cold trend analysis
7. Season-over-season comparisons
8. Recruiting reel builder
9. Coach AI chat (RAG on game footage)
10. Bookmark/favorites system

### Edge Functions to Build
- `supabase/functions/export-video/index.ts`
- `supabase/functions/coach-ai-chat/index.ts`

### Components to Build
- `components/export/ExportWizard.tsx`
- `components/export/QualitySelector.tsx`
- `components/export/TransitionPicker.tsx`
- `components/stats/TrendChart.tsx`
- `components/chat/CoachAI.tsx`
- `pages/RecruitingCenter.tsx`

### Validation
- [ ] Exports complete in <5min
- [ ] Music syncs properly
- [ ] Trends calculate accurately
- [ ] Coach AI responses helpful

---

## 🎨 Phase 9: Polish & Performance (Week 5-6)
**Complexity**: ⚠️ Medium
**Goal**: Production-ready quality

### Tasks
1. Loading states for all async operations
2. Error boundaries with retry logic
3. Skeleton screens
4. Toast notifications
5. Keyboard shortcuts
6. Accessibility (WCAG 2.1 AA)
7. SEO optimization
8. Performance optimization (<3s load)
9. Mobile app setup (React Native or Capacitor)
10. Documentation & tutorials

### Validation
- [ ] Lighthouse score >90
- [ ] No console errors
- [ ] Accessible to screen readers
- [ ] Mobile app functional

---

## Technology Decisions

### Video Processing
- **Player Detection**: Reka.ai Vision API (primary)
- **Local Fallback**: TensorFlow.js (COCO-SSD model)
- **Video Export**: FFmpeg via Supabase Edge Functions

### AI Commentary
- **Voice Generation**: ElevenLabs (primary), PlayHT (fallback)
- **Script Generation**: OpenAI GPT-4 or Claude Sonnet

### Graphics
- **Intros/Outros**: Remotion (React-based video)
- **Overlays**: HTML Canvas API
- **Animations**: Framer Motion

### Storage
- **Raw Videos**: Supabase Storage (unlimited)
- **Processed Clips**: Reka Cloud URLs (cached)
- **Audio Tracks**: Supabase Storage

---

## Cost Estimates (Monthly)

### API Costs
- Reka.ai: ~$50-200 (depends on video volume)
- ElevenLabs: ~$30-100 (depends on commentary minutes)
- Supabase: Free tier → Pro ($25) when needed
- OpenAI: ~$20-50 (for prompts, not video)

### Total: **$100-400/month** for moderate usage

---

## Success Metrics

### User Experience
- Homepage load: <2s
- Video processing: <10min per 90min game
- Commentary generation: <60s per clip
- Export render: <5min per 2min highlight

### Technical
- Player tracking accuracy: >90%
- Commentary quality: Professional-sounding
- Export success rate: >95%
- Uptime: >99%

---

## Next Steps

1. **Review & Approve**: Does this align with your vision?
2. **Prioritize**: Which phases are must-have vs nice-to-have?
3. **Start Phase 1**: Build landing page first (marketing/awareness)
4. **Iterate**: Get feedback after each phase

---

## Notes

- Can enable **Playwright CLI** for automated testing of each feature
- Consider **freemium model**: Free tier (limited clips), Pro tier (unlimited)
- **Mobile apps** (Phase 9) could be deferred to post-launch
- **Coach AI** requires RAG on video transcripts (moderate complexity)

---

**Ready to start?** Let me know which phase to tackle first, or if you want to adjust priorities!
