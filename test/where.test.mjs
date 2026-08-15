import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { callServer, toolText, tmpState, jsonStub } from "./helpers/rpc.mjs";

function where(id, args = {}) {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name: "where_to_touch_grass", arguments: args } };
}

test("known neighborhood: top five by distance, location persisted", async () => {
  const file = tmpState();
  const parks = await jsonStub({
    elements: [
      { type: "node", lat: -34.5711, lon: -58.4167, tags: { name: "Bosques de Palermo" } },
      { type: "node", lat: -34.6064, lon: -58.4362, tags: { name: "Parque Centenario" } },
      { type: "node", lat: -34.6156, lon: -58.4522, tags: { name: "Plaza Irlanda" } },
      { type: "node", lat: -34.6186, lon: -58.4325, tags: { name: "Parque Rivadavia" } },
      { type: "node", lat: -34.6353, lon: -58.4400, tags: { name: "Parque Chacabuco" } },
      { type: "node", lat: -34.6076, lon: -58.4210, tags: { name: "Plaza Almagro" } }
    ]
  });
  const res = await callServer([where(1, { place: "Caballito" })], {
    GRASS_STATE_FILE: file,
    GRASS_PARKS_URL: parks.url
  });
  const text = toolText(res, 1);
  assert.match(text, /Grass near Caballito/);
  assert.match(text, /Parque Centenario/);
  assert.doesNotMatch(text, /Bosques de Palermo/);
  assert.equal(text.match(/^- /gm).length, 5);
  assert.match(text, /\(~\d+ m\)/);
  assert.match(text, /\(~\d\.\d km\)/);
  assert.ok(text.indexOf("Parque Rivadavia") < text.indexOf("Plaza Irlanda"));
  const state = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(state.location.label, "Caballito");
  parks.close();
  rmSync(file, { force: true });
});

test("accents and case do not matter", async () => {
  const res = await callServer([where(1, { place: "nuñez" })], { GRASS_STATE_FILE: tmpState() });
  assert.match(toolText(res, 1), /Núñez/);
});

test("street address: geocoded, pinned, labeled by suburb", async () => {
  const file = tmpState();
  const geocode = await jsonStub([
    {
      lat: "-34.6280",
      lon: "-58.4570",
      display_name: "Av. Rivadavia 6500, Flores, Buenos Aires, Argentina",
      address: { suburb: "Flores", city: "Buenos Aires" }
    }
  ]);
  const parks = await jsonStub({
    elements: [
      { type: "node", lat: -34.63, lon: -58.46, tags: { name: "Plaza Flores" } },
      { type: "node", lat: -34.5711, lon: -58.4167, tags: { name: "Bosques de Palermo" } }
    ]
  });
  const res = await callServer([where(1, { place: "Av. Rivadavia 6500" })], {
    GRASS_STATE_FILE: file,
    GRASS_GEOCODE_URL: geocode.url,
    GRASS_PARKS_URL: parks.url
  });
  const text = toolText(res, 1);
  assert.match(geocode.hits[0], /Rivadavia/);
  assert.match(geocode.hits[0], /format=jsonv2/);
  assert.match(text, /Grass near Flores/);
  assert.match(text, /Plaza Flores \(~350 m\)/);
  const state = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(state.location.label, "Flores");
  assert.ok(state.location.pinned_at);
  assert.ok(Math.abs(state.location.lat - -34.628) < 0.001);
  geocode.close();
  parks.close();
  rmSync(file, { force: true });
});

test("geocoder finds nothing: helpful copy, no pin", async () => {
  const file = tmpState();
  const geocode = await jsonStub([]);
  const res = await callServer([where(1, { place: "Narnia, Second Star to the Right" })], {
    GRASS_STATE_FILE: file,
    GRASS_GEOCODE_URL: geocode.url
  });
  const text = toolText(res, 1);
  assert.match(text, /Couldn't find that place/);
  assert.match(text, /Palermo/);
  assert.equal(existsSync(file), false);
  geocode.close();
  rmSync(file, { force: true });
});

test("geocoder unreachable: same helpful copy, no error", async () => {
  const res = await callServer([where(1, { place: "Narnia" })], { GRASS_STATE_FILE: tmpState() });
  const text = toolText(res, 1);
  assert.match(text, /Couldn't find that place/);
  assert.match(text, /Palermo/);
});

test("no place, no state: starts from the Obelisco", async () => {
  const res = await callServer([where(1)], { GRASS_STATE_FILE: tmpState() });
  assert.match(toolText(res, 1), /Obelisco/);
});

test("parks come from the map when it answers", async () => {
  const parks = await jsonStub({
    elements: [
      { type: "node", lat: -34.594, lon: -58.376, tags: { name: "Plaza Fantasma" } },
      { type: "way", center: { lat: -34.595, lon: -58.377 }, tags: { name: "Parque Misterio" } },
      { type: "node", lat: -34.61, lon: -58.39, tags: { name: "Plaza Lejana" } },
      { type: "node", lat: -34.5941, lon: -58.3761 }
    ]
  });
  const res = await callServer([where(1, { place: "Retiro" })], {
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

test("first mirror down: the second one answers", async () => {
  const parks = await jsonStub({
    elements: [{ type: "node", lat: -34.5946, lon: -58.3756, tags: { name: "Plaza San Martín" } }]
  });
  const res = await callServer([where(1, { place: "Retiro" })], {
    GRASS_STATE_FILE: tmpState(),
    GRASS_PARKS_URL: `http://127.0.0.1:1/parks,${parks.url}`
  });
  const text = toolText(res, 1);
  assert.equal(parks.hits.length, 1);
  assert.match(text, /Plaza San Martín \(~300 m\)/);
  parks.close();
});

test("map down: says so instead of inventing parks", async () => {
  const file = tmpState();
  writeFileSync(file, JSON.stringify({ location: { lat: 40.4168, lon: -3.7038, label: "Madrid" } }));
  const res = await callServer([where(1)], { GRASS_STATE_FILE: file });
  const text = toolText(res, 1);
  assert.match(text, /No park data for Madrid/);
  assert.doesNotMatch(text, /Parque Centenario|Plaza San Martín/);
  rmSync(file, { force: true });
});

test("demo mode: distances plus the opinions", async () => {
  const res = await callServer([where(1)], { GRASS_STATE_FILE: tmpState() }, ["--demo"]);
  const text = toolText(res, 1);
  assert.match(text, /Grass near Buenos Aires:\n- Plaza San Martín \(~1\.2 km\): the most corporate/);
  assert.equal(text.match(/^- /gm).length, 5);
});

test("fresh place pin beats live geo detection", async () => {
  const geo = await jsonStub({ latitude: 48.8566, longitude: 2.3522, city: "Paris" });
  const weather = await jsonStub({ current: { temperature_2m: 20, precipitation: 0, weather_code: 0 } });
  const file = tmpState();
  await callServer([where(1, { place: "Saavedra" })], { GRASS_STATE_FILE: file });
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
  await callServer([where(1, { place: "Saavedra" })], { GRASS_STATE_FILE: file });
  await callServer(
    [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "grass_conditions", arguments: {} } }],
    { GRASS_STATE_FILE: file, GRASS_WEATHER_URL: `http://127.0.0.1:${srv.address().port}` }
  );
  assert.match(hits[0], /latitude=-34.55/);
  srv.close();
  rmSync(file, { force: true });
});
