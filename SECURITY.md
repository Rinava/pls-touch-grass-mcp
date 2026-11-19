# Security Policy

## Supported versions

The latest release on npm (`pls-touch-grass-mcp`) is the supported version.
Older versions get fixes by becoming the latest version.

## What this thing actually touches

Worth knowing before you report: the server runs locally over stdio, keeps its
state in `~/.pls-touch-grass.json`, and talks to four public APIs — ipwho.is
(IP geolocation), Open-Meteo (weather), OpenStreetMap Nominatim (geocoding,
only the place names you type), and OpenStreetMap Overpass (parks near a
coordinate). No keys, no accounts, no telemetry. `--demo` mode makes zero
network calls. [PRIVACY.md](PRIVACY.md) has the full list of what goes where.

There is also a hosted copy at `https://grass.laramateo.com/mcp` (`src/http.ts`,
`src/hosted/`). It has no sign-in: a user is whoever the calling app's anonymous
id says they are, and their state (last grass, outburst count, a place they
named) sits in Upstash Redis under a keyed hash of that id for 30 days. It never
looks up an IP address. Reports about it are as welcome as reports about the
package.

## Reporting a vulnerability

Please don't open a public issue for security problems. Instead, use
[GitHub's private vulnerability reporting](https://github.com/Rinava/pls-touch-grass-mcp/security/advisories/new)
on this repository.

You'll get a response within a week — usually much faster. If it's real, it gets
fixed and released promptly, and you get credit unless you'd rather not.
