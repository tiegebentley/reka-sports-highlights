/**
 * AI Commentary Template System
 *
 * Generates natural-sounding sports commentary text that can be
 * converted to speech using ElevenLabs API
 */

export interface CommentaryContext {
  playerName?: string;
  playerNumber?: number;
  teamName?: string;
  opponentName?: string;
  action?: string;
  time?: string;
  score?: string;
  gameSituation?: string;
}

export type CommentaryType =
  | 'pre-game-intro'
  | 'player-introduction'
  | 'live-action'
  | 'goal-celebration'
  | 'save-highlight'
  | 'skill-move'
  | 'post-game-summary'
  | 'player-stats';

/**
 * Pre-Game Introduction Templates
 */
const preGameTemplates = [
  (ctx: CommentaryContext) =>
    `Welcome to today's match featuring ${ctx.teamName}! The atmosphere is electric as both teams prepare for kickoff.`,

  (ctx: CommentaryContext) =>
    `It's a beautiful day for soccer as ${ctx.teamName} takes the field against ${ctx.opponentName}. Let's see what these talented athletes have in store for us today.`,

  (ctx: CommentaryContext) =>
    `Good ${ctx.time || 'afternoon'} everyone! ${ctx.teamName} is ready to showcase their skills in what promises to be an exciting matchup.`,
];

/**
 * Player Introduction Templates
 */
const playerIntroTemplates = [
  (ctx: CommentaryContext) =>
    `Number ${ctx.playerNumber}, ${ctx.playerName}. A key player for ${ctx.teamName} known for ${ctx.action || 'their outstanding skills'}.`,

  (ctx: CommentaryContext) =>
    `Wearing number ${ctx.playerNumber}, it's ${ctx.playerName}! Watch this player closely, they've been instrumental in ${ctx.teamName}'s success this season.`,

  (ctx: CommentaryContext) =>
    `${ctx.playerName}, number ${ctx.playerNumber}, steps onto the pitch. A player who consistently delivers when it matters most.`,
];

/**
 * Live Action Commentary Templates
 */
const liveActionTemplates = [
  (ctx: CommentaryContext) =>
    `${ctx.playerName} with the ball, ${ctx.action}! What a move!`,

  (ctx: CommentaryContext) =>
    `Number ${ctx.playerNumber} ${ctx.playerName} ${ctx.action}. Brilliant play from ${ctx.teamName}!`,

  (ctx: CommentaryContext) =>
    `Watch ${ctx.playerName} here... ${ctx.action}! That's the kind of skill that separates the good from the great!`,

  (ctx: CommentaryContext) =>
    `${ctx.playerName} showing why they're one of the best, ${ctx.action} with confidence!`,
];

/**
 * Goal Celebration Templates
 */
const goalTemplates = [
  (ctx: CommentaryContext) =>
    `GOAL! ${ctx.playerName} scores for ${ctx.teamName}! What an incredible finish! The crowd goes wild!`,

  (ctx: CommentaryContext) =>
    `It's in! Number ${ctx.playerNumber} ${ctx.playerName} finds the back of the net! ${ctx.teamName} leads ${ctx.score || '1-0'}!`,

  (ctx: CommentaryContext) =>
    `GOAL! ${ctx.playerName} with a magnificent strike! That's why they wear number ${ctx.playerNumber}! Absolutely brilliant!`,

  (ctx: CommentaryContext) =>
    `They've done it! ${ctx.playerName} scores! What a moment for ${ctx.teamName}! The celebration is on!`,
];

/**
 * Save Highlight Templates
 */
const saveTemplates = [
  (ctx: CommentaryContext) =>
    `What a save by ${ctx.playerName}! Absolutely denied! Number ${ctx.playerNumber} keeping ${ctx.teamName} in the game!`,

  (ctx: CommentaryContext) =>
    `${ctx.playerName} says no! Spectacular goalkeeping from number ${ctx.playerNumber}! What reflexes!`,

  (ctx: CommentaryContext) =>
    `How did ${ctx.playerName} save that?! Incredible work from ${ctx.teamName}'s number ${ctx.playerNumber}!`,
];

/**
 * Skill Move Templates
 */
const skillMoveTemplates = [
  (ctx: CommentaryContext) =>
    `Oh my! ${ctx.playerName} with ${ctx.action}! The defenders didn't know which way to turn! Pure magic from number ${ctx.playerNumber}!`,

  (ctx: CommentaryContext) =>
    `Did you see that? ${ctx.playerName} just ${ctx.action}! The crowd is on their feet! What skill!`,

  (ctx: CommentaryContext) =>
    `${ctx.playerName}, number ${ctx.playerNumber}, showing off with ${ctx.action}! That's going to be on the highlight reel!`,
];

