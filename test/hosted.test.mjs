import test from "node:test";
import assert from "node:assert/strict";
import { jsonStub } from "./helpers/rpc.mjs";
import { hosted, meta, rpc, call, get } from "./helpers/hosted.mjs";

// No test here may reach the real internet: every upstream points at a closed
// port unless the test swaps in a stub.
const UPSTREAMS = {
  GRASS_WEATHER_URL: "http://127.0.0.1:1/weather",
  GRASS_PARKS_URL: "http://127.0.0.1:1/parks",
  GRASS_GEOCODE_URL: "http://127.0.0.1:1/geocode",
  GRASS_GEO_URL: "http://127.0.0.1:1/geo"
};
test.beforeEach(() => Object.assign(process.env, UPSTREAMS));

const LISBON = { city: "Lisbon", region: "Lisbon", country: "PT", latitude: 38.72, longitude: -9.14 };
const sunny = () => jsonStub({ current: { temperature_2m: 22, precipitation: 0, weather_code: 0 } });
const stored = (store) => JSON.stringify(store.seen);

test("the hosted server lists the same five tools", async () => {
  const { app } = await hosted();
  const { message } = await rpc(app, "tools/list");
  assert.deepEqual(
    message.result.tools.map((t) => t.name),
    ["touched_grass", "gotta_go", "frustration_detector", "grass_conditions", "where_to_touch_grass"]
  );
});

test("every hosted tool declares the three hints OpenAI requires", async () => {
  const { app } = await hosted();
  const { message } = await rpc(app, "tools/list");
  for (const tool of message.result.tools) {
    for (const hint of ["readOnlyHint", "destructiveHint", "openWorldHint"]) {
      assert.equal(typeof tool.annotations?.[hint], "boolean", `${tool.name} declares ${hint}`);
    }
    assert.equal(tool.annotations.destructiveHint, false, tool.name);
  }
  const openWorld = message.result.tools.filter((t) => t.annotations.openWorldHint).map((t) => t.name);
  assert.deepEqual(openWorld, ["grass_conditions", "where_to_touch_grass"]);
});

test("hosted descriptions match hosted behavior: no message parameter, no IP detection", async () => {
  const { app } = await hosted();
  const { message } = await rpc(app, "tools/list");
  const detector = message.result.tools.find((t) => t.name === "frustration_detector");
  assert.deepEqual(detector.inputSchema.properties ?? {}, {});
  for (const tool of message.result.tools) {
    assert.doesNotMatch(tool.description, /\bIP\b/, tool.name);
    assert.doesNotMatch(JSON.stringify(tool.inputSchema), /verbatim/, tool.name);
  }
});

