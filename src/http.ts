#!/usr/bin/env node
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import { appFromEnv } from "./hosted/app.js";

// The hosted server on a port: `node dist/http.js`, for self-hosting or a local
// poke. A serverless host skips this file and takes `appFromEnv()` directly,
// the way `api/index.js` does.
const app = appFromEnv();

const server = createServer(async (req, res) => {
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
    const bodiless = req.method === "GET" || req.method === "HEAD";
    const response = await app.fetch(
      new Request(`http://${req.headers.host ?? "localhost"}${req.url}`, {
        method: req.method,
        headers,
        body: bodiless ? undefined : (Readable.toWeb(req) as ReadableStream),
        duplex: "half"
      } as RequestInit)
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body as never).pipe(res);
    else res.end();
  } catch {
    res.writeHead(500).end();
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => {
  const { port } = server.address() as AddressInfo;
  console.error(`pls-touch-grass is listening on http://localhost:${port}/mcp`);
  if (!app.remembers) console.error("no store configured: running without memory");
});
