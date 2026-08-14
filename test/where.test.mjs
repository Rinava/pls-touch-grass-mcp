import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { callServer, toolText, tmpState, jsonStub } from "./helpers/rpc.mjs";

function where(id, args = {}) {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name: "where_to_touch_grass", arguments: args } };
}

test("known neighborhood: sorted by distance, location persisted", async () => {
  const file = tmpState();
  const res = await callServer([where(1, { neighborhood: "Caballito" })], { GRASS_STATE_FILE: file });
  const text = toolText(res, 1);
  assert.match(text, /Grass near Caballito/);
  assert.match(text, /Parque Centenario/);
  assert.doesNotMatch(text, /\d+ blocks/);
  assert.equal(text.match(/^- /gm).length, 3);
  const state = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(state.location.label, "Caballito");
  rmSync(file, { force: true });
});

test("accents and case do not matter", async () => {
  const res = await callServer([where(1, { neighborhood: "nuñez" })], { GRASS_STATE_FILE: tmpState() });
  assert.match(toolText(res, 1), /Grass near Núñez/);
});

test("unknown neighborhood: lists the known ones, no error", async () => {
  const res = await callServer([where(1, { neighborhood: "Narnia" })], { GRASS_STATE_FILE: tmpState() });
  const text = toolText(res, 1);
  assert.match(text, /I don't know that neighborhood/);
  assert.match(text, /Palermo/);
});

test("no neighborhood, no state: starts from the Obelisco", async () => {
  const res = await callServer([where(1)], { GRASS_STATE_FILE: tmpState() });
  assert.match(toolText(res, 1), /Obelisco/);
});

test("parks come from the map when it answers", async () => {
  const parks = await jsonStub({
    elements: [
      { type: "node", lat: -34.5940, lon: -58.3760, tags: { name: "Plaza Fantasma" } },
      { type: "way", center: { lat: -34.5950, lon: -58.3770 }, tags: { name: "Parque Misterio" } },
      { type: "node", lat: -34.6100, lon: -58.3900, tags: { name: "Plaza Lejana" } },
      { type: "node", lat: -34.5941, lon: -58.3761 }
    ]
  });
  const res = await callServer([where(1, { neighborhood: "Retiro" })], {
    GRASS_STATE_FILE: tmpState(),
    GRASS_PARKS_URL: parks.url
  });
  const text = toolText(res, 1);
  assert.equal(parks.hits.length, 1);
  assert.match(text, /Grass near Retiro/);
  assert.match(text, /Plaza Fantasma/);
  assert.match(text, /Parque Misterio/);
  assert.doesNotMatch(text, /Plaza San Martín/);
  assert.equal(text.match(/^- /gm).length, 3);
  parks.close();
});

test("map down: the curated spots answer instead", async () => {
  const res = await callServer([where(1, { neighborhood: "Retiro" })], { GRASS_STATE_FILE: tmpState() });
  const text = toolText(res, 1);
  assert.match(text, /Grass near Retiro/);
  assert.match(text, /Plaza San Martín/);
});

test("fresh neighborhood pin beats live geo detection", async () => {
  const geo = await jsonStub({ latitude: 48.8566, longitude: 2.3522, city: "Paris" });
  const weather = await jsonStub({ current: { temperature_2m: 20, precipitation: 0, weather_code: 0 } });
  const file = tmpState();
  await callServer([where(1, { neighborhood: "Saavedra" })], { GRASS_STATE_FILE: file });
  const res = await callServer(
    [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "grass_conditions", arguments: {} } }],
    { GRASS_STATE_FILE: file, GRASS_WEATHER_URL: weather.url, GRASS_GEO_URL: geo.url }
  );
  assert.match(weather.hits[0], /latitude=-34.55/);
  assert.match(toolText(res, 1), /in Saavedra/);
  geo.close();
  weather.close();
  rmSync(file, { force: true });
});

test("far from the curated list: no confident nonsense", async () => {
  const file = tmpState();
  writeFileSync(file, JSON.stringify({ location: { lat: 40.4168, lon: -3.7038, label: "Madrid" } }));
  const res = await callServer([where(1)], { GRASS_STATE_FILE: file });
  const text = toolText(res, 1);
  assert.doesNotMatch(text, /Parque Centenario/);
  assert.match(text, /only covers Buenos Aires/);
  rmSync(file, { force: true });
});

test("saved location is used by grass_conditions afterwards", async () => {
  const { createServer } = await import("node:http");
  const hits = [];
  const srv = createServer((req, res) => {
    hits.push(req.url);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ current: { temperature_2m: 20, precipitation: 0, weather_code: 0 } }));
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  srv.unref();
  const file = tmpState();
  await callServer([where(1, { neighborhood: "Saavedra" })], { GRASS_STATE_FILE: file });
  await callServer(
    [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "grass_conditions", arguments: {} } }],
    { GRASS_STATE_FILE: file, GRASS_WEATHER_URL: `http://127.0.0.1:${srv.address().port}` }
  );
  assert.match(hits[0], /latitude=-34.55/);
  srv.close();
  rmSync(file, { force: true });
});
