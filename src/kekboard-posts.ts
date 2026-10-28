import { ChannelType, EmbedBuilder, Guild, Message, TextChannel } from 'discord.js';
import { BOARD_CATEGORY_NAME, BOARD_CHANNEL_NAME, BOARD_POST_AUTHOR } from './kekboard-constants';
import {
  KekboardReaction,
  Logger,
  formatKekboardPostContent,
  getKekboardEmbedColor,
  createKekboardEmbed,
} from './kekboard-message-format';

/**
 * Finds the guild's kekboard text channel, creating it if necessary.
 * @param targetGuild - Configured Discord server whose channel cache is ready.
 * @param logger - Receives channel discovery and creation messages.
 * @returns The existing or newly created board channel.
 * @throws When Discord refuses or fails the channel creation request.
 * @remarks The preferred category is optional; without it the channel is created at the root.
 */
export async function findOrCreateKekboardChannel(
  targetGuild: Guild,
  logger: Logger
): Promise<TextChannel> {
  const existingBoardChannel = targetGuild.channels.cache.find(
    (guildChannel): guildChannel is TextChannel =>
      guildChannel.name === BOARD_CHANNEL_NAME && guildChannel.type === ChannelType.GuildText
  );

  if (existingBoardChannel) {
    logger.log(`Detected #${BOARD_CHANNEL_NAME}`);
    return existingBoardChannel;
  }

  const preferredCategory = targetGuild.channels.cache.find(
    (channel) => channel.name === BOARD_CATEGORY_NAME && channel.type === ChannelType.GuildCategory
  );
  logger.log(`Creating #${BOARD_CHANNEL_NAME}`);

  const createdBoardChannel = await targetGuild.channels.create({
    name: BOARD_CHANNEL_NAME,
    type: ChannelType.GuildText,
    reason: 'Needed for keeping count of emotes',
    parent: preferredCategory?.id,
  });

  logger.log(`Created #${BOARD_CHANNEL_NAME}`);
  return createdBoardChannel;
}

/**
 * Creates, edits, or deletes the board post to reflect the current reaction count.
 * @param kekboardChannel - Destination channel containing the bot's board posts.
 * @param reaction - Source reaction after any partial data has been fetched.
 * @param requiredReactionCount - Minimum count needed to keep a post on the board.
 * @param isReactionAdded - True for a reaction addition, false for a removal; removals may only edit or delete posts.
 * @param logger - Receives recoverable reply lookup errors during embed creation.
 * @throws When fetching, sending, editing, or deleting a Discord message fails.
 * @remarks Searches only the most recent 100 board messages. Errors propagate to the event handler.
 */
export async function syncKekboardPost(
  kekboardChannel: TextChannel,
  reaction: KekboardReaction,
  requiredReactionCount: number,
  isReactionAdded: boolean,
  logger: Logger
): Promise<void> {
  // A partial reaction may not have a count; there is nothing to compare against the threshold.
  if (reaction.count == null) {
    return;
  }

  const hasEnoughReactions = reaction.count >= requiredReactionCount;

  // An addition below the threshold can neither create nor change anything, so skip the lookup.
  if (isReactionAdded && !hasEnoughReactions) {
    return;
  }

  const existingPost = await findBoardPost(kekboardChannel, reaction.message.id);

  // A removal dropped the count below the threshold: the post is no longer deserved.
  if (!hasEnoughReactions) {
    await existingPost?.delete();
    return;
  }

  // The post already exists and still qualifies: refresh the count and the tier's colour.
  if (existingPost) {
    await existingPost.edit({
      content: formatKekboardPostContent(reaction, requiredReactionCount),
      embeds: [
        EmbedBuilder.from(existingPost.embeds[0]).setColor(
          getKekboardEmbedColor(reaction, requiredReactionCount)
        ),
      ],
    });
    return;
  }

  // A removal never creates a post; with no existing post there is nothing to update.
  if (!isReactionAdded) {
    return;
  }

  // First time the message reaches the threshold: repost it with its author, content and link.
  await kekboardChannel.send({
    content: formatKekboardPostContent(reaction, requiredReactionCount),
    embeds: [await createKekboardEmbed(reaction, requiredReactionCount, logger)],
  });
}

/**
 * Finds the bot's board post for a source message among the 100 most recent board messages.
 * @remarks Fetch failures propagate rather than returning undefined, which would create duplicates.
 */
async function findBoardPost(
  kekboardChannel: TextChannel,
  sourceMessageId: string
): Promise<Message<true> | undefined> {
  const recentBoardMessages = await kekboardChannel.messages.fetch({ limit: 100 });
  return recentBoardMessages.find(
    (message) =>
      message.author.username === BOARD_POST_AUTHOR &&
      Boolean(message.embeds[0]?.footer?.text.includes(sourceMessageId))
  );
}
