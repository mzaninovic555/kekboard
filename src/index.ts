import { Client, GatewayIntentBits, Partials, EmbedBuilder, ChannelType, MessageReaction, PartialMessageReaction, TextChannel, Guild, APIEmbed, ActivityType } from "discord.js";
import config from "./config";

const requiredKeks = 10;

// actual emote for printing a kek
const kekEmote = '<:kek:959573349502169159>';
const kekEmoteName = ':kek:';
const kekEmoteSnowflake = '959573349502169159';
const kekBoardChannelName = 'kekboard';

// message wont be recorded if older than
// hours minutes seconds millis
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

// channel kekboard is located in
let kekBoardChannel: TextChannel;
let guild: Guild | undefined;

client.on("ready", async () => {
    console.log('Counting keks...')
    guild = client.guilds.cache.find(guild => guild.id === config.ROSSONERI_GUILD_ID);
    console.log('Connected to server: ' + guild?.name);

    // try to find the channel named #kekboard
    kekBoardChannel = guild?.channels.cache.find(channel => channel.name === kekBoardChannelName && channel.type === ChannelType.GuildText) as TextChannel;

    // if it doesn't exist create it and set the constant
    if (!kekBoardChannel) {
        console.log('Creating #' + kekBoardChannelName);
        const otherChatChannel = guild?.channels.cache.find(channel => channel.name === 'other chat' && channel.type === ChannelType.GuildCategory);
        await guild?.channels.create({
            name: kekBoardChannelName,
            reason: 'Needed for keeping count of keks',
            parent: otherChatChannel?.id
        }).then(createdChannel => {
            console.log('Created #' + kekBoardChannelName);
            kekBoardChannel = createdChannel;
        }).catch(console.error);
    } else {
        console.log('Detected #' + kekBoardChannelName);
    }
    client.user?.setPresence({ activities: [{ name: 'for keks...', type: ActivityType.Watching }] });

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

    // if the reaction isn't kekboard snowflake, return
    if (reaction.emoji.id !== kekEmoteSnowflake) {
        return;
    }

    // if message is older than threshold, return
    if (Date.now() - reaction.message.createdAt.getTime() > olderThanThreshold) {
        return;
    }

    // fetch kekboard channel embed with reaction message id
    // if doesn't exist send a new embed
    // if exists just edit the current one
    const reactionId = reaction.message.id.toString();
    const fetchedMessage = await fetchEmbedsWithMessageId(reactionId).catch(() => {
        console.debug("Error while fetching");
        return;
    });
    if (reaction.count && reaction.count >= requiredKeks && fetchedMessage === undefined) {
        const kekBoardEmbed = await createEmbed(reaction);
        kekBoardChannel.send({
            content: kekboardMessageContent(reaction),
            embeds: [kekBoardEmbed as APIEmbed]
        }).catch(() => { 
            return; 
        });
    } else if (reaction.count && reaction.count >= requiredKeks) {
        fetchedMessage?.edit(kekboardMessageContent(reaction));
    }
});

client.on('messageReactionRemove', async reaction => {
    if (reaction.partial) {
        try {
            await reaction.fetch().catch(() => { 
                return; 
            });
        } catch (ex) {
            console.error('Error fetching the message: ', ex);
            return;
        }
    }

    // if the reaction isn't kekboard snowflake, return
    if (reaction.emoji.id !== kekEmoteSnowflake) {
        return;
    }

    // if message is older than threshold, return
    if (Date.now() - reaction.message.createdAt.getTime() > olderThanThreshold) {
        return;
    }

    // if message exists and is under threshold, delete it
    // else just edit the content
    const message = await fetchEmbedsWithMessageId(reaction.message.id.toString()).catch(() => {
        return;
    });
    if (reaction.count != null && reaction.count < requiredKeks) {
        message?.delete();
    } else {
        message?.edit(kekboardMessageContent(reaction));
    }
});

async function fetchEmbedsWithMessageId(reactionId: string) {
    const fetchedMessages = await kekBoardChannel?.messages.fetch({ limit: 100 }).catch(() => {
        return;
    });
    return fetchedMessages
      ?.filter((msg) => msg.author.username === "Kekboard")
      .find((msg) => msg.embeds[0].footer && msg.embeds[0].footer.text.includes(reactionId));
}

// function for creating the kekboard embed
async function createEmbed(reaction: MessageReaction | PartialMessageReaction) {
    if (!reaction.message || !reaction.message.author) {
        return;
    }

    let builder = new EmbedBuilder()
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

    // if has attachments, put it as image
    if (reaction.message.attachments.size !== 0) {
        builder.setImage(reaction.message.attachments.at(0)!.url)
    }

    // if message has content, replace the kek emote name and place the emote snowflake format
    if (reaction.message.content) {
        const messageContent = reaction.message.content;

        // if message has a reply, print a special case for it
        if (reaction.message.reference?.messageId) {
            const reply = await reaction.message.fetchReference().catch((console.error));
            builder.setDescription(`↩ **Reply to ${reply?.author.username}:  **${messageContent}`);
        } else {
            builder.setDescription(messageContent)
        }
    }
    return builder;
}

// format for content above embed
// emote reaction count | channel
function kekboardMessageContent(reaction: MessageReaction | PartialMessageReaction): string {
    return `${kekEmote} **${reaction.count}** | ${reaction.message.channel}`;
}

client.login(config.DISCORD_TOKEN);
