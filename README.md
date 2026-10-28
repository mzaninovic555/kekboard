# kekboard

Fun side project for a discord server.

Counts emote reactions and, when they reach a certain threshold, posts an embed with a reference to the original message.
To use, set up enviornment variables _DISCORD_GUILD_ID_ and _DISCORD_TOKEN_.

Set `EMOTE_EMBED_THRESHOLD` in `.env` to the number of reactions needed to post
an embed. It defaults to `10` when unset or empty and must be a positive integer.

Use Node.js 24.22.1 or newer and npm 12.2.1 or newer. TypeScript emits ES2024
JavaScript for Node.js 24. Run `npm ci` to install dependencies,
`npm test` to compile and run the offline Discord compatibility test,
and `npm run local` to build and start the bot.

The compatibility test covers startup, posting at the reaction threshold,
updating counts, removing posts below the threshold, and ignoring old messages.
Testing a live Discord connection requires your bot token and guild access.

See [dependency upgrade notes](DEPENDENCY_UPGRADE.md) for breaking changes,
runtime requirements, and verification limits.
