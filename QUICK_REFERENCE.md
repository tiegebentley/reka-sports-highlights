# Reka Sports Highlights - Quick Reference Guide

## Dual-Mode Clip Generation Implementation

### Start Here

Read in this order:
1. This file (QUICK_REFERENCE.md) - 2 min
2. ARCHITECTURE_SUMMARY.md - 15 min
3. DUAL_MODE_IMPLEMENTATION_GUIDE.md - 30 min

### What You're Building

Extend the clip generation system to support two modes:

**Auto Mode** (existing): AI analyzes entire video → generates highlights
**Segment Mode** (new): User selects time range → AI generates from segment

### Database Changes

```sql
-- 3 new columns in clips table
ALTER TABLE clips ADD COLUMN mode TEXT DEFAULT 'auto';
ALTER TABLE clips ADD COLUMN segment_start NUMERIC;
ALTER TABLE clips ADD COLUMN segment_end NUMERIC;

-- Query example
SELECT * FROM clips WHERE video_id = '...' AND mode = 'segment';
```

### Key Components to Create/Modify

**NEW**:
- `SegmentSelector.tsx` - Timeline range selector UI

**MODIFY**:
- `VideoDetail.tsx` - Add mode toggle buttons + segment selector
- `generate-clips/index.ts` - Accept & validate segment params
- `poll-clip-jobs/index.ts` - Store mode in created clips
- `types/index.ts` - Add ClipMode and SegmentClipSettings types
- `videoPreprocessing.ts` - Add segment validation

### Architecture at a Glance

```
User Selects Mode
    ↓
[Auto] → Full video → Reka API → AI generates clips
[Segment] → User selects time range → Reka API → AI generates from segment
    ↓
Store mode + segment times in database
    ↓
Display clips grouped by mode
```

### Files Reference

**Frontend (src/)**
- `pages/VideoDetail.tsx` - Clip generation UI
- `components/video/SegmentSelector.tsx` - NEW
- `types/index.ts` - Data types
- `lib/videoPreprocessing.ts` - Utilities

**Backend (supabase/)**
- `functions/generate-clips/index.ts` - Clip generation
- `functions/poll-clip-jobs/index.ts` - Job polling
- `functions/_shared/reka-client.ts` - Reka API client
- `migrations/` - Database schema changes

**Database**
- `clips` table + 3 new columns

### Development Workflow

1. Create database migration
2. Add TypeScript types
3. Build SegmentSelector component
4. Update VideoDetail page logic
5. Modify Edge Functions
6. Add utility functions
7. Test thoroughly
8. Deploy in sequence

### Key Insights

- Backward compatible: old clips stay as `mode='auto'`
- Reka API may already support segment timestamps
- Use existing job queue pattern for async processing
- RLS unchanged (no permission updates needed)
- Add indexes on `mode` column for query performance

### Testing Checklist

- [ ] Segment validation works
- [ ] Generate auto clips (should work as before)
- [ ] Generate segment clips (new feature)
- [ ] Export works with both modes
- [ ] Clips display correctly grouped by mode
- [ ] Database backward compatible

### Common Pitfalls

1. **Forgetting to validate segments**
   - Check: start < end, duration > minimum, within video length

2. **Not storing mode in clips table**
   - Required for querying by mode later

3. **Missing Reka API parameter check**
   - Verify if `source_start_time`/`source_end_time` work

4. **Breaking existing auto-clip generation**
   - Test original workflow before and after changes

### Debugging Tips

**Database**:
```sql
-- Check migration applied
SELECT column_name FROM information_schema.columns 
WHERE table_name='clips' AND column_name='mode';

-- View all clips with modes
SELECT id, mode, segment_start, segment_end FROM clips;
```

**Frontend**:
```javascript
// Check clip mode state
console.log({ clipSettings, selectedClips });

// Verify segment validation
console.log(validateSegment(0, 30, 120));
```

**Backend**:
```bash
# Check function logs
supabase functions list
supabase functions logs generate-clips --limit 50

# Test API locally
curl -X POST http://localhost:54321/functions/v1/generate-clips \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"videoId":"...", "settings":{"mode":"segment", ...}}'
```

### Performance Notes

- Add index: `CREATE INDEX idx_clips_mode ON clips(mode);`
- Query pattern optimized: `WHERE video_id AND mode`
- JSONB metadata already efficient
- No N+1 queries (batch fetch clips)

### Deployment Order

1. Apply database migration
2. Deploy Edge Functions
3. Deploy frontend
4. Verify both modes work
5. Monitor for errors

### Estimated Time

- Planning: 30 min
- Database: 30 min
- Frontend: 3-4 hours
- Backend: 2 hours
- Testing: 2 hours
- **Total: 8-9 hours**

### Next Steps

1. Read ARCHITECTURE_SUMMARY.md
2. Read DUAL_MODE_IMPLEMENTATION_GUIDE.md
3. Start with database migration
4. Follow implementation guide step-by-step
5. Use provided code samples
6. Check testing checklist
7. Deploy when ready

---

**Files Created**: 2026-05-01
**Status**: Ready for implementation
**Support**: See DUAL_MODE_IMPLEMENTATION_GUIDE.md for detailed walkthrough
