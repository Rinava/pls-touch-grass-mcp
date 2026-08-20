# Security Policy

## Supported versions

The latest release on npm (`pls-touch-grass-mcp`) is the supported version.
Older versions get fixes by becoming the latest version.

## What this thing actually touches

Worth knowing before you report: the server runs locally over stdio, keeps its
state in `~/.pls-touch-grass.json`, and talks to three public APIs — ipwho.is
(IP geolocation), Open-Meteo (weather), and OpenStreetMap Nominatim (geocoding,
only the place names you type). No keys, no accounts, no telemetry. `--demo`
mode makes zero network calls.

## Reporting a vulnerability

Please don't open a public issue for security problems. Instead, use
[GitHub's private vulnerability reporting](https://github.com/Rinava/pls-touch-grass-mcp/security/advisories/new)
on this repository.

You'll get a response within a week — usually much faster. If it's real, it gets
fixed and released promptly, and you get credit unless you'd rather not.
