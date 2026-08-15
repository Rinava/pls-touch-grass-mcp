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
  proc.stdin.write(msgs.map((m) => JSON.stringify(m) + "\n").join(""));
  proc.stdin.end();
  let out = "";
  proc.stdout.on("data", (d) => (out += d));
  await once(proc, "close");
  return out.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

export function toolText(responses, id) {
  const r = responses.find((m) => m.id === id);
  return r?.result?.content?.[0]?.text ?? "";
}
