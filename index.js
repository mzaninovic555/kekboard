require('dotenv').config();
const {Client, GatewayIntentBits, Partials, EmbedBuilder} = require('discord.js');

const requiredKeks = 1;
const kekEmote = '<:kek:959573349502169159>';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
    ],
    partials: [
        Partials.Message,
        Partials.Reaction
    ]
});

let kekBoardChannel;
let guild;

client.on('ready', () => {
    console.log('Counting keks...')
    guild = client.guilds.cache.find(guild => guild.id === /*process.env.ROSSONERI_GUILD_ID*/'1050546087154417765');
    if (client.channels.cache.filter(channel => channel.name === 'kekboard').size === 0) {
        guild.channels.create({
            name: 'kekboard',
            reason: 'Needed for keeping count of keks'
        }).then(console.log).catch(console.error);
    }
    kekBoardChannel = client.channels.cache.find(channel => channel.name === 'kekboard');
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

    const reactionId = reaction.message.id.toString();
    if (reaction.count >= requiredKeks && await fetchEmbedsWithMessageId(reactionId) === undefined) {
        const kekBoardEmbed = new EmbedBuilder()
            .setColor(0x610505)
            .setDescription(reaction.message.content)
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

        kekBoardChannel.send({
            content: `${kekEmote} **${reaction.count}** | ${reaction.message.channel}`,
            embeds: [kekBoardEmbed]
        });
    } else if (reaction.count >= requiredKeks) {
        const message = await fetchEmbedsWithMessageId(reactionId);
        message.edit(`${reaction.emoji} ${reaction.count}  |  ${reaction.message.channel}`);
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

    const reactionId = reaction.message.id.toString();
    if (reaction.count < 1) {
        const message = await fetchEmbedsWithMessageId(reactionId);
        message.delete();
    } else {
        const message = await fetchEmbedsWithMessageId(reactionId);
        message.edit(`${reaction.emoji} ${reaction.count} | ${reaction.message.channel}`);
    }
});

async function fetchEmbedsWithMessageId(reactionId) {
    const fetchedMessages = await kekBoardChannel.messages.fetch();
    return fetchedMessages
        .filter(msg => msg.author.username === 'Kekboard')
        .filter(msg => msg.createdAt.toDateString() === new Date().toDateString())
        .find(msg => msg.embeds[0].footer.text === reactionId);
}

client.login(process.env.DISCORD_TOKEN);