import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, rmSync } from "node:fs";
import { callServer, toolText, tmpState, jsonStub } from "./helpers/rpc.mjs";

const call = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "grass_conditions", arguments: {} } };

const weatherStub = (current) => jsonStub({ current });

test("nice weather: verdict with temperature", async () => {
  const stub = await weatherStub({ temperature_2m: 22, precipitation: 0, weather_code: 0 });
  const res = await callServer([call], { GRASS_STATE_FILE: tmpState(), GRASS_WEATHER_URL: stub.url });
  assert.match(toolText(res, 1), /22°C and clear/);
  assert.match(toolText(res, 1), /Perfect grass weather/);
  assert.match(stub.hits[0], /latitude=-34.6037/);
  stub.close();
});

test("rain: you're forgiven", async () => {
  const stub = await weatherStub({ temperature_2m: 18, precipitation: 2.5, weather_code: 61 });
  const res = await callServer([call], { GRASS_STATE_FILE: tmpState(), GRASS_WEATHER_URL: stub.url });
  assert.match(toolText(res, 1), /raining/);
  assert.match(toolText(res, 1), /forgiven until it stops/);
  stub.close();
});

test("extreme heat: find shade", async () => {
  const stub = await weatherStub({ temperature_2m: 38, precipitation: 0, weather_code: 0 });
  const res = await callServer([call], { GRASS_STATE_FILE: tmpState(), GRASS_WEATHER_URL: stub.url });
  assert.match(toolText(res, 1), /grass burns/);
  stub.close();
});

test("network down: fallback, never an error", async () => {
  const res = await callServer([call], {
    GRASS_STATE_FILE: tmpState(),
    GRASS_WEATHER_URL: "http://127.0.0.1:1/weather"
  });
  assert.equal(toolText(res, 1), "Couldn't check the weather, go outside anyway");
});

test("GRASS_LAT/GRASS_LON are ignored: location still autodetected", async () => {
  const geo = await jsonStub({ latitude: 48.8566, longitude: 2.3522, city: "Paris" });
  const stub = await weatherStub({ temperature_2m: 20, precipitation: 0, weather_code: 1 });
  await callServer([call], {
    GRASS_STATE_FILE: tmpState(),
    GRASS_WEATHER_URL: stub.url,
    GRASS_GEO_URL: geo.url,
    GRASS_LAT: "-34.55",
    GRASS_LON: "-58.46"
  });
  assert.equal(geo.hits.length, 1);
  assert.match(stub.hits[0], /latitude=48.8566/);
  geo.close();
  stub.close();
});

test("no config: autodetects location from IP", async () => {
  const geo = await jsonStub({ latitude: 48.8566, longitude: 2.3522, city: "Paris" });
  const stub = await weatherStub({ temperature_2m: 20, precipitation: 0, weather_code: 0 });
  const res = await callServer([call], {
    GRASS_STATE_FILE: tmpState(),
    GRASS_WEATHER_URL: stub.url,
    GRASS_GEO_URL: geo.url
  });
  assert.match(stub.hits[0], /latitude=48.8566/);
  assert.match(toolText(res, 1), /in Paris/);
  geo.close();
  stub.close();
});

test("detected location is cached: one geo lookup for two calls", async () => {
  const geo = await jsonStub({ latitude: 48.8566, longitude: 2.3522, city: "Paris" });
  const stub = await weatherStub({ temperature_2m: 20, precipitation: 0, weather_code: 0 });
  const second = { ...call, id: 2 };
  await callServer([call, second], {
    GRASS_STATE_FILE: tmpState(),
    GRASS_WEATHER_URL: stub.url,
    GRASS_GEO_URL: geo.url
  });
  assert.equal(geo.hits.length, 1);
  assert.equal(stub.hits.length, 2);
  geo.close();
  stub.close();
});

test("saved neighborhood no longer pins: fresh detection wins", async () => {
  const geo = await jsonStub({ latitude: 48.8566, longitude: 2.3522, city: "Paris" });
  const stub = await weatherStub({ temperature_2m: 20, precipitation: 0, weather_code: 0 });
  const file = tmpState();
  writeFileSync(file, JSON.stringify({ location: { lat: -34.618, lon: -58.442, label: "Caballito" } }));
  const res = await callServer([call], {
    GRASS_STATE_FILE: file,
    GRASS_WEATHER_URL: stub.url,
    GRASS_GEO_URL: geo.url
  });
  assert.match(stub.hits[0], /latitude=48.8566/);
  assert.match(toolText(res, 1), /in Paris/);
  geo.close();
  stub.close();
  rmSync(file, { force: true });
});

test("a neighborhood you named outlives IP detection, however old", async () => {
  const geo = await jsonStub({ latitude: 48.8566, longitude: 2.3522, city: "Paris" });
  const stub = await weatherStub({ temperature_2m: 20, precipitation: 0, weather_code: 0 });
  const file = tmpState();
  writeFileSync(file, JSON.stringify({
    location: { lat: -34.618, lon: -58.442, label: "Caballito", pinned_at: new Date(Date.now() - 45 * 60000).toISOString() }
  }));
  const res = await callServer([call], { GRASS_STATE_FILE: file, GRASS_WEATHER_URL: stub.url, GRASS_GEO_URL: geo.url });
  assert.match(stub.hits[0], /latitude=-34.618/);
  assert.match(toolText(res, 1), /in Caballito/);
  geo.close();
  stub.close();
  rmSync(file, { force: true });
});

test("geo lookup down: falls back to the Obelisco", async () => {
  const stub = await weatherStub({ temperature_2m: 20, precipitation: 0, weather_code: 0 });
  const res = await callServer([call], { GRASS_STATE_FILE: tmpState(), GRASS_WEATHER_URL: stub.url });
  assert.match(stub.hits[0], /latitude=-34.6037/);
  assert.match(toolText(res, 1), /Obelisco/);
  stub.close();
});

test("malformed payload: fallback, never garbage", async () => {
  const stub = await weatherStub({});
  const res = await callServer([call], { GRASS_STATE_FILE: tmpState(), GRASS_WEATHER_URL: stub.url });
  assert.equal(toolText(res, 1), "Couldn't check the weather, go outside anyway");
  stub.close();
});