/**
 * Post-Game Summary Templates
 */
const postGameTemplates = [
  (ctx: CommentaryContext) =>
    `What a match! ${ctx.teamName} ${ctx.gameSituation || 'played their hearts out'}, final score ${ctx.score || 'pending'}. ${ctx.playerName} was outstanding with ${ctx.action}.`,

  (ctx: CommentaryContext) =>
    `That's the final whistle! ${ctx.teamName} ${ctx.gameSituation || 'can be proud of their performance'}. Special mention to number ${ctx.playerNumber} ${ctx.playerName} for ${ctx.action}.`,

  (ctx: CommentaryContext) =>
    `Game over! ${ctx.teamName} finishes ${ctx.score || 'strong'}. ${ctx.playerName}'s performance today was exceptional, particularly ${ctx.action}.`,
];

/**
 * Player Stats Templates
 */
const playerStatsTemplates = [
  (ctx: CommentaryContext) =>
    `${ctx.playerName}, number ${ctx.playerNumber}, ${ctx.action}. Those are the kind of numbers that win championships.`,

  (ctx: CommentaryContext) =>
    `Let's look at ${ctx.playerName}'s performance: ${ctx.action}. Absolutely dominant from number ${ctx.playerNumber}.`,

  (ctx: CommentaryContext) =>
    `The stats speak for themselves. ${ctx.playerName} with ${ctx.action}. A standout performance from ${ctx.teamName}'s number ${ctx.playerNumber}.`,
];

/**
 * Template registry
 */
const templates: Record<CommentaryType, Array<(ctx: CommentaryContext) => string>> = {
  'pre-game-intro': preGameTemplates,
  'player-introduction': playerIntroTemplates,
  'live-action': liveActionTemplates,
  'goal-celebration': goalTemplates,
  'save-highlight': saveTemplates,
  'skill-move': skillMoveTemplates,
  'post-game-summary': postGameTemplates,
  'player-stats': playerStatsTemplates,
};

/**
 * Generate commentary text from a template
 */
export function generateCommentary(
  type: CommentaryType,
  context: CommentaryContext,
  templateIndex?: number
): string {
  const templateArray = templates[type];

  if (!templateArray || templateArray.length === 0) {
    throw new Error(`No templates found for type: ${type}`);
  }

  // Use specific template or pick random
  const index = templateIndex !== undefined
    ? Math.min(templateIndex, templateArray.length - 1)
    : Math.floor(Math.random() * templateArray.length);

  const template = templateArray[index];
  return template(context);
}

/**
 * Get available template count for a type
 */
export function getTemplateCount(type: CommentaryType): number {
  return templates[type]?.length || 0;
}

/**
 * Get all available commentary types
 */
export function getCommentaryTypes(): CommentaryType[] {
  return Object.keys(templates) as CommentaryType[];
}

/**
 * Batch generate commentary for a sequence of events
 */
export function generateCommentarySequence(
  events: Array<{ type: CommentaryType; context: CommentaryContext }>
): string[] {
  return events.map(event => generateCommentary(event.type, event.context));
}

/**
 * Generate full game commentary
 */
export function generateFullGameCommentary(gameData: {
  teamName: string;
  opponentName?: string;
  players: Array<{ name: string; number: number }>;
  highlights: Array<{ type: CommentaryType; context: CommentaryContext }>;
  finalScore?: string;
}): string[] {
  const commentary: string[] = [];

  // Pre-game intro
  commentary.push(
    generateCommentary('pre-game-intro', {
      teamName: gameData.teamName,
      opponentName: gameData.opponentName,
    })
  );

  // Player introductions
  gameData.players.forEach(player => {
    commentary.push(
      generateCommentary('player-introduction', {
        playerName: player.name,
        playerNumber: player.number,
        teamName: gameData.teamName,
      })
    );
  });

  // Highlight commentary
  gameData.highlights.forEach(highlight => {
    commentary.push(
      generateCommentary(highlight.type, highlight.context)
    );
  });

  // Post-game summary
  if (gameData.finalScore) {
    commentary.push(
      generateCommentary('post-game-summary', {
        teamName: gameData.teamName,
        score: gameData.finalScore,
      })
    );
  }

  return commentary;
}
