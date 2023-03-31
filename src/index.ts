import { Client, GatewayIntentBits, Partials, EmbedBuilder, ChannelType, MessageReaction, PartialMessageReaction, TextChannel, Guild, APIEmbed } from "discord.js";
import config from "./config";

const requiredKeks = 2;

//const kekEmote = '<:kek:959573349502169159>';
//const kekEmoteName = ':kek:'
//const kekEmoteSnowflake = '959573349502169159';

const kekBoardChannelName = 'antikekboard';

const kekEmote = '<:antikek:894501074705211412>';
const kekEmoteName = ':antikek:'
const kekEmoteSnowflake = '894501074705211412';

//message wont be recorded if older than
//hours minutes seconds millis
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

let kekBoardChannel: TextChannel;
let guild : Guild | undefined;

client.on("ready", async () => {
  console.log('Counting keks...')
  guild = client.guilds.cache.find(guild => guild.id === config.ROSSONERI_GUILD_ID);
  console.log('Connected to server: ' + guild?.name);
  kekBoardChannel = guild?.channels.cache.find(channel => channel.name === kekBoardChannelName && channel.type === ChannelType.GuildText) as TextChannel;
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

  if (reaction.emoji.id !== kekEmoteSnowflake) {
      return;
  }

  if (Date.now() - reaction.message.createdAt.getTime() > olderThanThreshold) {
    return;
  }

  const reactionId = reaction.message.id.toString();
  const fetchedMessage = await fetchEmbedsWithMessageId(reactionId);
  if (reaction.count && reaction.count >= requiredKeks && fetchedMessage === undefined) {
      const kekBoardEmbed = createEmbed(reaction);
      kekBoardChannel.send({
          content: `${kekEmote} **${reaction.count}** | ${reaction.message.channel}`,
          embeds: [kekBoardEmbed as APIEmbed]
      });
  } else if (reaction.count && reaction.count >= requiredKeks) {
      fetchedMessage?.edit(`${kekEmote} ${reaction.count}  |  ${reaction.message.channel}`);
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

  if (reaction.emoji.id !== kekEmoteSnowflake) {
      return;
  }

  if (Date.now() - reaction.message.createdAt.getTime() > olderThanThreshold) {
    return;
  }

  const message = await fetchEmbedsWithMessageId(reaction.message.id.toString());
  if (reaction.count != null && reaction.count < requiredKeks) {
      message?.delete();
  } else {
      message?.edit(`${kekEmote} ${reaction.count} | ${reaction.message.channel}`);
  }
});

async function fetchEmbedsWithMessageId(reactionId: string) {
  const fetchedMessages = await kekBoardChannel?.messages.fetch({limit: 100});
  return fetchedMessages
      .filter(msg => msg.author.username === 'Kekboard')
      .find(msg => msg.embeds[0].footer && msg.embeds[0].footer.text.includes(reactionId));
}

function createEmbed(reaction: MessageReaction | PartialMessageReaction) {
  if (!reaction.message || !reaction.message.author) {
    return;
  }

  let builder = new EmbedBuilder()
      .setColor(0x610505)
      .setFooter({
          text: `${reaction.message.id.toString()} | ${reaction.message.createdAt.toLocaleDateString()} ${reaction.message.createdAt.toLocaleTimeString()}`
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
      builder.setImage(reaction.message.attachments.at(0)!.url)
  }
  if (reaction.message.content) {
    const messageContent = reaction.message.content.replace(kekEmoteName, kekEmote);
    if (reaction.message.reference?.messageId) {
        builder.setDescription(`**Reply to ${reaction.message.author.username}:  **${messageContent}`)
    } else {
        builder.setDescription(messageContent)
    }
  }
  return builder;
}

client.login(config.DISCORD_TOKEN);
