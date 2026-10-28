/** Discord snowflake identifying the custom kek emoji; used to match reactions. */
export const EMOTE_ID = '959573349502169159';

/** Discord markup used to render that emoji in board post content. */
export const EMOTE_DISPLAY = '<:kek:959573349502169159>';

/** Text channel where qualifying messages are reposted. */
export const BOARD_CHANNEL_NAME = 'kekboard';

/** Preferred parent category when the board channel must be created. */
export const BOARD_CATEGORY_NAME = 'other chat';

/** Reactions needed to post when EMOTE_EMBED_THRESHOLD is not set. */
export const DEFAULT_EMOTE_EMBED_THRESHOLD = 10;

/** How a board post looks once its count reaches the threshold plus `offset`; highest tier first. */
export const COUNT_TIERS = [
  { offset: 10, color: 0xf1c40f, emoteRepeat: 3 },
  { offset: 5, color: 0xe67e22, emoteRepeat: 2 },
  { offset: 0, color: 0x610505, emoteRepeat: 1 },
] as const;

/** Username of the bot account that authors board posts. */
export const BOARD_POST_AUTHOR = 'Kekboard';

/** Messages older than 24 hours are excluded from both addition and removal handling. */
export const MAX_MESSAGE_AGE_MS = 24 * 60 * 60 * 1000;
