-- Add user-editable event tags to clips so each clip can carry one or more
-- soccer event tags (e.g., goal, shot, save). Auto-populated by poll-clip-jobs
-- from Reka's title/caption/hashtags via keyword extraction; users can edit.

alter table public.clips
  add column if not exists tags text[] not null default '{}';

create index if not exists clips_tags_gin on public.clips using gin (tags);
