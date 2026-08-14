import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { callServer, toolText, tmpState } from "./helpers/rpc.mjs";

test("tools/list exposes touched_grass", async () => {
  const res = await callServer(
    [{ jsonrpc: "2.0", id: 1, method: "tools/list" }],
    { GRASS_STATE_FILE: tmpState() }
  );
  const tools = res.find((m) => m.id === 1).result.tools;
  const grass = tools.find((t) => t.name === "touched_grass");
  assert.ok(grass);
  assert.match(grass.description, /grass/);
});

test("touched_grass records timestamp and note, resets rage", async () => {
  const file = tmpState();
  const res = await callServer(
    [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "touched_grass", arguments: { note: "went to the park" } } }],
    { GRASS_STATE_FILE: file }
  );
  assert.match(toolText(res, 1), /Grass touched at \d/);
  const state = JSON.parse(readFileSync(file, "utf8"));
  assert.ok(state.last_grass.timestamp);
  assert.equal(state.last_grass.note, "went to the park");
  assert.equal(state.rage_count, 0);
  rmSync(file, { force: true });
});

test("touched_grass works without a note", async () => {
  const file = tmpState();
  const res = await callServer(
    [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "touched_grass", arguments: {} } }],
    { GRASS_STATE_FILE: file }
  );
  assert.match(toolText(res, 1), /Good for you/);
  rmSync(file, { force: true });
});
