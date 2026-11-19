# pls-touch-grass-mcp

[![npm](https://img.shields.io/npm/v/pls-touch-grass-mcp)](https://www.npmjs.com/package/pls-touch-grass-mcp)
[![ci](https://github.com/Rinava/pls-touch-grass-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Rinava/pls-touch-grass-mcp/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

An MCP server that knows how long it's been since you touched grass, and won't shut up about it.

You log grass, it tracks indoor time, it catches you raging at your AI and sends you
to the nearest park, weather checked first. A joke, but one that teaches MCP: five
tools, shared state, and descriptions that make the model call them unprompted.

## Install

### Claude Code

```bash
claude mcp add pls-touch-grass -s user -- npx -y pls-touch-grass-mcp
```

`-s user`, or the server only exists in the directory you ran that from. Working from
a clone, skip the command: there's a `.mcp.json` in the root and Claude Code offers it
when you open the folder.

### Cursor

[![Add to Cursor](https://img.shields.io/badge/Add_to-Cursor-000000?style=for-the-badge)](https://cursor.com/install-mcp?name=pls-touch-grass&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInBscy10b3VjaC1ncmFzcy1tY3AiXX0=)

Or the JSON, in `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per project):

```json
{
  "mcpServers": {
    "pls-touch-grass": {
      "command": "npx",
      "args": ["-y", "pls-touch-grass-mcp"]
    }
  }
}
```

### Claude Desktop

`.mcpb` from [Releases](https://github.com/Rinava/pls-touch-grass-mcp/releases), then
Settings → Extensions → Install Extension. Dependencies are bundled; installs offline.
By hand it's the same JSON as Cursor, in `claude_desktop_config.json`
(`~/Library/Application Support/Claude/` on macOS, `%APPDATA%\Claude\` on Windows).

### Claude plugin

[`plugin/`](plugin) wraps the same server as a Claude plugin, the shape Anthropic's
plugin directory takes local servers in. From a clone:

```bash
claude --plugin-dir ./plugin
```

It launches the published npm package at a pinned version, so it runs in Claude Code
and in Cowork sessions on your own machine.

### ChatGPT, and anything else that wants HTTPS

There is a hosted copy at `https://grass.laramateo.com/mcp`: the same five tools, no
sign-in, nothing to install. It tells people apart by the anonymous id ChatGPT sends
with each call, takes its location from the coarse hint the app shares instead of
your IP, and forgets you after 30 days of silence. `frustration_detector` takes no
arguments there, so your outburst stays in the chat it happened in.
[PRIVACY.md](PRIVACY.md#the-hosted-server) has the full account.

To run your own, `npm run start:http` serves it on `PORT` (3000 unless told).
Give it `KV_REST_API_URL` and `KV_REST_API_TOKEN` from an Upstash Redis database
and it remembers; without them every answer comes with amnesia.

### claude.ai

Custom connectors want a remote server over HTTPS, which the hosted copy above is.
It has no memory there: the grass log is filed under a user id, and claude.ai does
not send one. The tools say so instead of pretending.

### From source

```bash
git clone https://github.com/Rinava/pls-touch-grass-mcp
cd pls-touch-grass-mcp
npm ci && npm run build
```

Point any config above at `node /absolute/path/to/dist/index.js` instead.

`npx -y` downloads the package on first start — live audiences and venue wifi deserve
a warm cache. Published on npm as `pls-touch-grass-mcp`, in the MCP Registry as
`io.github.Rinava/pls-touch-grass`.

## The five tools

| Tool | What it does | When the model calls it |
|------|--------------|-------------------------|
| `touched_grass` | Logs that you went outside | "back from the park" |
| `gotta_go` | Do you need to go out? | "can I keep going?" |
| `frustration_detector` | Catches the rage and escalates | on its own, when you snap; that's the point |
| `grass_conditions` | Real weather (Open-Meteo, no key) | before sending you outside |
| `where_to_touch_grass` | Nearby parks with distances (OpenStreetMap) | "where should I go?", or when you name a place |

Nobody teaches the model to detect frustration: the tool description does it alone.
Type "NOTHING WORKS!!!" and watch.

## Zero configuration

Location resolves fresh from your IP ([ipwho.is](https://ipwho.is)) each run —
city-level on purpose. Detection down: last known spot, then the Obelisco, like
everyone else. Name a neighborhood or a street address to `where_to_touch_grass` and
it sticks: known neighborhoods resolve offline, anything else is geocoded once through
OpenStreetMap's Nominatim, and only the words you typed leave your machine. A place
you named outranks a guess from your IP, until you name a different one.

Indoor tolerance defaults to a merciless 2 minutes; ask the model for clemency and it
passes a bigger `threshold_minutes` to `gotta_go`. State is one JSON file,
`~/.pls-touch-grass.json`. Touching grass resets the rage counter. That's how
absolution works.

## The demo curse

Live demos summon it: the venue wifi dies the moment you say "watch this". Add
`--demo` to the `args` and every answer goes canned — 22°C and clear, the Obelisco,
the curated spots. Zero network calls, zero surprises. Off by default; real life
should stay real.

## Follow the workshop

The repo is tagged by step:

```bash
git checkout step-1   # stdio server + touched_grass
git checkout step-2   # + gotta_go (state and threshold)
git checkout step-3   # + frustration_detector (the demo)
git checkout step-4   # + grass_conditions (network with fallback)
git checkout step-5   # + where_to_touch_grass and this README
npm ci && npm test
```

Every step compiles and passes its own tests. Two dependencies total: the official
MCP SDK and zod.

## Homework

- A user id that isn't ChatGPT's, so the hosted server remembers people on other clients too
- Per-project thresholds instead of a global one
- Streak tracking for consecutive grass days
- Demo spots for your own city, via PR: one object per park in `src/lib/demo.ts`, with an opinion

## Release

`npm run build:mcpb` packs `dist` and the production dependencies into
`pls-touch-grass-mcp-<version>.mcpb`, the file that goes on a GitHub Release. The
manifest is generated from `package.json`; nothing to keep in sync by hand.

Three places do carry the version by hand: `server.json`, the plugin's pin in
`plugin/`, and `openai-plugin/plugin.json`. `npm test` fails until all of them
agree with `package.json`, so a release can't forget one.

`npm run build:openai` zips [`openai-plugin/`](openai-plugin) into the file OpenAI's
plugin directory takes. It holds the listing and the hosted server's address, no
code: the hosted server updates when its deployment does. Publish to npm before merging a new pin: the plugin directory
follows `main`, and a pin to an unpublished version starts nothing.

## Contributing

Issues and PRs welcome — the [Homework](#homework) list is seeded as
[open issues](https://github.com/Rinava/pls-touch-grass-mcp/issues), several
tagged `good first issue`. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and
the house rules (there are few, but the demo-spot opinion is mandatory).

## License

MIT. The grass is free and so is this.
