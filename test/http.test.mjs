import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

// The other hosted tests call the app in-process. This one proves the file a
// host actually runs: `node dist/http.js`, on a real port, with no store.
test("node dist/http.js serves the endpoint and the domain challenge", async () => {
  const proc = spawn(process.execPath, ["dist/http.js"], {
    env: { PATH: process.env.PATH, PORT: "0", OPENAI_APPS_CHALLENGE: "token-from-the-portal" },
    stdio: ["ignore", "ignore", "pipe"]
  });
  setTimeout(() => proc.kill("SIGKILL"), 10000).unref();
  try {
    let log = "";
    while (!/http:\/\/localhost:\d+/.test(log)) log += (await once(proc.stderr, "data"))[0];
    const base = log.match(/http:\/\/localhost:\d+/)[0];

    const challenge = await fetch(`${base}/.well-known/openai-apps-challenge`);
    assert.equal(await challenge.text(), "token-from-the-portal");

    const listed = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
    });
    assert.equal(listed.status, 200);
    assert.match(await listed.text(), /"name":"touched_grass"/);
  } finally {
    proc.kill();
  }
});

test("the Vercel entry point exports a fetch handler that serves the app", async () => {
  // It configures itself from the environment. A store in the developer's shell is not this test's to touch.
  for (const name of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) {
    delete process.env[name];
  }
  const { default: entry } = await import("../api/index.js");
  const home = await entry.fetch(new Request("https://grass.test/"));
  assert.equal(home.status, 200);
  const listed = await entry.fetch(
    new Request("https://grass.test/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
    })
  );
  assert.match(await listed.text(), /"name":"where_to_touch_grass"/);
});

test("vercel.json sends every path to that entry point and ships the files it reads", async () => {
  const { readFileSync, existsSync } = await import("node:fs");
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.deepEqual(config.rewrites, [{ source: "/(.*)", destination: "/api/index" }]);
  const [[entry, settings]] = Object.entries(config.functions);
  assert.ok(existsSync(entry), entry);
  for (const file of settings.includeFiles.replace(/[{}]/g, "").split(",")) assert.ok(existsSync(file), file);
  assert.ok(existsSync(config.outputDirectory), "an output directory, so the repo itself is not served as static files");
});
