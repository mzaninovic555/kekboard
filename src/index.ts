import { Client, GatewayIntentBits, Partials, EmbedBuilder, ChannelType, MessageReaction, PartialMessageReaction, TextChannel, Guild, APIEmbed, ActivityType } from "discord.js";
import config from "./config";

const requiredReactionsToPost = 10;

// actual emote for printing emote
const emoteFullId = '<:kek:959573349502169159>';
const emoteName = ':kek:';
const emoteSnowflake = '959573349502169159';
const botChannelName = 'kekboard';

const olderThanThreshold = 24 * 60 * 60 * 1000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
    ],
    partials: [
        Partials.Message,
        Partials.Reaction,
        Partials.Channel
    ]
});


let botBoardChannel: TextChannel;
let guild: Guild | undefined;

client.on("ready", async () => {
    console.log('Counting emotes...')
    guild = client.guilds.cache.find(guild => guild.id === config.DISCORD_GUILD_ID);
    console.log('Connected to server: ' + guild?.name);

    botBoardChannel = guild?.channels.cache.find(channel => channel.name === botChannelName && channel.type === ChannelType.GuildText) as TextChannel;

    // if it doesn't exist create it and set the constant
    if (!botBoardChannel) {
        console.log('Creating #' + botChannelName);
        const otherChatChannel = guild?.channels.cache.find(channel => channel.name === 'other chat' && channel.type === ChannelType.GuildCategory);
        await guild?.channels.create({
            name: botChannelName,
            reason: 'Needed for keeping count of emotes',
            parent: otherChatChannel?.id
        }).then(createdChannel => {
            console.log('Created #' + botChannelName);
            botBoardChannel = createdChannel;
        }).catch(console.error);
    } else {
        console.log('Detected #' + botChannelName);
    }
    client.user?.setPresence({ activities: [{ name: 'for emotes...', type: ActivityType.Watching }] });

});

client.on('messageReactionAdd', async reaction => {
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (ex) {
            console.error('Error fetching the message: ', ex);
            return;
        }
    }

    if (reaction.emoji.id !== emoteSnowflake) {
        return;
    }

    if (Date.now() - reaction.message.createdAt.getTime() > olderThanThreshold) {
        return;
    }

    const reactionId = reaction.message.id.toString();
    const fetchedMessage = await fetchEmbedsWithMessageId(reactionId).catch(() => {
        console.debug("Error while fetching");
        return;
    });
    if (reaction.count && reaction.count >= requiredReactionsToPost && fetchedMessage === undefined) {
        const kekBoardEmbed = await createEmbed(reaction);
        botBoardChannel.send({
            content: kekboardMessageContent(reaction),
            embeds: [kekBoardEmbed as APIEmbed]
        }).catch((ex) => {
            console.error("Error creating new board post", ex);
            return; 
        });
    } else if (reaction.count && reaction.count >= requiredReactionsToPost) {
        fetchedMessage?.edit(kekboardMessageContent(reaction))
            .catch((ex) => console.error("Error editing board post", ex));
    }
});

client.on('messageReactionRemove', async reaction => {
    if (reaction.partial) {
        await reaction.fetch().catch((ex) => { 
            console.error('Error fetching the message: ', ex);
        });
    }

    if (reaction.emoji.id !== emoteSnowflake) {
        return;
    }

    if (Date.now() - reaction.message.createdAt.getTime() > olderThanThreshold) {
        return;
    }

    // if message exists and is under threshold, delete it
    const message = await fetchEmbedsWithMessageId(reaction.message.id.toString())
        .catch((ex) => {
            console.error("Error fetching board post", ex);
            return;
        });
    if (reaction.count != null && reaction.count < requiredReactionsToPost) {
        message?.delete().catch((ex) => console.error("Error deleting board post", ex));
    } else {
        message?.edit(kekboardMessageContent(reaction))
            .catch((ex) => console.error("Error editing board post", ex));
    }
});

/**
 * Fetch message by reaction id.
 * @param reactionId id of reaction
 * @returns {Message} promise
 */
async function fetchEmbedsWithMessageId(reactionId: string) {
    const fetchedMessages = await botBoardChannel?.messages.fetch({ limit: 100 }).catch(() => {
        return;
    });
    return fetchedMessages
        ?.filter((msg) => msg.author.username === "Kekboard")
        .find((msg) => msg.embeds[0].footer && msg.embeds[0].footer.text.includes(reactionId));
}

/**
 * Creates embed with original message information, reaction count, and image if the original message was one.
 * @param reaction message reaction
 * @returns {EmbedBuilder} promise
 */
async function createEmbed(reaction: MessageReaction | PartialMessageReaction) : Promise<EmbedBuilder> {
    if (!reaction.message || !reaction.message.author) {
        return Promise.reject("Missing reaction param");
    }

    const builder = new EmbedBuilder()
        .setColor(0x610505)
        .setFooter({
            text: `${reaction.message.id.toString()} • ${reaction.message.createdAt.toLocaleDateString()} at ${reaction.message.createdAt.toLocaleTimeString()}`
        })
        .setAuthor({
            name: reaction.message.author.username,
            iconURL: reaction.message.author.displayAvatarURL()
        })
        .addFields({
            name: '\u200b',
            value: `_[Jump to message](${reaction.message.url})_`
        });

    if (reaction.message.attachments.size !== 0) {
        builder.setImage(reaction.message.attachments.at(0)!.url)
    }

    // if message has content, replace the kek emote name and place the emote snowflake format
    if (reaction.message.content) {
        const messageContent = reaction.message.content;

        // if message has a reply, print differently
        if (reaction.message.reference?.messageId) {
            const reply = await reaction.message.fetchReference().catch((console.error));
            builder.setDescription(`↩ **Reply to ${reply?.author.username}:  **${messageContent}`);
        } else {
            builder.setDescription(messageContent)
        }
    }
    return builder;
}

/**
 * Format message content above embed.
 * Format: emote_reaction_count | channel
 * @param reaction message reaction
 * @returns {string}, formatted message text
 */
function kekboardMessageContent(reaction: MessageReaction | PartialMessageReaction): string {
    return `${emoteFullId} **${reaction.count}** | ${reaction.message.channel}`;
}

client.login(config.DISCORD_TOKEN);
