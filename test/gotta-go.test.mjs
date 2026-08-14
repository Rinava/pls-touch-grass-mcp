import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, rmSync } from "node:fs";
import { callServer, toolText, tmpState } from "./helpers/rpc.mjs";

const call = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "gotta_go", arguments: {} } };

function seed(file, minutesAgo) {
  writeFileSync(file, JSON.stringify({
    last_grass: { timestamp: new Date(Date.now() - minutesAgo * 60000).toISOString() },
    rage_count: 0
  }));
}

test("no record: concerning verdict", async () => {
  const res = await callServer([call], { GRASS_STATE_FILE: tmpState() });
  assert.match(toolText(res, 1), /No grass on record/);
});

test("under the threshold: you're fine", async () => {
  const file = tmpState();
  seed(file, 40);
  const res = await callServer([call], { GRASS_STATE_FILE: file });
  assert.match(toolText(res, 1), /40 min ago, you're fine/);
  rmSync(file, { force: true });
});

test("over the threshold: go outside NOW", async () => {
  const file = tmpState();
  seed(file, 180);
  const res = await callServer([call], { GRASS_STATE_FILE: file });
  assert.match(toolText(res, 1), /3 hours inside. Go outside NOW/);
  rmSync(file, { force: true });
});

test("threshold_minutes argument tightens the tolerance", async () => {
  const file = tmpState();
  seed(file, 40);
  const strict = { ...call, params: { ...call.params, arguments: { threshold_minutes: 30 } } };
  const res = await callServer([strict], { GRASS_STATE_FILE: file });
  assert.match(toolText(res, 1), /Go outside NOW/);
  rmSync(file, { force: true });
});

test("GRASS_THRESHOLD_MINUTES is ignored", async () => {
  const file = tmpState();
  seed(file, 40);
  const res = await callServer([call], { GRASS_STATE_FILE: file, GRASS_THRESHOLD_MINUTES: "10" });
  assert.match(toolText(res, 1), /you're fine/);
  rmSync(file, { force: true });
});

test("state survives a server restart", async () => {
  const file = tmpState();
  await callServer(
    [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "touched_grass", arguments: {} } }],
    { GRASS_STATE_FILE: file }
  );
  const res = await callServer([call], { GRASS_STATE_FILE: file });
  assert.match(toolText(res, 1), /you're fine/);
  rmSync(file, { force: true });
});
