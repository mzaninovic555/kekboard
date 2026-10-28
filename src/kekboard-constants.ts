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

/** Username of the bot account that authors board posts. */
export const BOARD_POST_AUTHOR = 'Kekboard';

/** Messages older than 24 hours are excluded from both addition and removal handling. */
export const MAX_MESSAGE_AGE_MS = 24 * 60 * 60 * 1000;
