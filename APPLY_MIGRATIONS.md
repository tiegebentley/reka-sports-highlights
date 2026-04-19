# Apply Database Migrations

You need to run these migrations in the Supabase SQL Editor to set up the database.

## Step 1: Apply Initial Schema

Go to: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd/sql/new

Copy and paste this command to get the migration:

```bash
cat /root/reka-sports-highlights/supabase/migrations/20260418012914_initial_schema.sql
```

Then click **"Run"** in the SQL editor.

## Step 2: Apply Storage Bucket Migration

Copy and paste this command to get the second migration:

```bash
cat /root/reka-sports-highlights/supabase/migrations/20260418013000_storage_bucket.sql
```

Then click **"Run"** in the SQL editor.

## Step 3: Test Upload Again

After both migrations are applied, try uploading a video again at:
http://localhost:5175/upload

---

## Quick Test Query

To verify migrations were applied, run this in SQL editor:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check storage bucket exists
SELECT * FROM storage.buckets WHERE id = 'video-uploads';
```

Expected tables: `clips`, `jobs`, `tags`, `videos`
Expected bucket: `video-uploads`
