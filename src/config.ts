import dotenv from "dotenv";
dotenv.config();
const { ROSSONERI_GUILD_ID, DISCORD_TOKEN } = process.env;

if (!ROSSONERI_GUILD_ID || !DISCORD_TOKEN) {
  throw new Error("Missing enviornment variables");
}

const config: Record<string, string> = {
  ROSSONERI_GUILD_ID,
  DISCORD_TOKEN
}

export default config;