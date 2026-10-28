import dotenv from 'dotenv';
import { DEFAULT_EMOTE_EMBED_THRESHOLD } from './kekboard-constants';

// Load local settings without replacing values supplied by the deployment environment.
dotenv.config({ quiet: true });
const { DISCORD_GUILD_ID, DISCORD_TOKEN } = process.env;

if (!DISCORD_GUILD_ID || !DISCORD_TOKEN) {
  throw new Error('Missing enviornment variables');
}

// Empty settings use the default, while malformed explicit values fail at startup.
const configuredThreshold = process.env.EMOTE_EMBED_THRESHOLD?.trim();
const requiredReactionCount = configuredThreshold
  ? Number(configuredThreshold)
  : DEFAULT_EMOTE_EMBED_THRESHOLD;

if (!Number.isSafeInteger(requiredReactionCount) || requiredReactionCount < 1) {
  throw new Error('EMOTE_EMBED_THRESHOLD must be a positive integer');
}

/** Required credentials and parsed reaction threshold, validated before connecting to Discord. */
const config = {
  DISCORD_GUILD_ID,
  DISCORD_TOKEN,
  EMOTE_EMBED_THRESHOLD: requiredReactionCount,
};

export default config;
