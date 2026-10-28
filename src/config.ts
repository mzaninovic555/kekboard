import dotenv from 'dotenv';
dotenv.config({ quiet: true });
const { DISCORD_GUILD_ID, DISCORD_TOKEN } = process.env;

if (!DISCORD_GUILD_ID || !DISCORD_TOKEN) {
  throw new Error('Missing enviornment variables');
}

const threshold = process.env.EMOTE_EMBED_THRESHOLD?.trim();
const emoteEmbedThreshold = threshold ? Number(threshold) : 10;

if (!Number.isSafeInteger(emoteEmbedThreshold) || emoteEmbedThreshold < 1) {
  throw new Error('EMOTE_EMBED_THRESHOLD must be a positive integer');
}

const config = {
  DISCORD_GUILD_ID,
  DISCORD_TOKEN,
  EMOTE_EMBED_THRESHOLD: emoteEmbedThreshold,
};

export default config;
