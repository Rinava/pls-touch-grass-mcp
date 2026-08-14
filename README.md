# pls-touch-grass-mcp

An MCP server that knows how long it's been since you touched grass, and won't shut up about it.

You log when you go outside, it warns you when you've been inside too long, it detects
when you're raging at your AI and sends you to the nearest park, weather checked first.
It's a joke, but it's a joke that teaches MCP: five tools, shared state, and
descriptions that make the model call them on its own.

## Install in Cursor

Clone and build first:

```bash
git clone https://github.com/Rinava/pls-touch-grass-mcp
cd pls-touch-grass-mcp
npm ci && npm run build
```

Then add this to `~/.cursor/mcp.json` (or `.cursor/mcp.json` in your project),
with the absolute path to your clone:

```json
{
  "mcpServers": {
    "pls-touch-grass": {
      "command": "node",
      "args": ["/absolute/path/to/pls-touch-grass-mcp/dist/index.js"]
    }
  }
}
```

Once the package is published to npm, `npx` will skip the clone:

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

(To get every verdict without waiting two hours, tell the model "be strict with me,
one minute of tolerance": `gotta_go` takes a `threshold_minutes` argument.)

## The five tools

| Tool | What it does | When the model calls it |
|------|--------------|-------------------------|
| `touched_grass` | Logs that you went outside | "back from the park", "went for a walk" |
| `gotta_go` | Do you need to go out? | "can I keep going?", "how long have I been at this?" |
| `frustration_detector` | Catches the rage and escalates | on its own, when you snap; that's the point |
| `grass_conditions` | Real weather (Open-Meteo, no API key) | before sending you outside |
| `where_to_touch_grass` | Nearby parks from OpenStreetMap, curated spots offline | "where should I go?" |

The magic is in the descriptions: nobody teaches the model to detect frustration.
The tool description does it alone. Type "NOTHING WORKS!!!" and watch what happens.

## Zero configuration

There is nothing to configure: everything resolves through the tools themselves.
Your location is detected fresh from your IP (via [ipwho.is](https://ipwho.is)) each
time the server runs. City-level on purpose, nothing more precise leaves your
machine. If detection fails you get the last known spot, or failing that the
Obelisco, like everyone else. Name a neighborhood to `where_to_touch_grass` to
search there instead; it holds for the next half hour, so the weather in the same
conversation agrees with it, then fresh detection takes over again. The indoor-time
tolerance defaults to 120 minutes; ask the model to be stricter and it passes
`threshold_minutes` to `gotta_go`.

State is a JSON file in your home directory: `cat ~/.pls-touch-grass.json` and you'll
see it. Touching grass resets the rage counter. That's how absolution works.

## The demo curse

Live demos summon it: the venue wifi dies the moment you say "watch this". Add
`--demo` to the `args` in your MCP config and every answer goes canned: 22°C and
clear, the Obelisco, the curated spots. Zero network calls, zero surprises.
Off by default; real life should stay real.

## Follow the workshop

The repo is tagged by step, so you can rebuild the talk:

```bash
git clone https://github.com/Rinava/pls-touch-grass-mcp
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

- HTTP transport: SDK v2 ships express/hono/fastify adapters
- Per-project thresholds instead of a global one
- Streak tracking for consecutive grass days
- Spots for your own city, via PR: the format is one object per park, with an opinion

## License

MIT. The grass is free and so is this.
