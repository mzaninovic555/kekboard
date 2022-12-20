require('dotenv').config();
const {Client, GatewayIntentBits, Partials, EmbedBuilder} = require('discord.js');

const requiredKeks = 7;
const kekEmote = '<:kek:959573349502169159>';
//ms * s * min * h * d
const weekDate = 1000 * 60 * 60 * 24 * 7;

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

let kekBoardChannel;
let guild;

client.on('ready', async () => {
    console.log('Counting keks...')
    guild = client.guilds.cache.find(guild => guild.id === process.env.ROSSONERI_GUILD_ID);
    console.log('Connected to server: ' + guild.name);
    if (client.channels.cache.filter(channel => channel.name === 'kekboard').size === 0) {
        console.log("Creating #kekboard");
        const otherChatChannel = await client.channels.cache.find(channel => channel.name.toLowerCase() === 'other chat');
        await guild.channels.create({
            name: 'kekboard',
            reason: 'Needed for keeping count of keks',
            parent: otherChatChannel !== undefined ? otherChatChannel : null
        }).then(createdChannel => {
            console.log('Created #kekboard');
            kekBoardChannel = createdChannel;
        }).catch(console.error);
    } else {
        console.log('Detected #kekboard')
        kekBoardChannel = client.channels.cache.find(channel => channel.name === 'kekboard');
    }
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

    if (reaction.emoji.name !== 'kek') {
        return;
    }

    if ((new Date() - reaction.message.createdAt) > weekDate) {
        console.log('Message too old');
        return;
    }

    const reactionId = reaction.message.id.toString();
    if (reaction.count >= requiredKeks && await fetchEmbedsWithMessageId(reactionId) === undefined) {
        const kekBoardEmbed = createEmbed(reaction);
        kekBoardChannel.send({
            content: `${kekEmote} **${reaction.count}** | ${reaction.message.channel}`,
            embeds: [kekBoardEmbed]
        });
    } else if (reaction.count >= requiredKeks) {
        const message = await fetchEmbedsWithMessageId(reactionId);
        message?.edit(`${reaction.emoji} ${reaction.count}  |  ${reaction.message.channel}`);
    }
});

client.on('messageReactionRemove', async reaction => {
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (ex) {
            console.error('Error fetching the message: ', ex);
            return;
        }
    }

    if (reaction.emoji.name !== 'kek') {
        return;
    }

    if ((new Date() - reaction.message.createdAt) > weekDate) {
        console.log('Message too old');
        return;
    }

    const message = await fetchEmbedsWithMessageId(reaction.message.id.toString());
    if (reaction.count < 1) {
        message?.delete();
    } else {
        message?.edit(`${reaction.emoji} ${reaction.count} | ${reaction.message.channel}`);
    }
});

async function fetchEmbedsWithMessageId(reactionId) {
    const fetchedMessages = await kekBoardChannel.messages.fetch({limit: 100});
    return fetchedMessages
        .filter(msg => msg.author.username === 'Kekboard')
        .find(msg => msg.embeds[0].footer.text === reactionId);
}

function createEmbed(reaction) {
    let builder = new EmbedBuilder()
        .setColor(0x610505)
        .setFooter({
            text: reaction.message.id.toString()
        })
        .setAuthor({
            name: reaction.message.author.username,
            iconURL: reaction.message.author.displayAvatarURL()
        })
        .addFields({
            name: '\u200b',
            value: `[Jump to message](${reaction.message.url})`
        });

    if (reaction.message.attachments.size !== 0) {
        builder.setImage(reaction.message.attachments.at(0).url)
    }
    if (reaction.message.content) {
        if (reaction.message.reference?.messageId) {
            builder.setDescription(`**Reply to ${reaction.message.author.username}:  **${reaction.message.content}`)
        } else {
            builder.setDescription(reaction.message.content)
        }
    }
    return builder;
}

client.login(process.env.DISCORD_TOKEN);
