# Resume Guide - Reka Sports Highlights

**Date**: 2026-04-19
**Status**: ✅ Upload functionality working!

## What's Working

### ✅ Authentication
- Login page: `/login`
- Signup page: `/signup`
- JWT signing: HS256 (rotated from ES256)
- Session persistence enabled

### ✅ File Upload
- Upload page: `/upload`
- File upload with drag-and-drop
- URL upload (YouTube/Twitch detection)
- Storage bucket: `video-uploads` (public)
- Edge Function: `upload-video` (deployed)

### ✅ Database
- Table: `videos` with RLS policies
- Users can insert/view their own videos
- Service role bypasses RLS for storage operations

## Environment Variables

### Frontend (.env)
```
VITE_DB_URL=https://nxllstmdmqcaiodoensd.supabase.co
VITE_DB_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Supabase Dashboard (Edge Functions - Auto-provided)
- `SUPABASE_URL` (reserved)
- `SUPABASE_ANON_KEY` (reserved)
- `SUPABASE_SERVICE_ROLE_KEY` (reserved)
- `REKA_API_KEY` (custom - you added this)

**Important**: SUPABASE_* variables are RESERVED and automatically provided to Edge Functions.

## Project Structure

```
/root/reka-sports-highlights/
├── frontend/                 # React + Vite (port 5173)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Upload.tsx   # ✅ Working
│   │   │   ├── Login.tsx    # ✅ Working
│   │   │   ├── Signup.tsx   # ✅ Working
│   │   │   ├── Videos.tsx   # TODO: List videos
│   │   │   └── VideoDetail.tsx  # TODO: View clips
│   │   └── lib/
│   │       └── supabase.ts  # Client config
│   └── .env
├── supabase/
│   └── functions/
│       ├── upload-video/    # ✅ Deployed
│       │   └── index.ts
│       └── generate-clips/  # ✅ Deployed (not tested)
│           └── index.ts
└── supabase/.env
```

## How to Start Development

```bash
# 1. Start frontend
cd /root/reka-sports-highlights/frontend
npm run dev
# Opens at http://localhost:5173

# 2. Test upload
# - Go to http://localhost:5173/upload
# - Login with: secondbrain189@gmail.com
# - Upload a video file
```

## Key Fixes Applied Today

1. **JWT Algorithm**: Rotated from ES256 to HS256
2. **Storage RLS**: Used service role key in Edge Function to bypass RLS
3. **Videos RLS**: Created proper INSERT/SELECT policies
4. **Storage Bucket**: Created `video-uploads` bucket (public)
5. **Environment Variables**: Renamed frontend vars to VITE_DB_* (SUPABASE_* reserved)

## Next Steps

### 1. Videos List Page
- Create `/videos` route
- Fetch videos from database
- Display in grid/list with thumbnails

### 2. Clip Generation
- Test `generate-clips` Edge Function
- Integrate Reka API
- Store clips in database

### 3. Video Detail Page
- View uploaded video
- Display generated clips
- Download/share clips

## Testing Credentials

- Email: `secondbrain189@gmail.com`
- Password: [you know it]
- User ID: `7c008f51-43f9-4ef5-8829-696ad3b2d8fd`

## Deployed Functions

```bash
# View logs
supabase functions logs upload-video --project-ref nxllstmdmqcaiodoensd
supabase functions logs generate-clips --project-ref nxllstmdmqcaiodoensd

# Redeploy if needed
supabase functions deploy upload-video --project-ref nxllstmdmqcaiodoensd
supabase functions deploy generate-clips --project-ref nxllstmdmqcaiodoensd
```

## Database Access

- **Project**: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd
- **Storage**: Storage → Buckets → video-uploads
- **Database**: Table Editor → videos
- **SQL Editor**: For running queries

## Current Test Upload

Last successful upload:
- Video ID: `1cd584d1-5f83-47fe-a1e9-7248dad98197`
- Title: "Small Group Soccer U11 _ Performance Training..."
- Storage path: `7c008f51-43f9-4ef5-8829-696ad3b2d8fd/1776568487658_...`
- Status: `uploaded`

---

**Ready to continue tomorrow! 🚀**
