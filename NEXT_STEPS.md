# Next Steps - Reka Sports Highlights

## Current Status
✅ Database schema created
✅ Edge Functions scaffolded
✅ Migration files ready
🔴 **Awaiting Supabase project link**

---

## Quick Start (After Project Link)

### Option 1: Link Existing Supabase Project
```bash
cd /root/reka-sports-highlights

# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push

# Deploy edge functions
supabase functions deploy upload-video
supabase functions deploy generate-clips

# Set environment variables in Supabase dashboard
# Functions → upload-video → Settings → Environment Variables:
DB_URL=https://xxx.supabase.co
DB_ANON_KEY=xxx
DB_SERVICE_ROLE_KEY=xxx
REKA_API_KEY=xxx
```

### Option 2: Create New Supabase Project
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Name: `reka-sports-highlights`
4. Database password: [secure password]
5. Region: Choose closest to users
6. Wait for project to initialize (~2 minutes)
7. Follow "Option 1" steps above

### Option 3: Local Development (Requires Docker)
```bash
cd /root/reka-sports-highlights

# Start local Supabase
supabase start

# Apply migrations
supabase db reset

# Edge functions run locally
supabase functions serve
```

---

## Validation After Deployment

### 1. Check Database
```bash
# View migration status
supabase migration list

# Connect to database
psql postgres://postgres:[password]@db.[project].supabase.co:5432/postgres

# Run validation
\i supabase/migrations/validate_schema.sql
```

### 2. Test Edge Functions
```bash
# Test upload-video
curl -X POST 'https://xxx.supabase.co/functions/v1/upload-video' \
  -H 'Authorization: Bearer [ANON_KEY]' \
  -H 'Content-Type: application/json' \
  -d '{"title": "Test", "sourceType": "youtube", "sourceUrl": "https://youtube.com/watch?v=test"}'

# Expected response:
# {
#   "success": true,
#   "video": { "id": "...", "title": "Test", ... }
# }
```

### 3. Verify Storage Bucket
- Go to Supabase Dashboard → Storage
- Check `video-uploads` bucket exists
- Verify policies are active

### 4. Enable Realtime
- Go to Supabase Dashboard → Database → Replication
- Enable realtime for `jobs` table (should already be enabled)

---

## Frontend Integration

Update `frontend/.env`:
```bash
VITE_DB_URL=https://xxx.supabase.co
VITE_DB_ANON_KEY=xxx
```

---

## Troubleshooting

### Migration Fails
```bash
# Check current schema
supabase db diff

# Reset database (WARNING: deletes all data)
supabase db reset
```

### Edge Function Errors
```bash
# View logs
supabase functions logs upload-video
supabase functions logs generate-clips

# Common issues:
# - Missing environment variables
# - Invalid Reka API key
# - Network timeout (increase function timeout in config)
```

### RLS Blocking Queries
```sql
-- Temporarily disable RLS for testing (NOT for production)
ALTER TABLE videos DISABLE ROW LEVEL SECURITY;

-- Re-enable
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
```

---

## Environment Variables Checklist

### Supabase Dashboard (Functions → Settings)
- [ ] `DB_URL`
- [ ] `DB_ANON_KEY`
- [ ] `DB_SERVICE_ROLE_KEY`
- [ ] `REKA_API_KEY`
- [ ] `REKA_POLL_MAX_ATTEMPTS` (optional, default: 60)
- [ ] `REKA_POLL_INTERVAL_MS` (optional, default: 5000)

### Frontend `.env`
- [ ] `VITE_DB_URL`
- [ ] `VITE_DB_ANON_KEY`
- [ ] `VITE_API_BASE_URL` (for local dev: http://localhost:54321)

---

## Contact Points

**Beta Lead**: Database & Backend Infrastructure
**Questions**: See `BETA_INFRASTRUCTURE_STATUS.md` for detailed specs
