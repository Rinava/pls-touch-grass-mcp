# pls touch grass, for OpenAI's plugin directory

The package OpenAI's directory takes: a manifest, the hosted server's address, and
icons. No code. The server it points at is `src/hosted/` in this repository,
running at `https://grass.laramateo.com/mcp`.

```bash
npm run build:openai
```

That writes `pls-touch-grass-openai-<version>.zip`, the file to upload at
[platform.openai.com/plugins](https://platform.openai.com/plugins) under
**With MCP**.

- `plugin.json`: the listing copy, the five positive and three negative review
  cases, and the release notes. The cases are read-only once uploaded: edit them
  here and upload again.
- `mcp.json`: the one server, no authentication.
- `assets/`: the listing logo and the composer icon.

The walkthrough video is not in the manifest. Its URL goes in the portal's review
form, next to the test cases.

`npm test` checks the manifest against OpenAI's published limits and against the
tools the hosted server actually lists, so a renamed tool or a too-long subtitle
fails here instead of in review.
