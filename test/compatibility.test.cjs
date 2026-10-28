const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createKekboardBot, startKekboardBot } = require('../target/discord-bot.js');
const discord = require('discord.js');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('dotenv loads credentials and preserves existing environment values', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kekboard-config-'));
  const env = { ...process.env };
  delete env.DISCORD_TOKEN;
  delete env.DISCORD_GUILD_ID;
  delete env.EMOTE_EMBED_THRESHOLD;
  const configPath = require.resolve('../target/config.js');
  const run = (environment) =>
    spawnSync(
      process.execPath,
      [
        '-e',
        `const assert = require('node:assert/strict');
     const config = require(${JSON.stringify(configPath)}).default;
     assert.equal(config.DISCORD_TOKEN, process.env.EXPECTED_TOKEN);
     assert.equal(config.DISCORD_GUILD_ID, 'test-guild');
     assert.equal(config.EMOTE_EMBED_THRESHOLD, Number(process.env.EXPECTED_THRESHOLD ?? 10));`,
      ],
      { cwd: directory, env: environment, encoding: 'utf8' }
    );
  try {
    fs.writeFileSync(
      path.join(directory, '.env'),
      'DISCORD_TOKEN="file-token"\nDISCORD_GUILD_ID=test-guild\n'
    );
    assert.equal(run({ ...env, EXPECTED_TOKEN: 'file-token' }).status, 0);
    for (const value of ['', ' ', '10', '20', '1']) {
      const result = run({
        ...env,
        EXPECTED_TOKEN: 'file-token',
        EMOTE_EMBED_THRESHOLD: value,
        EXPECTED_THRESHOLD: value.trim() || '10',
      });
      assert.equal(result.status, 0, result.stderr);
    }
    for (const value of ['0', '-1', '1.5', 'invalid', 'Infinity', '9007199254740992']) {
      const result = run({ ...env, EMOTE_EMBED_THRESHOLD: value });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /EMOTE_EMBED_THRESHOLD must be a positive integer/);
    }
    assert.equal(
      run({ ...env, DISCORD_TOKEN: 'environment-token', EXPECTED_TOKEN: 'environment-token' })
        .status,
      0
    );
    fs.unlinkSync(path.join(directory, '.env'));
    const missing = run(env);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /Missing enviornment variables/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('bot initializes and handles reactions with the upgraded Discord API', async () => {
  let client;
  let sent;
  let edited;
  let deleted = false;
  const posts = new discord.Collection();
  const channel = {
    name: 'kekboard',
    type: discord.ChannelType.GuildText,
    messages: { fetch: async () => posts },
    send: async (payload) => {
      sent = payload;
    },
  };
  const guild = {
    id: 'test-guild',
    name: 'Test',
    channels: {
      cache: new discord.Collection([['board', channel]]),
    },
  };
  class TestClient extends discord.Client {
    constructor(options) {
      super(options);
      client = this;
      this.guilds.cache.set(guild.id, guild);
    }
    async login(token) {
      assert.equal(token, 'test-token');
      return token;
    }
  }
  const bot = createKekboardBot(
    { DISCORD_GUILD_ID: guild.id, DISCORD_TOKEN: 'test-token', EMOTE_EMBED_THRESHOLD: 12 },
    new TestClient({ intents: [] })
  );
  await startKekboardBot(bot);
  try {
    assert.equal(client.listenerCount(discord.Events.ClientReady), 1);
    await client.listeners(discord.Events.ClientReady)[0]();
    const reaction = {
      partial: false,
      count: 11,
      emoji: { id: '959573349502169159' },
      message: {
        id: 'message-1',
        createdAt: new Date(),
        url: 'https://discord.com/channels/1/2/3',
        author: { username: 'Test user', displayAvatarURL: () => 'https://example.com/avatar.png' },
        attachments: new discord.Collection(),
        content: 'Hello',
        channel: '<#2>',
      },
    };
    const add = client.listeners(discord.Events.MessageReactionAdd)[0];
    await add(reaction);
    assert.equal(sent, undefined);
    reaction.count = 12;
    await add(reaction);
    assert.equal(sent.embeds[0].toJSON().description, 'Hello');
    assert.match(sent.content, /\*\*12\*\*/);
    posts.set('board-post', {
      author: { username: 'Kekboard' },
      embeds: [sent.embeds[0].toJSON()],
      edit: async (content) => {
        edited = content;
      },
      delete: async () => {
        deleted = true;
      },
    });
    reaction.count = 13;
    await add(reaction);
    assert.match(edited.content, /\*\*13\*\*/);
    reaction.count = 11;
    await client.listeners(discord.Events.MessageReactionRemove)[0](reaction);
    assert.equal(deleted, true);
    sent = undefined;
    reaction.message.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await add(reaction);
    assert.equal(sent, undefined);
  } finally {
    await client.destroy();
  }
});
