import test from "node:test";
import assert from "node:assert/strict";
import { callServer, toolText, tmpState, jsonStub } from "./helpers/rpc.mjs";

const weather = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "grass_conditions", arguments: {} } };
const where = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "where_to_touch_grass", arguments: {} } };

test("--demo: canned weather, no network", async () => {
  const geo = await jsonStub({ latitude: 48.8566, longitude: 2.3522, city: "Paris" });
  const res = await callServer([weather], { GRASS_STATE_FILE: tmpState(), GRASS_GEO_URL: geo.url }, ["--demo"]);
  assert.equal(toolText(res, 1), "22°C and clear in Buenos Aires. Perfect grass weather.");
  assert.equal(geo.hits.length, 0);
  geo.close();
});

test("--demo: curated spots with their notes", async () => {
  const parks = await jsonStub({ elements: [{ type: "node", lat: -34.6, lon: -58.38, tags: { name: "Plaza Fantasma" } }] });
  const res = await callServer([where], { GRASS_STATE_FILE: tmpState(), GRASS_PARKS_URL: parks.url }, ["--demo"]);
  const text = toolText(res, 1);
  assert.match(text, /Grass near Buenos Aires/);
  assert.match(text, /Plaza San Martín \(~1\.2 km\): the most corporate grass in the city/);
  assert.doesNotMatch(text, /Plaza Fantasma/);
  assert.equal(parks.hits.length, 0);
  parks.close();
});

test("--demo: a named neighborhood still wins", async () => {
  const call = { ...where, params: { ...where.params, arguments: { place: "Caballito" } } };
  const res = await callServer([call], { GRASS_STATE_FILE: tmpState() }, ["--demo"]);
  assert.match(toolText(res, 1), /Grass near Caballito/);
});
