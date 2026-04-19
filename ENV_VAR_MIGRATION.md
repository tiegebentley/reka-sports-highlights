# Environment Variable Migration - COMPLETE ✅

**Date**: 2026-04-19  
**Reason**: Environment variables cannot contain "SUPABASE" in the name

---

## Changes Made

All environment variables have been renamed from `SUPABASE_*` to `DB_*` prefix:

| Old Variable | New Variable |
|-------------|-------------|
| `SUPABASE_URL` | `DB_URL` |
| `SUPABASE_ANON_KEY` | `DB_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `DB_SERVICE_ROLE_KEY` |
| `VITE_SUPABASE_URL` | `VITE_DB_URL` |
| `VITE_SUPABASE_ANON_KEY` | `VITE_DB_ANON_KEY` |

---

## Files Updated

### Source Code (5 files)
- ✅ `supabase/functions/generate-clips/index.ts`
- ✅ `supabase/functions/upload-video/index.ts`
- ✅ `frontend/src/lib/supabase.ts`
- ✅ `supabase/.env.example`
- ✅ `frontend/.env.example`

### Environment Files (2 files)
- ✅ `supabase/.env` - Created with new variable names
- ✅ `frontend/.env` - Created with new variable names

### Documentation (10+ files)
- ✅ `CLAUDE.md`
- ✅ `DEPLOYMENT_GUIDE.md`
- ✅ `QUICK_DEPLOY.md`
- ✅ `SETUP_COMPLETE.md`
- ✅ `MANUAL_DEPLOY.md`
- ✅ `BETA_INFRASTRUCTURE_STATUS.md`
- ✅ `GAMMA_LEAD_REPORT.md`
- ✅ `NEXT_STEPS.md`
- ✅ `frontend/README.md`
- ✅ `supabase/functions/README.md`
- ✅ `supabase/REKA_INTEGRATION.md`
- ✅ `.ace/planning/PROJECT.md`
- ✅ `.agent/plans/1.1-project-setup.md`

---

## Current Configuration

### Edge Functions (Supabase)
```bash
DB_URL=https://nxllstmdmqcaiodoensd.supabase.co
DB_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DB_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
REKA_API_KEY=<your-reka-api-key>
```

### Frontend
```bash
VITE_DB_URL=https://nxllstmdmqcaiodoensd.supabase.co
VITE_DB_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## What You Need to Do

### ⚠️ IMPORTANT: Update Supabase Dashboard

The environment variables in the **Supabase Dashboard** must be updated manually:

1. Go to: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd/settings/functions

2. **Delete old variables** (if they exist):
   - ❌ `SUPABASE_URL`
   - ❌ `SUPABASE_ANON_KEY`
   - ❌ `SUPABASE_SERVICE_ROLE_KEY`

3. **Add new variables**:
   - ✅ `DB_URL` = `https://nxllstmdmqcaiodoensd.supabase.co`
   - ✅ `DB_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDc5NzYsImV4cCI6MjA5MjEyMzk3Nn0.Xpktu3tuFSqSmH991tXOmyFJiQpBAEivZrlYYbwOeQA`
   - ✅ `DB_SERVICE_ROLE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU0Nzk3NiwiZXhwIjoyMDkyMTIzOTc2fQ.1_EAnxl5tP7V9kYsANypZArC-Fnd0FwemwzxWvmvkAA`
   - ✅ `REKA_API_KEY` = `<your-reka-api-key>`

4. **Save** and **redeploy** Edge Functions:
   ```bash
   cd /root/reka-sports-highlights
   export PATH="/root/.deno/bin:$PATH"
   supabase functions deploy generate-clips --project-ref nxllstmdmqcaiodoensd
   supabase functions deploy upload-video --project-ref nxllstmdmqcaiodoensd
   ```

---

## Testing

After updating dashboard variables and redeploying:

```bash
# Test generate-clips function
curl -X POST 'https://nxllstmdmqcaiodoensd.supabase.co/functions/v1/generate-clips' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json' \
  -d '{"videoId": "test"}'

# Start frontend
cd /root/reka-sports-highlights/frontend
npm run dev
```

Open http://localhost:5173 and verify:
- ✅ No console errors about missing environment variables
- ✅ Database connection works
- ✅ Authentication flow works (if implemented)

---

## Backward Compatibility

❌ **No backward compatibility** - The old `SUPABASE_*` variable names will NOT work.

If you have any external services or scripts using the old names, update them to use the new `DB_*` names.

---

## Rollback (if needed)

If you need to rollback:

```bash
cd /root/reka-sports-highlights

# Revert all changes
git checkout supabase/functions/generate-clips/index.ts
git checkout supabase/functions/upload-video/index.ts
git checkout frontend/src/lib/supabase.ts
git checkout supabase/.env.example
git checkout frontend/.env.example

# Update dashboard back to SUPABASE_* variables
# Redeploy functions
```

---

## Summary

✅ **All code and documentation updated**  
✅ **Environment files created with new names**  
⚠️ **Manual action required**: Update Supabase Dashboard variables  
⚠️ **Manual action required**: Redeploy Edge Functions

---

**Status**: Ready to deploy with new environment variable names
