# Privacy Policy

Last updated: 2026-11-18

Two things carry this name, and they treat data differently:

- **The local server**: the npm package `pls-touch-grass-mcp`, the `.mcpb` bundle
  and the Claude plugin in `plugin/`. They are the same server and it runs on your
  machine. Everything down to "The hosted server" is about it.
- **The hosted server** at `https://grass.laramateo.com/mcp`, for apps that can
  only reach a server over HTTPS, such as ChatGPT. It has
  [its own section](#the-hosted-server).

## The short version

The local server runs on your machine. There is no backend, no account, no
analytics and no telemetry. The author receives nothing.

## What is collected

Nothing is collected by the author. The server handles three kinds of data, all
of it on your machine:

- **Grass history**: the time you last logged going outside, and the optional note
  you gave.
- **Outburst count**: how many times `frustration_detector` has fired since your
  last grass. The message that triggered it is passed to the tool and its first
  60 characters can be quoted back in the reply. The message is not stored.
- **Location**: a latitude, longitude and label, either guessed from your IP
  address at city level or resolved from a place you named.

## How it is used and stored

It is used to tell you how long you have been inside, what the weather is, and
which parks are near. It is stored in one JSON file, `~/.pls-touch-grass.json`
(or wherever `GRASS_STATE_FILE` points).

## Who else receives data

To answer weather and park questions the server calls four public APIs directly
from your machine. Each one sees your IP address, as any web request does.

| Service | What it receives | Why |
|---------|------------------|-----|
| [ipwho.is](https://ipwho.is) | Your IP address | City-level location, when you haven't named a place |
| [Open-Meteo](https://open-meteo.com/en/terms) | Latitude and longitude | Current weather |
| [OpenStreetMap Nominatim](https://osmfoundation.org/wiki/Privacy_Policy) | The place name you typed | Turning it into coordinates |
| OpenStreetMap Overpass ([overpass-api.de](https://overpass-api.de), [overpass.kumi.systems](https://overpass.kumi.systems)) | Latitude and longitude | Parks within 3 km |

Installing through `npx` or the Claude plugin also downloads the package from the
[npm registry](https://docs.npmjs.com/policies/privacy).

Nothing is sold, shared for advertising, or sent anywhere else. Each service
handles what it receives under its own policy, linked above.

## Retention

The state file stays until you delete it. Logging grass resets the outburst count.
The author retains nothing, having received nothing.

## Your controls

- Delete `~/.pls-touch-grass.json` to erase everything.
- Name a place and IP location is no longer used.
- Start the server with `--demo` and it makes no network calls at all.

## The hosted server

`https://grass.laramateo.com/mcp` is the same five tools on a server, run by the
author, Lara Mateo. No account, no sign-in, no analytics, no advertising.

### What it receives

With every tool call, the app you are using sends:

- **The tool's arguments**: the optional note for `touched_grass`, a place name
  for `where_to_touch_grass`, a threshold for `gotta_go`. Here
  `frustration_detector` takes no arguments, so the message that set it off is
  never sent.
- **An anonymous id** the app made up for you (`openai/subject` in ChatGPT). It is
  not your name, your email or your account.
- **A coarse location hint**, when the app shares one: city, region, country,
  timezone and approximate coordinates.
- **Your language setting**, used to print a clock time the way you read it.

The calls come from the app's servers, not from your device, so the hosted server
never sees your IP address.

### What it stores

| What | Kept as | For how long |
|------|---------|--------------|
| Your grass log: time of last grass, outburst count | Under a keyed hash of the anonymous id | 30 days after your last call |
| The last place you named | An area label ("Flores") and coordinates rounded to about 100 m, in the same record | 30 days after your last call |
| A per-minute call counter, to stop floods | Under the same hash | Two minutes |
| Places already looked up | A hash of the place text, with rounded coordinates and an area label, tied to no one | 30 days |

Not stored: the anonymous id itself, the note, the location hint, the text of an
address you typed, or anything else from your conversation. The contents of
requests are not logged.

If the app sends no id, nothing about you is kept at all, and the tools say so.

### Who else receives data

| Service | What it receives | Why |
|---------|------------------|-----|
| [Open-Meteo](https://open-meteo.com/en/terms) | Latitude and longitude | Current weather |
| [OpenStreetMap Nominatim](https://osmfoundation.org/wiki/Privacy_Policy) | The place name you gave, or the city from the hint | Turning it into coordinates |
| OpenStreetMap Overpass ([overpass-api.de](https://overpass-api.de), [overpass.kumi.systems](https://overpass.kumi.systems)) | Latitude and longitude | Parks within 3 km |
| [Upstash](https://upstash.com/trust/privacy.pdf) | The stored records above | The database, in the United States |
| [Vercel](https://vercel.com/legal/privacy-policy) | Each request, and routine logs of its time, path and status | Running the server |

The server makes these requests, so those services see its address, not yours.
Nothing is sold, shared for advertising, or used to profile anyone.

### Your controls

- Name no place and no place is stored.
- Logging grass resets the outburst count.
- Stop calling it and your record deletes itself 30 days later.
- Nobody can look your record up, the author included: the server holds a hash of
  an id the app invented, and no way to tell which one is yours. The price of
  that is that one person's record cannot be exported or deleted on request.
- Want no server at all? The local version above keeps everything on your machine.

## Contact

Questions go to [GitHub issues](https://github.com/Rinava/pls-touch-grass-mcp/issues).
Security reports go through
[private vulnerability reporting](https://github.com/Rinava/pls-touch-grass-mcp/security/advisories/new).
