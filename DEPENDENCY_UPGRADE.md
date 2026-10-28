# Dependency compatibility review

Reviewed on 2026-10-28 against the installed lockfile and upstream release notes.

| Dependency  | Upgrade                   | Findings                                                                                                                                                                                                                                                                                                          |
| ----------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| discord.js  | 14.7.1 range to 14.27.0   | Uses `Events.ClientReady` instead of the deprecated `ready` event. Reaction listeners can ignore the added event arguments. Message fetch/send/edit/delete, channel creation, intents, partials, and embeds used here remain supported.                                                                           |
| dotenv      | 16.0.3 range to 18.0.9    | Version 18 removes vault support and preloading, and changes logging. This bot calls `config()` directly and uses neither removed feature. Explicit `quiet: true` preserves silent loading; the optional fast parser is not enabled by the application.                                                           |
| TypeScript  | 4.9.4 range to 7.0.2      | Version 7 removes legacy Node module resolution and changes compiler APIs. `module: nodenext` and explicit Node types address configuration changes. This project invokes `tsc` directly and has no compiler API consumers or framework plugins.                                                                  |
| @types/node | 18.11.17 range to 24.19.2 | Uses the latest Node 24 definitions to match the supported runtime. Latest overall (26.6.5) fails declaration checking because `@sapphire/shapeshift` imports `util.InspectOptionsStylized`, absent from those definitions. `skipLibCheck` is back to `true`, so the types package can follow the runtime freely. |

## Runtime and deployment

Use **Node.js 24.22.1 or newer** and **npm 12.2.1 or newer**. The installed
system runtime has been upgraded to Node 24.22.1, the latest Node 24 LTS patch
at review time. Node 20 is end-of-life. The runtime requirement is recorded in
`package.json` and the README.

The compiler target and standard library are **ES2024**, following TypeScript's
Node 24 target mapping. `module: nodenext` retains modern Node resolution;
the package continues to emit CommonJS. Native async functions and optional
chaining no longer need to be downlevelled to ES2016. Node provides the JavaScript
runtime (including V8); TypeScript is a compiler, not a separate runtime here.

Direct runtime/build dependencies and Prettier are current. npm 12.2.1 is current.
Node 26.12.1 is newer overall but is the Current release; Node 24 is the selected
LTS line. Node 24 typings remain on 24.19.2 to match that line.
Transitive `@discordjs/collection` 1.x, `@discordjs/ws` 1.x, and `undici` 6.x
remain on Discord's supported ranges despite newer upstream majors. Do not
force those majors with overrides. Missing TypeScript binaries for other
operating systems and optional WebSocket acceleration packages are expected.

TypeScript 7 ships platform-specific native binaries. Retain optional dependencies
when installing the build tools; use `npm ci` on the deployment/build platform
instead of copying Windows `node_modules` to another operating system.
The emitted application remains CommonJS because package.json has no ESM type.

The Discord REST migration to fetch-compatible responses does not affect this
bot: it uses the high-level client, not raw REST responses or custom agents.
Existing deployment wrappers using dotenv preloading or `.env.vault` would need
separate migration; neither is present in this repository.

## Verification and limits

- Offline tests exercise bot initialization, reaction threshold posting,
  count edits, removal below threshold, and ignoring old messages using the real
  installed Client, Collection, and EmbedBuilder with mocked network operations.
- Configuration tests use the actual dotenv package and compiled config module
  to verify file loading, existing environment precedence, and missing credentials.
- Build and tests were run on Node 24.22.1 with the ES2024 target.
- Lockfile refresh reports zero known vulnerabilities.

A live Discord session has not been verified. Token validity, guild/channel
permissions, Message Content intent configuration, and actual gateway/REST
behavior still require a server smoke test. Offline success does not establish
that every application edge case works (for example, concurrent reactions).

## Upstream references

- [TypeScript Node target mapping](https://github.com/microsoft/TypeScript/wiki/Node-Target-Mapping)
- [Node release lifecycle](https://nodejs.org/en/about/previous-releases)
- [Node release versions](https://github.com/nodejs/node/releases)
- [npm changelog](https://docs.npmjs.com/cli/using-npm/changelog/)

- [Discord 14.27.0 documentation and runtime requirement](https://discord.js.org/docs/packages/discord.js/14.27.0)
- [Discord changelog, including intervening 14.x releases](https://github.com/discordjs/discord.js/blob/14.27.0/packages/discord.js/CHANGELOG.md)
- [dotenv changelog through 18.0.9](https://github.com/motdotla/dotenv/blob/v18.0.9/CHANGELOG.md)
- [TypeScript 7 announcement and breaking changes](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
- [DefinitelyTyped version alignment guidance](https://github.com/DefinitelyTyped/DefinitelyTyped#how-do-definitely-typed-package-versions-relate-to-versions-of-the-corresponding-library)
