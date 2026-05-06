-- Backfill clips.tags using the new mutual-exclusion + anchor logic that
-- _shared/extract-tags.ts now applies on insert. Mirrors the TS rules:
--   1. Anchor = clips.event_type. If set, lock it in.
--   2. ANCHOR_INCOMPATIBLE: strip keyword tags that contradict the anchor.
--   3. EXCLUSION_GROUPS: keep one of [goal,save] and one of [red_card,yellow_card];
--      the anchor wins if it's in the group, else first listed wins.
--   4. Implications: shot_on_target → shot, goal → shot (unless anchor stripped 'shot').
--
-- Idempotent — safe to re-run.

DO $$
DECLARE
  r           RECORD;
  s           TEXT[];        -- working tag set
  anchor      TEXT;
  incompat    TEXT[];
  goal_save   TEXT[];
  red_yellow  TEXT[];
  shot_blocked BOOLEAN;
BEGIN
  FOR r IN
    SELECT id, tags, event_type
    FROM clips
    WHERE tags IS NOT NULL
  LOOP
    s := r.tags;
    anchor := r.event_type;

    -- Step 1+2: anchor handling
    IF anchor IS NOT NULL AND anchor IN
       ('goal','shot','shot_on_target','save','corner','kickoff','yellow_card','red_card','foul','penalty')
    THEN
      -- ensure anchor present
      IF NOT (anchor = ANY(s)) THEN s := array_append(s, anchor); END IF;

      incompat := CASE anchor
        WHEN 'save'        THEN ARRAY['goal']
        WHEN 'corner'      THEN ARRAY['goal','save','penalty','kickoff']
        WHEN 'kickoff'     THEN ARRAY['goal','save','penalty','corner','foul','shot','shot_on_target']
        WHEN 'yellow_card' THEN ARRAY['goal','save','shot','shot_on_target']
        WHEN 'red_card'    THEN ARRAY['goal','save','shot','shot_on_target','yellow_card']
        WHEN 'foul'        THEN ARRAY['goal','shot','shot_on_target','save']
        WHEN 'penalty'     THEN ARRAY['corner','kickoff']
        ELSE ARRAY[]::TEXT[]
      END;

      -- strip incompatible
      s := ARRAY(SELECT unnest(s) EXCEPT SELECT unnest(incompat));
    ELSE
      incompat := ARRAY[]::TEXT[];
    END IF;

    -- Track if 'shot' is blocked by anchor (for implications below)
    shot_blocked := 'shot' = ANY(incompat);

    -- Step 4: implications (only if shot isn't anchor-blocked)
    IF NOT shot_blocked THEN
      IF 'shot_on_target' = ANY(s) AND NOT 'shot' = ANY(s) THEN
        s := array_append(s, 'shot');
      END IF;
      IF 'goal' = ANY(s) AND NOT 'shot' = ANY(s) THEN
        s := array_append(s, 'shot');
      END IF;
    END IF;

    -- Step 3: mutual-exclusion groups
    -- [goal, save] — goal listed first → goal wins ties
    goal_save := ARRAY(SELECT t FROM unnest(ARRAY['goal','save']::TEXT[]) AS t WHERE t = ANY(s));
    IF array_length(goal_save, 1) > 1 THEN
      IF anchor = 'save' THEN
        s := array_remove(s, 'goal');
      ELSE
        s := array_remove(s, 'save');  -- 'goal' is priority winner
      END IF;
    END IF;

    -- [red_card, yellow_card] — red wins ties
    red_yellow := ARRAY(SELECT t FROM unnest(ARRAY['red_card','yellow_card']::TEXT[]) AS t WHERE t = ANY(s));
    IF array_length(red_yellow, 1) > 1 THEN
      IF anchor = 'yellow_card' THEN
        s := array_remove(s, 'red_card');
      ELSE
        s := array_remove(s, 'yellow_card');
      END IF;
    END IF;

    -- Persist if changed (preserve canonical order from SOCCER_TAGS)
    s := ARRAY(
      SELECT t FROM unnest(
        ARRAY['goal','shot','shot_on_target','save','corner','kickoff','yellow_card','red_card','foul','penalty']::TEXT[]
      ) AS t
      WHERE t = ANY(s)
    );

    IF s IS DISTINCT FROM r.tags THEN
      UPDATE clips SET tags = s WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
