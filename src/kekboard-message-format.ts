import { EmbedBuilder, MessageReaction, PartialMessageReaction } from 'discord.js';
import { COUNT_TIERS, EMOTE_DISPLAY } from './kekboard-constants';

/** A Discord reaction, including reactions received before their message is cached. */
export type KekboardReaction = MessageReaction | PartialMessageReaction;

/** Logging methods needed by the bot; accepts console or an injected test logger. */
export type Logger = Pick<Console, 'log' | 'error'>;

/** Croatian date, e.g. "28. 10. 2026.". */
const dateFormat = new Intl.DateTimeFormat('hr-HR');

/** Croatian locale with a 24-hour clock, e.g. "00:05:09" (h23 avoids "24:05:09"). */
const timeFormat = new Intl.DateTimeFormat('hr-HR', { timeStyle: 'medium', hourCycle: 'h23' });

/** Picks the highest tier the reaction's current count has reached, relative to the threshold. */
function tierFor(reaction: KekboardReaction, threshold: number) {
  const count = reaction.count ?? 0;
  return (
    COUNT_TIERS.find((tier) => count >= threshold + tier.offset) ??
    COUNT_TIERS[COUNT_TIERS.length - 1]
  );
}

/**
 * Formats the reaction count and source channel displayed above a board embed.
 * @param reaction - Reaction whose current count should be displayed.
 * @param threshold - Reactions needed to post; tiers are offsets above it.
 * @returns Discord message content: the emoji (repeated at higher tiers), count and channel.
 */
export function formatKekboardPostContent(reaction: KekboardReaction, threshold: number): string {
  return `${EMOTE_DISPLAY.repeat(tierFor(reaction, threshold).emoteRepeat)} **${reaction.count}** | ${reaction.message.channel}`;
}

/**
 * Colour of the board embed, which escalates as the reaction count climbs.
 * @param reaction - Reaction whose current count selects the tier.
 * @param threshold - Reactions needed to post; tiers are offsets above it.
 */
export function getKekboardEmbedColor(reaction: KekboardReaction, threshold: number): number {
  return tierFor(reaction, threshold).color;
}

/**
 * Builds an embed containing the original author, message, first attachment, and source link.
 * @param reaction - Reaction on the message being copied to the board.
 * @param threshold - Reactions needed to post; selects the embed colour tier.
 * @param logger - Receives recoverable failures when fetching a referenced message.
 * @returns An embed ready to send to the kekboard channel.
 * @throws When the original author is unavailable or embed validation fails.
 * @remarks Inaccessible replies fall back to the original message content.
 */
export async function createKekboardEmbed(
  reaction: KekboardReaction,
  threshold: number,
  logger: Logger
): Promise<EmbedBuilder> {
  const originalMessage = reaction.message;
  if (!originalMessage.author) {
    throw new Error('Missing message author');
  }

  const embedBuilder = new EmbedBuilder()
    .setColor(getKekboardEmbedColor(reaction, threshold))
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
