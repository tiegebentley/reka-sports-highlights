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

export function extractSoccerTags(input: {
  title?: string | null
  caption?: string | null
  hashtags?: string[] | null
}): SoccerTag[] {
  const haystackParts: string[] = []
  if (input.title) haystackParts.push(input.title)
  if (input.caption) haystackParts.push(input.caption)
  if (input.hashtags && input.hashtags.length) {
    haystackParts.push(input.hashtags.map(normaliseHashtag).join(' '))
  }
  const haystack = haystackParts.join(' ').toLowerCase()
  if (!haystack.trim()) return []

  const found = new Set<SoccerTag>()
  for (const tag of SOCCER_TAGS) {
    for (const kw of TAG_KEYWORDS[tag]) {
      if (haystack.includes(kw)) {
        found.add(tag)
        break
      }
    }
  }

  // Logical implication: shot_on_target implies shot; goal implies shot.
  if (found.has('shot_on_target')) found.add('shot')
  if (found.has('goal')) found.add('shot')

  return SOCCER_TAGS.filter(t => found.has(t))
}
