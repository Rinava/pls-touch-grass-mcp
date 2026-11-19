# Privacy Policy

Last updated: 2026-11-18

This covers `pls-touch-grass-mcp`: the npm package, the `.mcpb` bundle, and the
Claude plugin in `plugin/`. They are the same server.

## The short version

The server runs on your machine. There is no backend, no account, no analytics and
no telemetry. The author receives nothing.

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

## Contact

Questions go to [GitHub issues](https://github.com/Rinava/pls-touch-grass-mcp/issues).
Security reports go through
[private vulnerability reporting](https://github.com/Rinava/pls-touch-grass-mcp/security/advisories/new).
