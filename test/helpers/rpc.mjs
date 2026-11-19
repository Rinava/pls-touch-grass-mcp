import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export function tmpState() {
  return join(tmpdir(), `grass-test-${randomUUID()}.json`);
}

export function jsonStub(body) {
  const hits = [];
  const srv = createServer((req, res) => {
    hits.push(req.url);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  });
  return new Promise((resolve) =>
    srv.listen(0, "127.0.0.1", () => {
      srv.unref();
      resolve({ url: `http://127.0.0.1:${srv.address().port}`, hits, close: () => srv.close() });
    })
  );
}

export async function callServer(requests, env = {}, args = []) {
  const proc = spawn(process.execPath, ["dist/index.js", ...args], {
    env: {
      ...process.env,
      GRASS_GEO_URL: "http://127.0.0.1:1/geo",
      GRASS_PARKS_URL: "http://127.0.0.1:1/parks",
      GRASS_GEOCODE_URL: "http://127.0.0.1:1/geocode",
      ...env
    },
    stdio: ["pipe", "pipe", "pipe"]
  });
  setTimeout(() => proc.kill("SIGKILL"), 10000).unref();
  const msgs = [
    {
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2026-07-28",
        capabilities: {},
        clientInfo: { name: "test", version: "0.0.0" }
      }
    },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    ...requests
  ];
  // A real client holds stdin open while it waits. Closing it early makes the SDK
  // shut the server down and drop any reply still in flight, so hang up only
  // once every request has its answer.
  const waiting = new Set(msgs.filter((m) => "id" in m).map((m) => m.id));
  const parse = (text) => text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  proc.stdin.write(msgs.map((m) => JSON.stringify(m) + "\n").join(""));
  let out = "";
  proc.stdout.on("data", (d) => {
    out += d;
    for (const m of parse(out.slice(0, out.lastIndexOf("\n") + 1))) waiting.delete(m.id);
    if (waiting.size === 0) proc.stdin.end();
  });
  await once(proc, "close");
  return parse(out);
}

export function toolText(responses, id) {
  const r = responses.find((m) => m.id === id);
  return r?.result?.content?.[0]?.text ?? "";
}
