import dotenv from "dotenv";
dotenv.config();
const { DISCORD_GUILD_ID, DISCORD_TOKEN } = process.env;

if (!DISCORD_GUILD_ID || !DISCORD_TOKEN) {
  throw new Error("Missing enviornment variables");
}

const config: Record<string, string> = {
  DISCORD_GUILD_ID,
  DISCORD_TOKEN
}

export default config;
