import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { callServer, toolText, tmpState } from "./helpers/rpc.mjs";

function rage(id, msg) {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name: "frustration_detector", arguments: { trigger_message: msg } } };
}

test("first outburst with fresh grass: no excuses, go again", async () => {
  const file = tmpState();
  writeFileSync(file, JSON.stringify({
    last_grass: { timestamp: new Date(Date.now() - 1 * 60000).toISOString() },
    rage_count: 0
  }));
  const res = await callServer([rage(1, "this thing is broken")], { GRASS_STATE_FILE: file });
  assert.match(toolText(res, 1), /1 min ago/);
  assert.match(toolText(res, 1), /Go again/);
  assert.doesNotMatch(toolText(res, 1), /Breathe/);
  rmSync(file, { force: true });
});

test("first outburst with no grass ever: go outside", async () => {
  const res = await callServer([rage(1, "WHAT GARBAGE")], { GRASS_STATE_FILE: tmpState() });
  assert.match(toolText(res, 1), /grass record/);
});

test("escalation: second and fourth calls raise the tone and quote the message", async () => {
  const file = tmpState();
  const res = await callServer(
    [rage(1, "nothing works"), rage(2, "NOTHING WORKS AT ALL"), rage(3, "garbage"), rage(4, "I HATE THIS")],
    { GRASS_STATE_FILE: file }
  );
  assert.match(toolText(res, 2), /That's 2 outbursts/);
  assert.match(toolText(res, 2), /Close the laptop/);
  assert.match(toolText(res, 2), /NOTHING WORKS AT ALL/);
  assert.match(toolText(res, 4), /4 rage spirals/);
  const state = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(state.rage_count, 4);
  rmSync(file, { force: true });
});

test("touching grass absolves: rage_count back to 0", async () => {
  const file = tmpState();
  const res = await callServer(
    [rage(1, "I hate this"), { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "touched_grass", arguments: {} } }],
    { GRASS_STATE_FILE: file }
  );
  assert.match(toolText(res, 2), /Good for you/);
  assert.equal(JSON.parse(readFileSync(file, "utf8")).rage_count, 0);
  rmSync(file, { force: true });
});
