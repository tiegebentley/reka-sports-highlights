// Soccer event tag taxonomy + keyword-based extractor.
// Used by poll-clip-jobs to auto-populate clips.tags from Reka's
// title + caption + hashtags. Users can edit afterward in the UI.

export const SOCCER_TAGS = [
  'goal',
  'shot',
  'shot_on_target',
  'save',
  'corner',
  'kickoff',
  'yellow_card',
  'red_card',
  'foul',
  'penalty',
] as const

export type SoccerTag = typeof SOCCER_TAGS[number]

// Each tag maps to one or more case-insensitive substring patterns. Order matters
// inside an array (we don't currently rely on it, but it documents intent).
const TAG_KEYWORDS: Record<SoccerTag, string[]> = {
  goal: ['goal', 'scored', 'scoring', 'first blood', 'breakthrough', 'opens the scoring', 'finds the net'],
  shot: ['shot', 'strike', 'attempt', 'effort', 'shooting'],
  shot_on_target: ['shot on target', 'on target', 'on goal', 'precision strike'],
  save: ['save', 'saved', 'goalkeeper save', 'keeper save', 'denied', 'parries', 'parry'],
  corner: ['corner kick', 'corner', 'set piece from the flag'],
  kickoff: ['kickoff', 'kick-off', 'kick off', 'restart'],
  yellow_card: ['yellow card', 'yellow booking', 'cautioned', 'caution', 'booking', 'booked'],
  red_card: ['red card', 'sent off', 'dismissal', 'second yellow'],
  foul: ['foul', 'tackle from behind', 'reckless challenge', 'infringement'],
  penalty: ['penalty', 'spot kick', 'pk', 'penalty kick', 'from the spot'],
}

// Hashtags often pack multiple words ('#YellowCard'). We normalise them by
// inserting spaces between camelCase boundaries before matching.
function normaliseHashtag(tag: string): string {
  return tag
    .replace(/^#/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase -> camel Case
    .replace(/_/g, ' ')
    .toLowerCase()
}

// Mutually-exclusive tag groups. Within each set only ONE tag can survive,
// chosen by priority (earlier = higher). This prevents nonsense combos like
// "goal + save" (a save means the shot didn't go in) or "yellow_card + red_card".
const EXCLUSION_GROUPS: SoccerTag[][] = [
  ['goal', 'save'],                  // a save means it wasn't a goal
  ['red_card', 'yellow_card'],       // a red card supersedes a yellow
]

// Tags that are incompatible with a given anchor. When an anchor is provided
// (i.e. the authoritative event_type from analyze-events), any keyword tag in
// this list gets stripped — e.g. if the anchor is "save" we drop "goal".
const ANCHOR_INCOMPATIBLE: Partial<Record<SoccerTag, SoccerTag[]>> = {
  save:        ['goal'],             // save → no goal
  corner:      ['goal', 'save', 'penalty', 'kickoff'],
  kickoff:     ['goal', 'save', 'penalty', 'corner', 'foul', 'shot', 'shot_on_target'],
  yellow_card: ['goal', 'save', 'shot', 'shot_on_target'],
  red_card:    ['goal', 'save', 'shot', 'shot_on_target', 'yellow_card'],
  foul:        ['goal', 'shot', 'shot_on_target', 'save'],  // a foul stops play before a shot
  penalty:     ['corner', 'kickoff'],
}

export function extractSoccerTags(input: {
  title?: string | null
  caption?: string | null
  hashtags?: string[] | null
  // When set, anchor is treated as the authoritative event tag. Keyword matches
  // that conflict with the anchor are stripped, and the anchor is always kept.
  anchor?: SoccerTag | string | null
}): SoccerTag[] {
  const haystackParts: string[] = []
  if (input.title) haystackParts.push(input.title)
  if (input.caption) haystackParts.push(input.caption)
  if (input.hashtags && input.hashtags.length) {
    haystackParts.push(input.hashtags.map(normaliseHashtag).join(' '))
  }
  const haystack = haystackParts.join(' ').toLowerCase()

  const found = new Set<SoccerTag>()
  if (haystack.trim()) {
    for (const tag of SOCCER_TAGS) {
      for (const kw of TAG_KEYWORDS[tag]) {
        if (haystack.includes(kw)) {
          found.add(tag)
          break
        }
      }
    }
  }

  // Anchor handling: if analyze-events gave us an authoritative event_type, lock it
  // in and remove keyword tags that contradict it.
  const anchorTag =
    input.anchor && (SOCCER_TAGS as readonly string[]).includes(input.anchor)
      ? (input.anchor as SoccerTag)
      : null
  if (anchorTag) {
    found.add(anchorTag)
    const incompatible = ANCHOR_INCOMPATIBLE[anchorTag] ?? []
    for (const t of incompatible) found.delete(t)
  }

  // Logical implication: shot_on_target implies shot; goal implies shot.
  // Only apply if it doesn't reintroduce something the anchor stripped.
  if (found.has('shot_on_target') && !(anchorTag && (ANCHOR_INCOMPATIBLE[anchorTag] ?? []).includes('shot'))) {
    found.add('shot')
  }
  if (found.has('goal') && !(anchorTag && (ANCHOR_INCOMPATIBLE[anchorTag] ?? []).includes('shot'))) {
    found.add('shot')
  }

  // Mutual exclusion: in each group keep only the highest-priority survivor.
  // The anchor wins ties — never strip the anchor itself.
  for (const group of EXCLUSION_GROUPS) {
    const present = group.filter((t) => found.has(t))
    if (present.length <= 1) continue
    const winner = anchorTag && present.includes(anchorTag) ? anchorTag : present[0]
    for (const t of present) if (t !== winner) found.delete(t)
  }

  return SOCCER_TAGS.filter(t => found.has(t))
}
