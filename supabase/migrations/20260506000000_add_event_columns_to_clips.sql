-- Per-event clip generation: tag each clip row with the detected event it was clipped from.
-- Populated by poll-clip-jobs from the segment metadata persisted in jobs.metadata.reka_clip_ids.

ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS event_description TEXT,
  ADD COLUMN IF NOT EXISTS event_confidence NUMERIC;

CREATE INDEX IF NOT EXISTS clips_event_type_idx ON clips (event_type) WHERE event_type IS NOT NULL;

COMMENT ON COLUMN clips.event_type IS 'Soccer event type detected by analyze-events: goal, shot, save, yellow_card, red_card, foul, penalty, corner, kickoff, etc.';
COMMENT ON COLUMN clips.event_description IS 'One-sentence description of the event from Reka Q&A';
COMMENT ON COLUMN clips.event_confidence IS 'Reka detection confidence 0-1';
