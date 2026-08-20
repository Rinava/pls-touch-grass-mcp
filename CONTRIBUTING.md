# Contributing

You want to help people go outside. Excellent. Here's how not to get lost on the way.

## Setup

```bash
git clone https://github.com/Rinava/pls-touch-grass-mcp
cd pls-touch-grass-mcp
npm ci
npm test
```

Node 20 or newer. `npm test` builds first, then runs the whole suite with the
built-in `node --test` runner — no test framework to learn, no config to fight.

Two runtime dependencies total: the official MCP SDK and zod. Keep it that way.
A PR that adds a dependency needs a very good story.

## Working on it

- `npm run build` — compile TypeScript to `dist/`
- `npm test` — build + run everything in `test/`
- `npm run probe` — build + poke the server over stdio with canned answers
- `npm run probe:live` — same, but with real network calls
- `npm run mcp:local` — register your working copy with Claude Code so you can
  yell at it in person

Every tool lives in its own file under `src/tools/`, shared bits under `src/lib/`.
Each tool has a matching test in `test/`. New behavior comes with a test; that's
how every step of the workshop stayed honest and it's how PRs stay honest too.

## The step tags

This repo doubles as a workshop. Tags `step-1` through `step-5` each mark a
compiling, tested snapshot of the build-up. Regular contributions go to `main`
and don't need to worry about the tags — they're history, not branches.

## Adding a demo spot for your city

The easiest PR there is, and explicitly invited: add one object per park to
`src/lib/demo.ts`, with an opinion. The opinion is mandatory. "A park" is data;
"the park where the parakeets have formed a government" is a demo spot.

## Pull requests

- Small and focused beats big and heroic
- `npm test` green before you push (CI runs it on Node 20 and 22)
- Match the tone: this project is a joke that takes its craft seriously.
  Comments and copy in English, precise where it counts, playful where it can be
- No need to touch the version number — releases are handled separately

## Bugs and ideas

Open an issue. Templates exist; they're short. If the model isn't calling a tool
when it should, include what you typed — tool descriptions are the product here,
and reproducing "it didn't trigger" starts with the exact words.
