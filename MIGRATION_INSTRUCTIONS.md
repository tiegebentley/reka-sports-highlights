# How to Apply Infrastructure Extension Migration

## Option 1: Supabase Studio (Recommended)

1. Open your Supabase project dashboard: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd

2. Go to **SQL Editor** in the left sidebar

3. Copy the entire contents of:
   ```
   /root/reka-sports-highlights/supabase/migrations/20260429000001_infrastructure_extension.sql
   ```

4. Paste into the SQL Editor and click **Run**

5. You should see all tables created successfully

## Option 2: Local Supabase CLI

If you have Supabase running locally:

```bash
cd /root/reka-sports-highlights
supabase db reset  # Resets and applies all migrations
```

## What This Migration Adds

### New Tables:
- `teams` - Team collaboration
- `team_members` - Team membership with roles
- `players` - Player profiles
- `video_tracks` - Player tracking data (bounding boxes)
- `commentary_tracks` - AI-generated commentary
- `player_stats` - Performance statistics
- `social_posts` - Social media exports

### Updates to Existing Tables:
- Adds `team_id` column to `videos` and `clips`
- Updates RLS policies to support team sharing

### Total New Infrastructure:
- 7 new tables
- 2 column additions
- 30+ RLS policies
- 15+ indexes
- Real-time subscriptions
- Helper functions

## Verification

After applying, run this query to verify:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see:
- clips
- clips_
- commentary_tracks ✨ NEW
- jobs
- player_stats ✨ NEW
- players ✨ NEW
- social_posts ✨ NEW
- tags
- team_members ✨ NEW
- teams ✨ NEW
- video_tracks ✨ NEW
- videos

## Next Steps

Once migration is applied:
1. Test team creation in your app
2. Create sample players
3. Upload a test video
4. Run player detection
5. Generate commentary

---

**Note**: The migration uses `IF NOT EXISTS` clauses, so it's safe to run multiple times.
