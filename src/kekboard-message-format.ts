import { EmbedBuilder, MessageReaction, PartialMessageReaction } from 'discord.js';
import { EMOTE_DISPLAY } from './kekboard-constants';

/** A Discord reaction, including reactions received before their message is cached. */
export type KekboardReaction = MessageReaction | PartialMessageReaction;

/** Logging methods needed by the bot; accepts console or an injected test logger. */
export type Logger = Pick<Console, 'log' | 'error'>;

/** Croatian date, e.g. "28. 10. 2026.". */
const dateFormat = new Intl.DateTimeFormat('hr-HR');

/** Croatian locale with a 24-hour clock, e.g. "00:05:09" (h23 avoids "24:05:09"). */
const timeFormat = new Intl.DateTimeFormat('hr-HR', { timeStyle: 'medium', hourCycle: 'h23' });

/**
 * Formats the reaction count and source channel displayed above a board embed.
 * @param reaction - Reaction whose current count should be displayed.
 * @returns Discord message content containing the custom emoji and channel mention.
 */
export function formatKekboardPostContent(reaction: KekboardReaction): string {
  return `${EMOTE_DISPLAY} **${reaction.count}** | ${reaction.message.channel}`;
}

/**
 * Builds an embed containing the original author, message, first attachment, and source link.
 * @param reaction - Reaction on the message being copied to the board.
 * @param logger - Receives recoverable failures when fetching a referenced message.
 * @returns An embed ready to send to the kekboard channel.
 * @throws When the original author is unavailable or embed validation fails.
 * @remarks Inaccessible replies fall back to the original message content.
 */
export async function createKekboardEmbed(
  reaction: KekboardReaction,
  logger: Logger
): Promise<EmbedBuilder> {
  const originalMessage = reaction.message;
  if (!originalMessage.author) {
    throw new Error('Missing message author');
  }

  const embedBuilder = new EmbedBuilder()
    .setColor(0x610505)
    .setFooter({
      text: `${originalMessage.id} • ${dateFormat.format(originalMessage.createdAt)} at ${timeFormat.format(originalMessage.createdAt)}`,
    })
    .setAuthor({
      name: originalMessage.author.username,
      iconURL: originalMessage.author.displayAvatarURL(),
    })
    // A zero-width field name keeps the source link separate without a visible heading.
    .addFields({ name: '\u200b', value: `_[Jump to message](${originalMessage.url})_` });

  const firstAttachment = originalMessage.attachments.first();
  if (firstAttachment) {
    embedBuilder.setImage(firstAttachment.url);
  }

  if (originalMessage.content) {
    let embedDescription = originalMessage.content;
    if (originalMessage.reference?.messageId) {
      try {
        const referencedMessage = await originalMessage.fetchReference();
        embedDescription = `↩ **Reply to ${referencedMessage.author.username}:  **${originalMessage.content}`;
      } catch (error) {
        // Deleted or inaccessible replies should not prevent posting the message.
        logger.error('Error fetching referenced message', error);
      }
    }
    embedBuilder.setDescription(embedDescription);
  }
  return embedBuilder;
}
