const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');

describe('TypeScript build', () => {
  const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

  test('the project type-checks', () => {
    const result = spawnSync(process.execPath, [tsc, '--noEmit', '-p', root], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });

  test('compiled output exists and is CommonJS', () => {
    for (const file of ['index.js', 'config.js']) {
      const code = fs.readFileSync(path.join(root, 'target', file), 'utf8');
      assert.match(code, /require\("/, `${file} should use require`);
      assert.doesNotMatch(code, /^import\s/m, `${file} should not use ESM import`);
    }
  });

  test('compiled output is not older than its sources', () => {
    for (const file of ['index', 'config']) {
      const source = fs.statSync(path.join(root, 'src', `${file}.ts`)).mtimeMs;
      const output = fs.statSync(path.join(root, 'target', `${file}.js`)).mtimeMs;
      assert.ok(output >= source, `target/${file}.js is stale; run npm run build`);
    }
  });
});

describe('bot behaviour', () => {
  const discord = require('discord.js');
  const { createKekboardBot, startKekboardBot } = require('../target/discord-bot.js');
  const kek = '959573349502169159';

  /** Loads the compiled bot with a fake gateway and returns its handlers. */
  const loadBot = ({ posts = new discord.Collection(), fetchPosts, threshold = 12 } = {}) => {
    const state = { sent: [], logins: [], errors: [], logs: [] };
    const channel = {
      name: 'kekboard',
      type: discord.ChannelType.GuildText,
      messages: { fetch: fetchPosts ?? (async () => posts) },
      send: async (payload) => {
        state.sent.push(payload);
      },
    };
    const guild = {
      id: 'guild',
      name: 'Guild',
      channels: { cache: new discord.Collection([['board', channel]]) },
    };
    class FakeClient extends discord.Client {
      constructor(options) {
        super(options);
        state.client = this;
        this.guilds.cache.set(guild.id, guild);
      }
      async login(token) {
        state.logins.push(token);
        return token;
      }
    }
    const quietConsole = {
      ...console,
      log: (message) => state.logs.push(message),
      error: (...args) => state.errors.push(args),
    };
    const bot = createKekboardBot(
      { DISCORD_GUILD_ID: guild.id, DISCORD_TOKEN: 'token', EMOTE_EMBED_THRESHOLD: threshold },
      new FakeClient({ intents: [] }),
      quietConsole
    );
    void startKekboardBot(bot);
    return {
      state,
      posts,
      channel,
      start: startKekboardBot.bind(undefined, bot),
      ready: () => state.client.listeners(discord.Events.ClientReady)[0](),
      add: (reaction) => state.client.listeners(discord.Events.MessageReactionAdd)[0](reaction),
      remove: (reaction) =>
        state.client.listeners(discord.Events.MessageReactionRemove)[0](reaction),
    };
  };

  const makeReaction = (overrides = {}) => ({
    partial: false,
    count: 12,
    emoji: { id: kek },
    ...overrides,
    message: {
      id: 'm1',
      createdAt: new Date(),
      url: 'https://discord.com/channels/1/2/3',
      author: { username: 'user', displayAvatarURL: () => 'https://example.com/a.png' },
      attachments: new discord.Collection(),
      content: 'hello',
      channel: '<#2>',
      ...overrides.message,
    },
  });

  test('logs in with the configured token', () => {
    const bot = loadBot();
    assert.deepEqual(bot.state.logins, ['token']);
  });

  test('logs the configured threshold on startup', async () => {
    const bot = loadBot({ threshold: 7 });
    await bot.ready();
    assert.ok(bot.state.logs.includes('Emote threshold: 7'));
  });

  test('registers exactly one handler for each event', () => {
    const { state } = loadBot();
    for (const event of [
      discord.Events.ClientReady,
      discord.Events.MessageReactionAdd,
      discord.Events.MessageReactionRemove,
    ]) {
      assert.equal(state.client.listenerCount(event), 1, event);
    }
  });

  test('posts at the threshold and not below it', async () => {
    const bot = loadBot();
    await bot.ready();
    await bot.add(makeReaction({ count: 11 }));
    assert.equal(bot.state.sent.length, 0);
    await bot.add(makeReaction({ count: 12 }));
    assert.equal(bot.state.sent.length, 1);
    assert.match(bot.state.sent[0].content, /<:kek:959573349502169159> \*\*12\*\*/);
  });

  test('formats the footer date in Croatian with a 24-hour clock', async () => {
    const bot = loadBot();
    await bot.ready();
    // Earlier today in local time (the formatter uses the process time zone), so within 24 hours.
    const createdAt = new Date();
    createdAt.setHours(0, 5, 9, 0);
    await bot.add(makeReaction({ message: { createdAt } }));
    const day = createdAt.getDate();
    const month = createdAt.getMonth() + 1;
    const year = createdAt.getFullYear();
    assert.equal(
      bot.state.sent[0].embeds[0].toJSON().footer.text,
      `m1 • ${day}. ${month}. ${year}. at 00:05:09`
    );
  });

  test('uses the configured threshold for posting and removal', async () => {
    const posts = new discord.Collection();
    const bot = loadBot({ posts, threshold: 20 });
    await bot.ready();
    await bot.add(makeReaction({ count: 19 }));
    assert.equal(bot.state.sent.length, 0);
    await bot.add(makeReaction({ count: 20 }));
    assert.equal(bot.state.sent.length, 1);
    let deleted = false;
    posts.set('p', {
      author: { username: 'Kekboard' },
      embeds: [bot.state.sent[0].embeds[0].toJSON()],
      delete: async () => {
        deleted = true;
      },
    });
    await bot.remove(makeReaction({ count: 19 }));
    assert.equal(deleted, true);
  });

  test('ignores other emotes', async () => {
    const bot = loadBot();
    await bot.ready();
    await bot.add(makeReaction({ emoji: { id: 'other' } }));
    assert.equal(bot.state.sent.length, 0);
  });

  test('uses a 24 hour cutoff', async () => {
    const bot = loadBot();
    await bot.ready();
    const hours = (n) => new Date(Date.now() - n * 60 * 60 * 1000);
    await bot.add(makeReaction({ message: { createdAt: hours(25) } }));
    assert.equal(bot.state.sent.length, 0);
    await bot.add(makeReaction({ message: { createdAt: hours(23) } }));
    assert.equal(bot.state.sent.length, 1);
  });

  test('includes the attachment as an image and a reply prefix', async () => {
    const bot = loadBot();
    await bot.ready();
    await bot.add(
      makeReaction({
        message: {
          attachments: new discord.Collection([['a', { url: 'https://example.com/pic.png' }]]),
          reference: { messageId: 'parent' },
          fetchReference: async () => ({ author: { username: 'parent-author' } }),
        },
      })
    );
    const embed = bot.state.sent[0].embeds[0];
    const json = embed.toJSON ? embed.toJSON() : embed;
    assert.equal(json.image.url, 'https://example.com/pic.png');
    assert.match(json.description, /Reply to parent-author/);
  });

  test('edits an existing post instead of creating another', async () => {
    const posts = new discord.Collection();
    const bot = loadBot({ posts });
    await bot.ready();
    await bot.add(makeReaction({ count: 12 }));
    let edited;
    posts.set('p', {
      author: { username: 'Kekboard' },
      embeds: [bot.state.sent[0].embeds[0].toJSON()],
      edit: async (content) => {
        edited = content;
      },
    });
    await bot.add(makeReaction({ count: 15 }));
    assert.equal(bot.state.sent.length, 1);
    assert.match(edited, /\*\*15\*\*/);
  });

  test('deletes the post when the count drops below the threshold', async () => {
    const posts = new discord.Collection();
    const bot = loadBot({ posts });
    await bot.ready();
    await bot.add(makeReaction({ count: 12 }));
    let deleted = false;
    posts.set('p', {
      author: { username: 'Kekboard' },
      embeds: [bot.state.sent[0].embeds[0].toJSON()],
      edit: async () => {},
      delete: async () => {
        deleted = true;
      },
    });
    await bot.remove(makeReaction({ count: 11 }));
    assert.equal(deleted, true);
  });

  test('updates the count in place when a reaction is removed above the threshold', async () => {
    const posts = new discord.Collection();
    const bot = loadBot({ posts });
    await bot.ready();
    await bot.add(makeReaction({ count: 13 }));
    let edited;
    let deleted = false;
    posts.set('p', {
      author: { username: 'Kekboard' },
      embeds: [bot.state.sent[0].embeds[0].toJSON()],
      edit: async (content) => {
        edited = content;
      },
      delete: async () => {
        deleted = true;
      },
    });
    await bot.remove(makeReaction({ count: 12 }));
    assert.match(edited, /\*\*12\*\*/);
    assert.equal(deleted, false);
  });

  test('removing a reaction with no existing post does nothing', async () => {
    const bot = loadBot();
    await bot.ready();
    await bot.remove(makeReaction({ count: 11 }));
    assert.equal(bot.state.sent.length, 0);
    assert.deepEqual(bot.state.errors, []);
  });

  test('ignores posts written by other users', async () => {
    const posts = new discord.Collection();
    const bot = loadBot({ posts });
    await bot.ready();
    await bot.add(makeReaction({ count: 12 }));
    const embed = bot.state.sent[0].embeds[0].toJSON();
    posts.set('p', {
      author: { username: 'someone-else' },
      embeds: [embed],
      edit: async () => assert.fail('must not edit messages from other users'),
    });
    await bot.add(makeReaction({ count: 14 }));
    assert.equal(bot.state.sent.length, 2);
  });

  test('fetches partial reactions before using them', async () => {
    const bot = loadBot();
    await bot.ready();
    let fetched = false;
    const reaction = makeReaction({
      partial: true,
      fetch: async () => {
        fetched = true;
      },
    });
    await bot.add(reaction);
    assert.equal(fetched, true);
    assert.equal(bot.state.sent.length, 1);
  });

  test('survives Discord API failures without throwing', async () => {
    const bot = loadBot({
      fetchPosts: async () => {
        throw new Error('boom');
      },
    });
    await bot.ready();
    await bot.add(makeReaction());
    await bot.add(
      makeReaction({
        partial: true,
        fetch: async () => {
          throw new Error('gone');
        },
      })
    );
    assert.ok(bot.state.errors.length >= 2);
    assert.equal(bot.state.sent.length, 0);
  });

  test('awaits and catches failed sends, edits, and deletions', async () => {
    const bot = loadBot();
    await bot.ready();
    bot.channel.send = async () => {
      throw new Error('send failed');
    };
    await bot.add(makeReaction());
    assert.equal(bot.state.errors.length, 1);
    bot.posts.set('p', {
      author: { username: 'Kekboard' },
      embeds: [{ footer: { text: 'm1' } }],
      edit: async () => {
        throw new Error('edit failed');
      },
      delete: async () => {
        throw new Error('delete failed');
      },
    });
    await bot.add(makeReaction());
    await bot.remove(makeReaction({ count: 11 }));
    assert.equal(bot.state.errors.length, 3);
  });

  test('stops processing a partial removal when fetching fails', async () => {
    let lookups = 0;
    const bot = loadBot({
      fetchPosts: async () => {
        lookups++;
        return new discord.Collection();
      },
    });
    await bot.ready();
    await bot.remove(
      makeReaction({
        partial: true,
        fetch: async () => {
          throw new Error('fetch failed');
        },
      })
    );
    assert.equal(lookups, 0);
    assert.equal(bot.state.errors.length, 1);
  });

  test('posts original content when a referenced message cannot be fetched', async () => {
    const bot = loadBot();
    await bot.ready();
    await bot.add(
      makeReaction({
        message: {
          reference: { messageId: 'deleted' },
          fetchReference: async () => {
            throw new Error('unknown message');
          },
        },
      })
    );
    assert.equal(bot.state.sent[0].embeds[0].toJSON().description, 'hello');
    assert.equal(bot.state.errors.length, 1);
  });

  test('logs initialization failures and ignores reactions until initialized', async () => {
    const bot = loadBot();
    bot.state.client.guilds.cache.clear();
    await bot.ready();
    await bot.add(makeReaction());
    assert.equal(bot.state.errors.length, 1);
    assert.equal(bot.state.sent.length, 0);
  });

  test('creates the board channel when it is missing', async () => {
    const bot = loadBot();
    const guild = bot.state.client.guilds.cache.get('guild');
    guild.channels.cache.clear();
    guild.channels.create = async (options) => {
      assert.equal(options.name, 'kekboard');
      assert.equal(options.type, discord.ChannelType.GuildText);
      return bot.channel;
    };
    await bot.ready();
    await bot.add(makeReaction());
    assert.equal(bot.state.sent.length, 1);
  });

  test('cleans up and propagates login failures to the entry point', async () => {
    const bot = loadBot();
    let destroyed = false;
    bot.state.client.login = async () => {
      throw new Error('login failed');
    };
    bot.state.client.destroy = async () => {
      destroyed = true;
    };
    await assert.rejects(bot.start(), /login failed/);
    assert.equal(destroyed, true);
  });
});
