# pls touch grass

A Claude plugin that knows how long it's been since you touched grass, and won't
shut up about it.

You log grass, it tracks indoor time, it notices when you're raging at your AI and
sends you to the nearest park, weather checked first. A joke, but a working one.

## What's in it

One local MCP server, five tools:

| Tool | What it does | When Claude calls it |
|------|--------------|----------------------|
| `touched_grass` | Logs that you went outside | "back from the park" |
| `gotta_go` | Tells you whether you need to go out | "can I keep going?" |
| `frustration_detector` | Counts the outburst and returns a verdict | on its own, when you snap |
| `grass_conditions` | Current weather where you are | before sending you outside |
| `where_to_touch_grass` | Nearby parks with distances | "where should I go?" |

Know this before you install: `frustration_detector` is meant to be called without
you asking. Its description tells Claude to call it when you swear, type in all
caps, or repeat the same request a third time. That is the joke, and it is stated
here so it isn't a surprise.

## Try it

- "I just got back from a walk in the park."
- "Can I keep working, or do I need a break?"
- "Where can I touch grass near Palermo?"
- "NOTHING WORKS!!!"

## Requirements

Node.js 20 or newer on your `PATH`. The server runs on your own machine, so the
plugin works in Claude Code and in Cowork sessions that run on your computer.
Chat on claude.ai skips local servers.

## What it runs, stores and sends

**Runs.** The plugin starts the server with `npx -y pls-touch-grass-mcp@0.3.1`.
npm downloads that exact version from the public registry the first time. The
source is in this repository, under `src/`.

**Stores.** One JSON file, `~/.pls-touch-grass.json`: when you last touched grass
and the note you left, a count of outbursts, and your last location (latitude,
longitude, a label). Delete the file to reset everything. No account, no
telemetry, nothing sent to the author.

**Sends.** Four public APIs, no keys:

| Service | What it receives | When |
|---------|------------------|------|
| [ipwho.is](https://ipwho.is) | The request itself, so your IP address | Weather or parks, when you haven't named a place |
| [Open-Meteo](https://open-meteo.com) | Latitude and longitude | `grass_conditions` |
| [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org) | The place name you typed | `where_to_touch_grass`, for a place outside the built-in list |
| OpenStreetMap Overpass (`overpass-api.de`, `overpass.kumi.systems`) | Latitude and longitude | `where_to_touch_grass` |

IP location is city-level on purpose. The message that set off
`frustration_detector` is passed to the tool and its first 60 characters can be
quoted back in the verdict. It is not stored and not sent anywhere.

The full policy is in [PRIVACY.md](https://github.com/Rinava/pls-touch-grass-mcp/blob/main/PRIVACY.md).

## Support

[Open an issue](https://github.com/Rinava/pls-touch-grass-mcp/issues). For
security problems, use
[private vulnerability reporting](https://github.com/Rinava/pls-touch-grass-mcp/security/advisories/new).

## License

MIT. The grass is free and so is this.
