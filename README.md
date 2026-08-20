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

### claude.ai

No. Custom connectors want a remote server over HTTPS; this is stdio on your own
machine. HTTP transport is the first item under [Homework](#homework).

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

- HTTP transport: `createMcpHandler` in SDK v2 serves the same factory over fetch, and it's what gets you onto claude.ai
- Per-project thresholds instead of a global one
- Streak tracking for consecutive grass days
- Demo spots for your own city, via PR: one object per park in `src/lib/demo.ts`, with an opinion

## Release

`npm run build:mcpb` packs `dist` and the production dependencies into
`pls-touch-grass-mcp-<version>.mcpb`, the file that goes on a GitHub Release. The
manifest is generated from `package.json`; nothing to keep in sync by hand.

## Contributing

Issues and PRs welcome — the [Homework](#homework) list is seeded as
[open issues](https://github.com/Rinava/pls-touch-grass-mcp/issues), several
tagged `good first issue`. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and
the house rules (there are few, but the demo-spot opinion is mandatory).

## License

MIT. The grass is free and so is this.
