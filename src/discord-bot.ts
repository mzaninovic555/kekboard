import { ActivityType, Client, Events, GatewayIntentBits, Partials, TextChannel } from 'discord.js';
import { findOrCreateKekboardChannel, syncKekboardPost } from './kekboard-posts';
import { EMOTE_ID, MAX_MESSAGE_AGE_MS } from './kekboard-constants';
import { KekboardReaction, Logger } from './kekboard-message-format';

/** Validated environment configuration consumed by the Discord bot. */
export interface KekboardBotOptions {
  /** ID of the server containing the source messages and kekboard channel. */
  DISCORD_GUILD_ID: string;
  /** Bot authentication token; never include this value in log messages. */
  DISCORD_TOKEN: string;
  /** Positive integer reaction count required to publish and retain a post. */
  EMOTE_EMBED_THRESHOLD: number;
}

/** Per-bot dependencies and channel state shared by the top-level event handlers. */
export interface KekboardBot {
  /** Underlying client, also used for shutdown. */
  readonly client: Client;
  /** Validated environment settings. */
  readonly config: KekboardBotOptions;
  /** Destination for lifecycle messages and handled errors. */
  readonly logger: Logger;
  /** Available only after board initialization succeeds. */
  kekboardChannel?: TextChannel;
}

/** Creates a client with the intents and uncached event data needed to count reactions. */
function createDiscordClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.Channel],
  });
}

/** Initializes the board channel after readiness; failures leave reaction handling disabled. */
async function handleClientReady(bot: KekboardBot): Promise<void> {
  try {
    // Clear stale channel state before initialization, including on reconnects.
    bot.kekboardChannel = undefined;
    bot.logger.log('Counting emotes...');
    bot.logger.log(`Emote threshold: ${bot.config.EMOTE_EMBED_THRESHOLD}`);

    const targetGuild = bot.client.guilds.cache.get(bot.config.DISCORD_GUILD_ID);
    if (!targetGuild) {
      throw new Error(`Guild ${bot.config.DISCORD_GUILD_ID} is not available`);
    }

    bot.logger.log(`Connected to server: ${targetGuild.name}`);
    bot.kekboardChannel = await findOrCreateKekboardChannel(targetGuild, bot.logger);
    bot.client.user?.setPresence({
      activities: [{ name: 'for emotes...', type: ActivityType.Watching }],
    });
  } catch (error) {
    bot.logger.error('Error initializing board', error);
  }
}

/**
 * Loads uncached reaction data, filters eligible messages, and synchronizes their board post.
 * @param bot - Dependencies and initialized channel for this bot instance.
 * @param reaction - Reaction supplied by a Discord addition or removal event.
 * @param isReactionAdded - True for a reaction addition, false for a removal. Only additions may create a post.
 * @remarks Errors are caught here because the event emitter does not await handler promises.
 */
async function handleMessageReaction(
  bot: KekboardBot,
  reaction: KekboardReaction,
  isReactionAdded: boolean
): Promise<void> {
  try {
    if (!bot.kekboardChannel) {
      return;
    }

    if (reaction.partial) {
      // Partial reactions may lack the count or message timestamp needed by the filters.
      await reaction.fetch();
    }

    if (
      reaction.emoji.id !== EMOTE_ID ||
      Date.now() - reaction.message.createdAt.getTime() > MAX_MESSAGE_AGE_MS
    ) {
      return;
    }

    await syncKekboardPost(
      bot.kekboardChannel,
      reaction,
      bot.config.EMOTE_EMBED_THRESHOLD,
      isReactionAdded,
      bot.logger
    );
  } catch (error) {
    bot.logger.error(`Error handling reaction ${isReactionAdded ? 'addition' : 'removal'}`, error);
  }
}

/**
 * Creates bot state and registers event handlers without connecting to Discord.
 * @param botConfig - Validated guild ID, authentication token, and reaction threshold.
 * @param discordClient - Client to configure; a new Discord client is created by default.
 * @param logger - Destination for lifecycle messages and handled Discord errors.
 * @returns State to pass to {@link startKekboardBot}.
 * @remarks Call once per client to avoid registering duplicate reaction handlers.
 */
export function createKekboardBot(
  botConfig: KekboardBotOptions,
  discordClient = createDiscordClient(),
  logger: Logger = console
): KekboardBot {
  const bot: KekboardBot = {
    client: discordClient,
    config: botConfig,
    logger,
  };
  discordClient.on(Events.ClientReady, () => handleClientReady(bot));

  // Additions may create a post; removals may only edit or delete one.
  discordClient.on(Events.MessageReactionAdd, (reaction) =>
    handleMessageReaction(bot, reaction, true)
  );
  discordClient.on(Events.MessageReactionRemove, (reaction) =>
    handleMessageReaction(bot, reaction, false)
  );

  // Without a listener, client errors would be thrown as unhandled EventEmitter errors.
  discordClient.on(Events.Error, (error) => logger.error('Discord client error', error));
  return bot;
}

/**
 * Logs in to Discord using the configured token.
 * @param bot - Bot state created by {@link createKekboardBot}.
 * @throws Propagates login failures after destroying the client to release connections.
 */
export async function startKekboardBot(bot: KekboardBot): Promise<void> {
  try {
    await bot.client.login(bot.config.DISCORD_TOKEN);
  } catch (error) {
    await bot.client.destroy();
    throw error;
  }
}
