-- Add dual-mode support for clips table
-- Supports two modes: 'sports_analysis' (full game) and 'short_form' (manual clipping)

-- Add processing mode column
ALTER TABLE clips
ADD COLUMN IF NOT EXISTS processing_mode TEXT DEFAULT 'sports_analysis'
CHECK (processing_mode IN ('sports_analysis', 'short_form'));

-- Add segment selection for short-form mode
ALTER TABLE clips
ADD COLUMN IF NOT EXISTS segment_start NUMERIC,
ADD COLUMN IF NOT EXISTS segment_end NUMERIC;

-- Add comment for documentation
COMMENT ON COLUMN clips.processing_mode IS 'sports_analysis: AI auto-detects highlights from full game. short_form: Manual segment selection with custom captions';
COMMENT ON COLUMN clips.segment_start IS 'Start time in seconds for short_form mode manual selection';
COMMENT ON COLUMN clips.segment_end IS 'End time in seconds for short_form mode manual selection';

-- Update aspect_ratio to support more formats
ALTER TABLE clips
DROP CONSTRAINT IF EXISTS clips_aspect_ratio_check;

ALTER TABLE clips
ADD CONSTRAINT clips_aspect_ratio_check
CHECK (aspect_ratio IN ('1:1', '4:5', '9:16', '16:9'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_clips_processing_mode ON clips(processing_mode);
CREATE INDEX IF NOT EXISTS idx_clips_segment_times ON clips(segment_start, segment_end) WHERE processing_mode = 'short_form';

-- Add video mode tracking to videos table
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS processing_mode TEXT DEFAULT 'sports_analysis'
CHECK (processing_mode IN ('sports_analysis', 'short_form'));

CREATE INDEX IF NOT EXISTS idx_videos_processing_mode ON videos(processing_mode);

COMMENT ON COLUMN videos.processing_mode IS 'Determines how clips are generated: sports_analysis (AI auto-detect) or short_form (manual selection)';
