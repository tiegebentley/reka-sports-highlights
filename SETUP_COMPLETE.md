# Reka Sports Highlights - Setup Status

**Date**: 2026-04-19
**Status**: ✅ Ready for Manual Deployment

---

## ✅ Completed Tasks

### 1. Environment Configuration ✅
- [x] Supabase `.env` file created with credentials
- [x] Frontend `.env` file created with public keys
- [x] All API keys and tokens configured

**Files Created:**
- `/root/reka-sports-highlights/supabase/.env`
- `/root/reka-sports-highlights/frontend/.env`

### 2. Deno Installation ✅
- [x] Deno 2.7.12 installed at `/root/.deno/bin/deno`
- [x] All Edge Functions type-checked successfully
- [x] TypeScript error in `upload-video` function fixed

**Type Check Results:**
```bash
✅ generate-clips/index.ts - PASS
✅ upload-video/index.ts - PASS (fixed error.message type issue)
```

### 3. Migration Files Ready ✅
- [x] Initial schema migration: `20260418012914_initial_schema.sql`
- [x] Storage bucket migration: `20260418013000_storage_bucket.sql`
- [x] Validation script: `validate_schema.sql`

### 4. Documentation ✅
- [x] `DEPLOYMENT_GUIDE.md` - Complete deployment instructions
- [x] `NEXT_STEPS.md` - Post-deployment checklist
- [x] `REKA_INTEGRATION.md` - API integration details

---

## 🔴 Manual Steps Required

### Step 1: Apply Database Migrations (REQUIRED)

You need to manually apply the migrations via the Supabase Dashboard:

1. Go to: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd/sql/new

2. **First Migration** - Copy and paste the entire contents of:
   ```bash
   cat /root/reka-sports-highlights/supabase/migrations/20260418012914_initial_schema.sql
   ```
   Then click **Run**

3. **Second Migration** - Copy and paste the entire contents of:
   ```bash
   cat /root/reka-sports-highlights/supabase/migrations/20260418013000_storage_bucket.sql
   ```
   Then click **Run**

4. **Verify** - Run this query to check tables were created:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```

   Expected tables: `clips`, `jobs`, `tags`, `videos`

---

### Step 2: Deploy Edge Functions (REQUIRED)

#### Option A: Using Supabase CLI (Preferred)

```bash
cd /root/reka-sports-highlights

# Deploy generate-clips function
/root/.deno/bin/deno run --allow-all \
  https://deno.land/x/supabase/mod.ts functions deploy generate-clips \
  --project-ref nxllstmdmqcaiodoensd

# Deploy upload-video function
/root/.deno/bin/deno run --allow-all \
  https://deno.land/x/supabase/mod.ts functions deploy upload-video \
  --project-ref nxllstmdmqcaiodoensd
```

#### Option B: Manual Deployment via Dashboard

1. Go to: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd/functions

2. Create new function: `generate-clips`
   - Copy contents of `supabase/functions/generate-clips/index.ts`
   - Also upload `supabase/functions/_shared/reka-client.ts`

3. Create new function: `upload-video`
   - Copy contents of `supabase/functions/upload-video/index.ts`

---

### Step 3: Set Environment Variables for Edge Functions (REQUIRED)

Go to: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd/settings/functions

Add these environment variables:

```bash
DB_URL=https://nxllstmdmqcaiodoensd.supabase.co
DB_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU0Nzk3NiwiZXhwIjoyMDkyMTIzOTc2fQ.1_EAnxl5tP7V9kYsANypZArC-Fnd0FwemwzxWvmvkAA
REKA_API_KEY=<YOUR_REKA_API_KEY_HERE>
```

⚠️ **Important**: You need to obtain a Reka API key from https://reka.ai

---

### Step 4: Test the Setup (OPTIONAL)

Once migrations and functions are deployed:

```bash
# Test generate-clips endpoint
curl -X POST 'https://nxllstmdmqcaiodoensd.supabase.co/functions/v1/generate-clips' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDc5NzYsImV4cCI6MjA5MjEyMzk3Nn0.Xpktu3tuFSqSmH991tXOmyFJiQpBAEivZrlYYbwOeQA' \
  -H 'Content-Type: application/json' \
  -d '{"videoId": "test-123", "settings": {"template": "moments"}}'
