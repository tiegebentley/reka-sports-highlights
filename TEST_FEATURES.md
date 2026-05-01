# Reka Sports Highlights - Feature Testing Guide

**Server**: http://localhost:5175
**Status**: ✅ Running
**Phase**: 6 Complete (Stats Tracking & Analytics)

---

## 📋 Feature Test Checklist

### 1. Stats Demo (/stats-demo) ⚽

**Purpose**: Comprehensive player statistics visualization with heatmaps

**Test Steps**:
1. Navigate to http://localhost:5175/stats-demo
2. Verify demo player stats display (Marcus Silva #10)
3. Check rating calculation (0-10 scale with color coding)
4. Test view mode toggles:
   - Stats Only
   - Heatmap Only
   - Combined View (both)
5. Verify stats categories:
   - Offensive (goals, assists, passes, shots)
   - Defensive (tackles, interceptions, clearances)
   - Physical (distance, speed, sprints)
   - Discipline (fouls, dispossessed)
6. Check heatmap visualization:
   - Soccer pitch rendered correctly
   - Movement intensity colors (blue → yellow → red)
   - Grid overlay toggle
   - Max intensity display

**Expected Results**:
- ✅ Player rating: ~8.5/10 (Excellent - teal color)
- ✅ 90 minutes played (5400 seconds)
- ✅ Goals: 2, Assists: 1
- ✅ Distance: 10,523m, Max Speed: 28.5 km/h
- ✅ Pass Accuracy: 82.7%
- ✅ Heatmap shows central attacking midfielder pattern

---

### 2. Player Tracking Demo (/player-demo) 🎯

**Purpose**: AI-powered player detection and tracking visualization

**Test Steps**:
1. Navigate to http://localhost:5175/player-demo
2. Check if demo shows player tracking overlays
3. Verify tracking bounding boxes
4. Test player identification
5. Check tracking smoothness

**Expected Results**:
- ✅ Player bounding boxes visible
- ✅ Player IDs/names displayed
- ✅ Tracking follows movement
- ✅ Multiple players tracked simultaneously

---

### 3. Commentary Demo (/commentary-demo) 🎙️

**Purpose**: AI-generated sports commentary

**Test Steps**:
1. Navigate to http://localhost:5175/commentary-demo
2. Check commentary generation
3. Verify commentary matches video events
4. Test different commentary styles
5. Check audio generation (if enabled)

**Expected Results**:
- ✅ Commentary text generated
- ✅ Events properly described
- ✅ Professional commentary tone
- ✅ Accurate event timing

---

### 4. Export Demo (/export-demo) 📤

**Purpose**: Video export pipeline with overlays and effects

**Test Steps**:
1. Navigate to http://localhost:5175/export-demo
2. Test export configuration options:
   - Resolution (720p, 1080p, 4K)
   - Overlays (stats, commentary, watermarks)
   - Effects (slow-mo, highlights)
3. Verify export preview
4. Check export progress tracking

**Expected Results**:
- ✅ Export configuration UI loads
- ✅ Preview renders correctly
- ✅ Multiple export formats available
- ✅ Progress tracking functional

---

### 5. Video Upload (/upload) 📹

**Purpose**: Upload videos for Reka AI processing

**Test Steps**:
1. Navigate to http://localhost:5175/upload
2. Check upload interface
3. Verify file type validation (MP4, MOV, AVI)
4. Test drag-and-drop functionality
5. Check upload progress tracking
6. Verify Reka AI processing status

**Expected Results**:
- ✅ Upload UI renders
- ✅ File validation works
- ✅ Drag-and-drop functional
- ✅ Progress bar updates
- ✅ Processing status visible

---

### 6. Video Library (/library) 📚

**Purpose**: View all uploaded and processed videos

**Test Steps**:
1. Navigate to http://localhost:5175/library
2. Check video grid/list display
3. Verify video thumbnails
4. Test video filtering/sorting
5. Check video metadata display
6. Test video selection

**Expected Results**:
- ✅ Videos displayed in grid
- ✅ Thumbnails load correctly
- ✅ Filtering/sorting works
- ✅ Metadata accurate
- ✅ Selection functional

---

### 7. Video Detail (/videos/:videoId) 🎬

**Purpose**: View individual video with tracking and stats

**Test Steps**:
1. Navigate to video detail page (requires video ID)
2. Check video player loads
3. Verify tracking overlays
4. Test player stats display
5. Check heatmap integration
6. Test commentary sync

**Expected Results**:
- ✅ Video plays smoothly
- ✅ Tracking overlays visible
- ✅ Stats accurate
- ✅ Heatmap renders
- ✅ Commentary synchronized

---

### 8. Tracking Studio (/videos/:videoId/track) 🎨

**Purpose**: Manual tracking adjustment interface

**Test Steps**:
1. Navigate to tracking studio
2. Check tracking timeline
3. Test manual adjustments
4. Verify player ID assignment
5. Check keyframe editing

**Expected Results**:
- ✅ Timeline renders
- ✅ Manual adjustments work
- ✅ Player IDs assignable
- ✅ Keyframes editable
- ✅ Changes save properly

---

### 9. Authentication (/login, /signup) 🔐

**Purpose**: User authentication via Supabase

**Test Steps**:
1. Navigate to /login
2. Test login form validation
3. Navigate to /signup
4. Test signup form validation
5. Verify email/password requirements
6. Test login/logout flow

**Expected Results**:
- ✅ Form validation works
- ✅ Error messages clear
- ✅ Authentication successful
- ✅ Session persists
- ✅ Logout functional

---

### 10. Profile (/profile) 👤

**Purpose**: User profile and settings

**Test Steps**:
1. Navigate to /profile (requires auth)
2. Check profile information display
3. Test profile editing
4. Verify password change
5. Check account settings

**Expected Results**:
- ✅ Profile loads
- ✅ Editing works
- ✅ Password change functional
- ✅ Settings save

---

## 🔧 Technical Tests

### Database Connectivity
```bash
# Check Supabase connection
curl -I https://gsowhyspgmnbwghijwbs.supabase.co
```

### Edge Functions
```bash
# Test calculate-stats function
curl -X POST https://gsowhyspgmnbwghijwbs.supabase.co/functions/v1/calculate-stats \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"videoId":"test"}'
```

### Real-time Subscriptions
- Test Supabase Realtime for upload progress
- Verify video processing status updates
- Check live stats updates

---

## 🐛 Known Issues to Test

1. **TypeScript Export** (FIXED ✅)
   - PlayerStats type not exported from index
   - Solution: Added export to types/index.ts

2. **Browser Cache**
   - Vite may cache old modules
   - Solution: Clear .vite folder on errors

3. **Supabase Connection**
   - Check .env configuration
   - Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

---

## 📊 Test Results Template

| Feature | Status | Notes |
|---------|--------|-------|
| Stats Demo | ⏳ | Testing in progress |
| Player Tracking Demo | ⏳ | |
| Commentary Demo | ⏳ | |
| Export Demo | ⏳ | |
| Video Upload | ⏳ | |
| Video Library | ⏳ | |
| Video Detail | ⏳ | |
| Tracking Studio | ⏳ | |
| Authentication | ⏳ | |
| Profile | ⏳ | |

**Legend**:
- ✅ Pass
- ❌ Fail
- ⚠️ Partial/Issues
- ⏳ Not tested yet

---

## 🚀 Next Steps After Testing

1. Document any bugs found
2. Create issues for critical problems
3. Test with real video data
4. Performance testing with large videos
5. Begin Phase 7 (Team Collaboration)

---

**Testing Started**: 2026-04-30
**Tester**: Claude Code
**Environment**: Development (localhost:5175)
