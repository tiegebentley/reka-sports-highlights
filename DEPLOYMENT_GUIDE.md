# Reka Sports Highlights - Deployment Guide

## Step 1: Apply Database Migrations

### Option A: Using Supabase Dashboard (RECOMMENDED)

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd

2. Click on **SQL Editor** in the left sidebar

3. Create a new query and paste the contents of:
   - `supabase/migrations/20260418012914_initial_schema.sql`

4. Click **Run** (or press Ctrl+Enter)

5. Create another new query and paste the contents of:
   - `supabase/migrations/20260418013000_storage_bucket.sql`

6. Click **Run**

7. Verify tables created:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public';
   ```

   You should see: `videos`, `clips`, `tags`, `jobs`

### Option B: Using `supabase db push` (if you have access)

```bash
cd /root/reka-sports-highlights
supabase db push
```

---

## Step 2: Configure Environment Variables

### For Edge Functions (Supabase Dashboard)

1. Go to: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd/settings/functions

2. Add the following environment variables:

```
DB_URL=https://nxllstmdmqcaiodoensd.supabase.co
DB_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDc5NzYsImV4cCI6MjA5MjEyMzk3Nn0.Xpktu3tuFSqSmH991tXOmyFJiQpBAEivZrlYYbwOeQA
DB_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU0Nzk3NiwiZXhwIjoyMDkyMTIzOTc2fQ.1_EAnxl5tP7V9kYsANypZArC-Fnd0FwemwzxWvmvkAA
REKA_API_KEY=<your-reka-api-key>
```

### For Frontend

Create `/root/reka-sports-highlights/frontend/.env`:

```bash
VITE_DB_URL=https://nxllstmdmqcaiodoensd.supabase.co
VITE_DB_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDc5NzYsImV4cCI6MjA5MjEyMzk3Nn0.Xpktu3tuFSqSmH991tXOmyFJiQpBAEivZrlYYbwOeQA
```

---

## Step 3: Deploy Edge Functions

### Check if Deno is installed

```bash
deno --version
```

If not installed:
```bash
curl -fsSL https://deno.land/install.sh | sh
export PATH="$HOME/.deno/bin:$PATH"
```

### Deploy Functions

```bash
cd /root/reka-sports-highlights

# Deploy upload-video function
supabase functions deploy upload-video --project-ref nxllstmdmqcaiodoensd

# Deploy generate-clips function
supabase functions deploy generate-clips --project-ref nxllstmdmqcaiodoensd
```

---

## Step 4: Test the Deployment

### Test Edge Function

```bash
# Test generate-clips endpoint
curl -X POST 'https://nxllstmdmqcaiodoensd.supabase.co/functions/v1/generate-clips' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDc5NzYsImV4cCI6MjA5MjEyMzk3Nn0.Xpktu3tuFSqSmH991tXOmyFJiQpBAEivZrlYYbwOeQA' \
  -H 'Content-Type: application/json' \
  -d '{
    "videoId": "123",
    "settings": {
      "template": "moments",
      "num_clips": 1
    }
  }'
```

---

## Step 5: Start Frontend Development

```bash
cd /root/reka-sports-highlights/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend will be available at: http://localhost:5173

---

## Troubleshooting

### Migration Errors

If migrations fail, check:
- Vector extension enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
- RLS policies don't conflict with existing policies

### Edge Function Errors

View logs:
```bash
supabase functions logs generate-clips --project-ref nxllstmdmqcaiodoensd
```

Common issues:
- Missing `REKA_API_KEY` environment variable
- Incorrect Supabase URL or keys
- CORS issues (check function headers)

### Storage Bucket Issues

If the storage bucket fails to create:
1. Go to: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd/storage/buckets
2. Manually create bucket:
   - Name: `video-uploads`
   - Public: No
   - File size limit: 500MB
   - Allowed MIME types: video/mp4, video/quicktime, video/x-msvideo, video/x-matroska

---

## Next Steps

1. ✅ Obtain Reka API key from https://reka.ai
2. ✅ Test clip generation with a sample video
3. ✅ Build frontend upload UI
4. ✅ Implement background polling for job status
5. ✅ Add clip download/export features

---

## Support

- Supabase Docs: https://supabase.com/docs
- Reka AI Docs: https://docs.reka.ai
- Project Status: See `PROGRESS.md`