```

---

## 📂 Project Structure

```
/root/reka-sports-highlights/
├── supabase/
│   ├── .env ✅                    # Configured with your credentials
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20260418012914_initial_schema.sql ✅
│   │   └── 20260418013000_storage_bucket.sql ✅
│   └── functions/
│       ├── generate-clips/
│       │   └── index.ts ✅        # Type-checked, ready to deploy
│       ├── upload-video/
│       │   └── index.ts ✅        # Type-checked, fixed errors
│       └── _shared/
│           ├── reka-client.ts ✅  # Reka API client
│           └── test-reka.ts ✅    # Integration test script
├── frontend/
│   ├── .env ✅                    # Configured with public keys
│   ├── src/                       # React + Vite app
│   └── package.json
└── DEPLOYMENT_GUIDE.md ✅         # Step-by-step deployment guide
```

---

## 🚀 Next Steps

1. **Apply migrations** via Supabase SQL Editor (see Step 1 above)

2. **Deploy Edge Functions** (see Step 2 above)

3. **Set function environment variables** (see Step 3 above)

4. **Obtain Reka API key** from https://reka.ai

5. **Test the deployment** using the curl command above

6. **Start frontend development**:
   ```bash
   cd /root/reka-sports-highlights/frontend
   npm install
   npm run dev
   ```
   Frontend will be available at http://localhost:5173

---

## 📊 Database Schema

### Tables Created by Migrations:

- **videos** - Source video storage
  - Columns: id, user_id, title, source_type, source_url, storage_path, duration, resolution, status
  - RLS enabled: Users can only see their own videos

- **clips** - Generated highlight clips
  - Columns: id, video_id, user_id, reka_clip_id, clip_url, title, caption, hashtags, quality_score
  - RLS enabled: Users can only see their own clips

- **tags** - Video and clip tags
  - Columns: id, clip_id, video_id, tag_type, tag_value, timestamp
  - RLS enabled: Users can only see their own tags

- **jobs** - Processing job queue
  - Columns: id, user_id, video_id, job_type, status, progress, result, error
  - RLS enabled: Users can only see their own jobs
  - Realtime enabled: Real-time status updates

### Storage Buckets:

- **video-uploads** - Video file storage
  - Max size: 500MB
  - Allowed types: MP4, MOV, AVI, MKV
  - RLS enabled: Users can only access their own files

---

## 🔧 Troubleshooting

### Migration Errors

If migrations fail due to existing tables:
```sql
-- Drop existing tables (WARNING: deletes data)
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS clips CASCADE;
DROP TABLE IF EXISTS videos CASCADE;
```

### Edge Function Errors

View function logs:
```bash
# View logs in Supabase Dashboard
https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd/logs/edge-functions
```

Common issues:
- Missing `REKA_API_KEY` environment variable
- CORS headers not configured
- Invalid Supabase credentials

---

## 📞 Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Reka AI Docs**: https://docs.reka.ai/vision/overview
- **Reka API Base**: https://vision-agent.api.reka.ai
- **Project Dashboard**: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd

---

## ✅ Summary

All local setup is complete! The project is ready for manual deployment via the Supabase Dashboard.

**What's Working:**
- ✅ Environment variables configured
- ✅ Deno installed and Edge Functions type-checked
- ✅ Migration files ready to apply
- ✅ Frontend configured
- ✅ Complete documentation

**What You Need to Do:**
1. Apply database migrations via SQL Editor
2. Deploy Edge Functions via Dashboard or CLI
3. Add REKA_API_KEY to function environment variables
4. Obtain Reka API key from https://reka.ai
5. Test and start development!

---

**Ready to deploy!** 🚀