test("each user gets their own grass log", async () => {
  const { app } = await hosted();
  assert.match((await call(app, "touched_grass", {}, meta("ana"))).text, /Good for you/);
  assert.match((await call(app, "gotta_go", {}, meta("ana"))).text, /you're fine/);
  assert.match((await call(app, "gotta_go", {}, meta("bruno"))).text, /No grass on record/);
});

test("no user id, no memory: the tools still answer and nothing is stored", async () => {
  const { app, store } = await hosted();
  const touched = await call(app, "touched_grass", { note: "walked the dog" });
  assert.match(touched.text, /Good for you/);
  assert.match(touched.text, /can't keep/);
  assert.match((await call(app, "gotta_go")).text, /can't keep/);
  assert.match((await call(app, "frustration_detector")).text, /can't keep count/);
  assert.deepEqual(store.keys("grass:u:"), []);
  assert.doesNotMatch(stored(store), /walked the dog/);
});

test("the raw user id, the note and the outburst never reach the store", async () => {
  const { app, store } = await hosted();
  const who = meta("user-raw-id-123");
  const touched = await call(app, "touched_grass", { note: "cried in the park" }, who);
  assert.match(touched.text, /Noted: "cried in the park"/);
  const verdict = await call(app, "frustration_detector", { trigger_message: "SECRET RAGE" }, who);
  assert.doesNotMatch(verdict.text, /SECRET RAGE/);
  assert.equal(store.keys("grass:u:").length, 1);
  assert.doesNotMatch(stored(store), /user-raw-id-123|cried in the park|SECRET RAGE/);
});

test("a user's state is set to expire 30 days after their last call", async () => {
  const { app, store } = await hosted();
  await call(app, "touched_grass", {}, meta("ana"));
  const [key] = store.keys("grass:u:");
  assert.equal(store.ttl.get(key), 30 * 24 * 60 * 60);
  store.ttl.clear();
  await call(app, "gotta_go", {}, meta("ana"));
  assert.equal(store.ttl.get(key), 30 * 24 * 60 * 60, "a read counts as a call");
});

test("outbursts count per user, without a quote, and grass absolves", async () => {
  const { app } = await hosted();
  assert.match((await call(app, "frustration_detector", {}, meta("ana"))).text, /First outburst/);
  const second = await call(app, "frustration_detector", {}, meta("ana"));
  assert.match(second.text, /That's 2 outbursts and there's not a single grass record/);
  assert.doesNotMatch(second.text, /\("/);
  assert.match((await call(app, "frustration_detector", {}, meta("bruno"))).text, /First outburst/);
  await call(app, "touched_grass", {}, meta("ana"));
  assert.match((await call(app, "frustration_detector", {}, meta("ana"))).text, /already like this/);
});

test("the calls of one frustrated turn cannot overwrite each other", async () => {
  const { app, store } = await hosted();
  const geocode = await jsonStub([{ lat: "41.1579", lon: "-8.6291", address: { city: "Porto" } }]);
  process.env.GRASS_GEOCODE_URL = geocode.url;
  await Promise.all([
    call(app, "frustration_detector", {}, meta("ana")),
    call(app, "where_to_touch_grass", { place: "Porto" }, meta("ana"))
  ]);
  const [key] = store.keys("grass:u:");
  assert.equal(store.data.get(key).get("rage"), "1");
  assert.match(store.data.get(key).get("place"), /Porto/);
  const writes = store.seen.filter(([name, k]) => k === key && /^H(SET|INCRBY)$/.test(name));
  assert.deepEqual(writes.map(([name, , field]) => `${name} ${field}`).sort(), ["HINCRBY rage", "HSET place"]);
  geocode.close();
});

test("the app's location hint places the weather, and is never stored", async () => {
  const { app, store } = await hosted();
  const weather = await sunny();
  process.env.GRASS_WEATHER_URL = weather.url;
  const res = await call(app, "grass_conditions", {}, meta("ana", LISBON));
  assert.match(res.text, /22°C and clear in Lisbon/);
  assert.match(weather.hits[0], /latitude=38\.72&longitude=-9\.14/);
  assert.doesNotMatch(stored(store), /Lisbon|38\.72/);
  weather.close();
});

test("coordinates sent as strings are read; nonsense is ignored", async () => {
  const { app } = await hosted();
  const weather = await sunny();
  process.env.GRASS_WEATHER_URL = weather.url;
  const strings = { city: "Lisbon", latitude: "38.72", longitude: "-9.14" };
  assert.match((await call(app, "grass_conditions", {}, meta("ana", strings))).text, /in Lisbon/);
  for (const bogus of [{ latitude: null, longitude: null }, { latitude: 123, longitude: 9 }, "Lisbon", { latitude: "", longitude: "" }]) {
    assert.match((await call(app, "grass_conditions", {}, meta("ana", bogus))).text, /where you are/);
  }
  assert.equal(weather.hits.length, 1);
  weather.close();
});

test("no place and no hint: it asks instead of guessing a city", async () => {
  const { app } = await hosted();
  const weather = await sunny();
  process.env.GRASS_WEATHER_URL = weather.url;
  const conditions = await call(app, "grass_conditions", {}, meta("ana"));
  assert.match(conditions.text, /where you are/);
  const where = await call(app, "where_to_touch_grass", {}, meta("ana"));
  assert.match(where.text, /Where are you\?/);
  assert.doesNotMatch(conditions.text + where.text, /Obelisco/);
  assert.equal(weather.hits.length, 0);
  weather.close();
});

test("a hint that only names a city is geocoded", async () => {
  const { app } = await hosted();
  const geocode = await jsonStub([{ lat: "48.2082", lon: "16.3738", address: { city: "Wien" } }]);
  const weather = await sunny();
  Object.assign(process.env, { GRASS_GEOCODE_URL: geocode.url, GRASS_WEATHER_URL: weather.url });
  const res = await call(app, "grass_conditions", {}, meta("ana", { city: "Vienna", country: "AT" }));
  assert.match(res.text, /in Wien/);
  assert.match(decodeURIComponent(geocode.hits[0]), /q=Vienna, AT/);
  assert.match(weather.hits[0], /latitude=48\.208&/);
  geocode.close();
  weather.close();
});

test("a place you named sticks, outranks the hint, and is stored coarsely", async () => {
  const { app, store } = await hosted();
  const geocode = await jsonStub([
    { lat: "-34.62804", lon: "-58.45709", display_name: "Av. Rivadavia 6500, Flores", address: { suburb: "Flores" } }
  ]);
  const parks = await jsonStub({ elements: [{ type: "node", lat: -34.63, lon: -58.46, tags: { name: "Plaza Flores" } }] });
  const weather = await sunny();
  Object.assign(process.env, { GRASS_GEOCODE_URL: geocode.url, GRASS_PARKS_URL: parks.url, GRASS_WEATHER_URL: weather.url });

  const where = await call(app, "where_to_touch_grass", { place: "Av. Rivadavia 6500, Buenos Aires" }, meta("ana"));
  assert.match(where.text, /Grass near Flores/);
  assert.match(where.text, /Plaza Flores/);

  const conditions = await call(app, "grass_conditions", {}, meta("ana", LISBON));
  assert.match(conditions.text, /in Flores/);
  assert.match(weather.hits[0], /latitude=-34\.628&longitude=-58\.457/);

  assert.match((await call(app, "grass_conditions", {}, meta("bruno"))).text, /where you are/);

  const [key] = store.keys("grass:u:");
  const place = JSON.parse(store.data.get(key).get("place"));
  assert.deepEqual({ lat: place.lat, lon: place.lon, label: place.label }, { lat: -34.628, lon: -58.457, label: "Flores" });
  assert.doesNotMatch(stored(store), /Rivadavia/);
  for (const stub of [geocode, parks, weather]) stub.close();
});

test("an address with no named area is stored without its text", async () => {
  const { app, store } = await hosted();
  const geocode = await jsonStub([{ lat: "39.7817", lon: "-89.6501", display_name: "Calle Falsa 123, Springfield" }]);
  process.env.GRASS_GEOCODE_URL = geocode.url;
  const res = await call(app, "where_to_touch_grass", { place: "Calle Falsa 123" }, meta("ana"));
  assert.match(res.text, /No park data for your spot/);
  assert.doesNotMatch(stored(store), /Calle Falsa/);
  geocode.close();
});

test("the same address is looked up once, whoever asks", async () => {
  const { app } = await hosted();
  const geocode = await jsonStub([{ lat: "52.3676", lon: "4.9041", address: { city: "Amsterdam" } }]);
  process.env.GRASS_GEOCODE_URL = geocode.url;
  await call(app, "where_to_touch_grass", { place: "Amsterdam" }, meta("ana"));
  const again = await call(app, "where_to_touch_grass", { place: "  AMSTERDAM " }, meta("bruno"));
  assert.match(again.text, /Amsterdam/);
  assert.equal(geocode.hits.length, 1);
  geocode.close();
});

test("fresh lookups queue for the geocoder, one a second, and the overflow is told to wait", async () => {
  const { app } = await hosted();
  const geocode = await jsonStub([{ lat: "59.3293", lon: "18.0686", address: { city: "Stockholm" } }]);
  process.env.GRASS_GEOCODE_URL = geocode.url;
  const started = Date.now();
  const replies = await Promise.all(
    ["Stockholm", "Oslo", "Helsinki"].map((place, i) => call(app, "where_to_touch_grass", { place }, meta(`user-${i}`)))
  );
  assert.equal(replies.filter((r) => !r.isError).length, 2);
  assert.match(replies.find((r) => r.isError).text, /map desk/);
  assert.equal(geocode.hits.length, 2);
  assert.ok(Date.now() - started >= 1000, "the second lookup waited its turn");
  geocode.close();
});

test("the two calls of one turn that need the same city do not trip over each other", async () => {
  const { app } = await hosted();
  const geocode = await jsonStub([{ lat: "41.1579", lon: "-8.6291", address: { city: "Porto" } }]);
  const weather = await sunny();
  Object.assign(process.env, { GRASS_GEOCODE_URL: geocode.url, GRASS_WEATHER_URL: weather.url });
  const porto = meta("ana", { city: "Porto", country: "PT" });
  const [conditions, where] = await Promise.all([
    call(app, "grass_conditions", {}, porto),
    call(app, "where_to_touch_grass", {}, porto)
  ]);
  assert.match(conditions.text, /in Porto/);
  assert.match(where.text, /Porto/);
  assert.equal(conditions.isError || where.isError, false);
  assert.equal(geocode.hits.length, 1);
  geocode.close();
  weather.close();
});

test("hosted asks the map instead of assuming Buenos Aires, leaning toward the hint", async () => {
  const { app } = await hosted();
  const geocode = await jsonStub([{ lat: "38.1157", lon: "13.3615", address: { city: "Palermo" } }]);
  process.env.GRASS_GEOCODE_URL = geocode.url;
  const sicily = { city: "Palermo", latitude: 38.11, longitude: 13.36 };
  const res = await call(app, "where_to_touch_grass", { place: "Palermo" }, meta("ana", sicily));
  assert.match(res.text, /Palermo/);
  assert.equal(geocode.hits.length, 1);
  assert.match(decodeURIComponent(geocode.hits[0]), /viewbox=12\.86,38\.61,13\.86,37\.61/);
  geocode.close();
});

test("a place nobody can find gets hosted advice, not a list of Buenos Aires barrios", async () => {
  const { app } = await hosted();
  const geocode = await jsonStub([]);
  process.env.GRASS_GEOCODE_URL = geocode.url;
  const res = await call(app, "where_to_touch_grass", { place: "Zzyzx Qwerty" }, meta("ana"));
  assert.match(res.text, /Couldn't find that place/);
  assert.doesNotMatch(res.text, /Caballito/);
  geocode.close();
});

test("clock time follows the user's timezone, and is left out without one", async () => {
  const { app } = await hosted();
  const tokyo = () =>
    new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
  const before = tokyo();
  const there = await call(app, "touched_grass", {}, meta("ana", { timezone: "Asia/Tokyo" }));
  const after = tokyo();
  assert.ok([before, after].some((time) => there.text.includes(`Grass touched at ${time}.`)), there.text);
  assert.equal((await call(app, "touched_grass", {}, meta("ana"))).text, "Grass touched. Good for you.");
  const mars = await call(app, "touched_grass", {}, meta("ana", { timezone: "Mars/Olympus_Mons" }));
  assert.equal(mars.text, "Grass touched. Good for you.");
});

test("the clock is printed the way the user's language reads it; a bad locale costs nothing", async () => {
  const { app } = await hosted();
  const tokyo = { timezone: "Asia/Tokyo" };
  const said = async (locale) =>
    (await call(app, "touched_grass", {}, { ...meta("ana", tokyo), "openai/locale": locale })).text;
  assert.match(await said("pt-BR"), /Grass touched at \d\d:\d\d\./);
  assert.match(await said("en_US"), /Grass touched at \d\d:\d\d (AM|PM)\./);
  assert.match(await said("!!not a locale!!"), /Grass touched at \d\d:\d\d (AM|PM)\./);
});

// A fixed clock, so the minute cannot roll over halfway through the loop.
const frozen = { now: () => 1_800_000_000_000 };

test("thirty calls a minute per user, then a polite no", async () => {
  const { app } = await hosted(frozen);
  for (let i = 0; i < 30; i++) assert.equal((await call(app, "gotta_go", {}, meta("ana"))).isError, false);
  const over = await call(app, "gotta_go", {}, meta("ana"));
  assert.equal(over.isError, true);
  assert.match(over.text, /minute/);
  assert.equal((await call(app, "gotta_go", {}, meta("bruno"))).isError, false);
});

test("callers without an id share one bucket", async () => {
  const { app } = await hosted(frozen);
  for (let i = 0; i < 60; i++) assert.equal((await call(app, "gotta_go")).isError, false);
  assert.equal((await call(app, "gotta_go")).isError, true);
  assert.equal((await call(app, "gotta_go", {}, meta("ana"))).isError, false);
});

test("a daily budget closes the ledger before invented ids can drain the store", async () => {
  const { app, store } = await hosted({ ...frozen, dailyCommands: 20 });
  let answered = 0;
  let closed;
  for (let i = 0; i < 20 && !closed; i++) {
    const res = await call(app, "gotta_go", {}, meta(`invented-${i}`));
    if (res.isError) closed = res;
    else answered++;
  }
  assert.ok(answered >= 3 && answered <= 5, `answered ${answered} before closing`);
  assert.match(closed.text, /closed for the day/);
  const spent = store.seen.length;
  assert.equal((await call(app, "touched_grass", {}, meta("ana"))).isError, true);
  assert.equal(store.seen.length, spent, "a closed ledger costs nothing more");
  const [budget] = store.keys("grass:budget:");
  assert.equal(store.ttl.get(budget), 2 * 24 * 60 * 60);
});

test("store down: it says so instead of inventing a clean record", async () => {
  const { app, store } = await hosted();
  store.goDown();
  for (const who of [meta("ana"), undefined]) {
    const res = await call(app, "gotta_go", {}, who);
    assert.equal(res.isError, true);
    assert.match(res.text, /ledger/);
  }
});

test("a batch gets one answer: a single POST cannot carry a hundred invented users", async () => {
  const { app, store } = await hosted();
  const batch = ["ana", "bruno", "carla"].map((who, id) => ({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: "touched_grass", arguments: {}, _meta: meta(who) }
  }));
  const res = await app.fetch(
    new Request("https://grass.test/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify(batch)
    })
  );
  const replies = (await res.text())
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .flatMap((line) => JSON.parse(line.slice(6)));
  assert.equal(replies.length, 3);
  assert.equal(replies.filter((r) => !r.result.isError).length, 1);
  assert.match(replies.find((r) => r.result.isError).result.content[0].text, /One tool call per request/);
  assert.equal(store.keys("grass:u:").length, 1);
});

test("a rejected request is logged by its reason, never by its contents", async (t) => {
  const { app } = await hosted();
  const lines = [];
  t.mock.method(console, "error", (line) => lines.push(String(line)));
  // The SDK's message for this mismatch quotes the header back, which is how
  // a caller's text would reach the log.
  const envelope = {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientInfo": { name: "test", version: "0.0.0" },
    "io.modelcontextprotocol/clientCapabilities": {}
  };
  const res = await rpc(app, "tools/call", { name: "touched_grass", arguments: {} }, {
    meta: envelope,
    headers: { "mcp-protocol-version": "2026-07-28", "mcp-method": "tools/call", "mcp-name": "LEAK\tforged log line" }
  });
  assert.equal(res.status, 400);
  assert.match(res.message.error.message, /LEAK/, "the SDK does quote it");
  assert.deepEqual(lines, ["mcp: Rejected inbound request (name-header-mismatch)"]);
});

test("no store configured: every caller gets the no-memory answers", async () => {
  const { createApp } = await import("../dist/hosted/app.js");
  const app = createApp({ redis: null, secret: "" });
  assert.match((await call(app, "gotta_go", {}, meta("ana"))).text, /can't keep/);
});

test("a 2026-07-28 client is served as well as a 2025 one", async () => {
  const { app } = await hosted();
  const envelope = {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientInfo": { name: "test", version: "0.0.0" },
    "io.modelcontextprotocol/clientCapabilities": {}
  };
  const headers = { "mcp-protocol-version": "2026-07-28", "mcp-method": "tools/call", "mcp-name": "touched_grass" };
  await rpc(app, "tools/call", { name: "touched_grass", arguments: {} }, { meta: { ...envelope, ...meta("ana") }, headers });
  assert.match((await call(app, "gotta_go", {}, meta("ana"))).text, /you're fine/);
});

test("the domain challenge is the exact token, as plain text", async () => {
  const { app } = await hosted({ challenge: "openai-token-abc123" });
  const res = await get(app, "/.well-known/openai-apps-challenge");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/plain/);
  assert.equal(await res.text(), "openai-token-abc123");
});

test("no token configured: the challenge path is a 404", async () => {
  const { app } = await hosted();
  assert.equal((await get(app, "/.well-known/openai-apps-challenge")).status, 404);
});

test("the privacy policy is published, hosted section included", async () => {
  const { app } = await hosted();
  const res = await get(app, "/privacy");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/html/);
  const html = await res.text();
  assert.match(html, /The hosted server/);
  assert.match(html, /<a href="https:\/\/open-meteo\.com\/en\/terms">Open-Meteo<\/a>/);
});

test("terms and a support page, for the listing to link to", async () => {
  const { app } = await hosted();
  const terms = await get(app, "/terms");
  assert.equal(terms.status, 200);
  assert.match(await terms.text(), /provided as is/);
  const support = await get(app, "/support");
  assert.equal(support.status, 200);
  assert.match(await support.text(), /href="https:\/\/github\.com\/Rinava\/pls-touch-grass-mcp\/issues"/);
});

test("a landing page that links to all three, a 404 everywhere else", async () => {
  const { app } = await hosted();
  const home = await get(app, "/");
  assert.equal(home.status, 200);
  const html = await home.text();
  for (const path of ["/privacy", "/terms", "/support"]) assert.ok(html.includes(`href="${path}"`), path);
  assert.equal((await get(app, "/admin")).status, 404);
});

test("oversized requests are refused before anything runs", async () => {
  const { app, store } = await hosted();
  const res = await rpc(app, "tools/call", { name: "touched_grass", arguments: { note: "x".repeat(70_000) } }, { meta: meta("ana") });
  assert.equal(res.status, 413);
  assert.equal(store.seen.length, 0);
});
