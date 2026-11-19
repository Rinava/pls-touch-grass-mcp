import { createHmac } from "node:crypto";
import { z } from "zod";
import type { GrassEnv, Place } from "../lib/env.js";
import { geocode, normalize } from "../lib/places.js";
import type { GrassState } from "../lib/state.js";
import type { Command, Redis } from "./upstash.js";

export interface Hosting {
  /** Null runs every caller in no-memory mode: fine for a local poke, not for production. */
  redis: Redis | null;
  /** Keys the hash that stands in for a user's id. */
  secret: string;
  /** Store commands this server may spend per UTC day before it closes the ledger. */
  dailyCommands?: number;
  now?: () => number;
}

const THIRTY_DAYS = 30 * 24 * 60 * 60;
const CALLS_PER_MINUTE = 30;
const SHARED_CALLS_PER_MINUTE = 60;

const SLOW_DOWN = "Easy. That's a lot of grass talk for one minute. Ask again shortly.";
const MAP_BUSY = "The map desk is busy. Ask again in a second.";

const PlaceSchema = z.object({ lat: z.number(), lon: z.number(), label: z.string() }).nullable().catch(null);

const parseJson = (value: unknown): unknown => {
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
};

const words = (value: unknown, max = 120): string | null =>
  typeof value === "string" && value.trim() && value.length <= max ? value.trim() : null;

const degrees = (value: unknown, max: number): number | null => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
};

const accepts = (probe: () => unknown): boolean => {
  try {
    probe();
    return true;
  } catch {
    return false;
  }
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// About a hundred metres: close enough to find a park, too coarse to find a door.
const coarse = (place: Place | null): Place | null =>
  place && { ...place, lat: Math.round(place.lat * 1000) / 1000, lon: Math.round(place.lon * 1000) / 1000 };

/**
 * What the client says about the user, per call: `openai/userLocation` and
 * `openai/locale`. Hints only. They may be missing, partial or wrong, and none
 * of it is ever stored.
 */
function readHint(meta: Record<string, unknown>) {
  const shared = meta["openai/userLocation"];
  const loc = (shared && typeof shared === "object" ? shared : {}) as Record<string, unknown>;
  const lat = degrees(loc.latitude, 90);
  const lon = degrees(loc.longitude, 180);
  const city = words(loc.city);
  const region = words(loc.region);
  const here = lat !== null && lon !== null && (lat !== 0 || lon !== 0);
  const zone = words(loc.timezone, 64);
  // Older clients write en_US. Each hint is checked alone, so a bad one cannot sink the other.
  const tag = words(meta["openai/locale"], 35)?.replace(/_/g, "-");
  return {
    point: here ? { lat: lat!, lon: lon!, label: city ?? region ?? "your area" } : null,
    city: city && [...new Set([city, region, words(loc.country)])].filter(Boolean).join(", "),
    timeZone: zone && accepts(() => new Intl.DateTimeFormat("en-US", { timeZone: zone })) ? zone : null,
    locale: tag && accepts(() => new Intl.DateTimeFormat(tag)) ? tag : "en-US"
  };
}

function readState(fields: unknown): GrassState {
  const flat = Array.isArray(fields) ? fields.map(String) : [];
  const hash = new Map<string, string>();
  for (let i = 0; i < flat.length; i += 2) hash.set(flat[i], flat[i + 1]);
  const grass = hash.get("grass");
  return {
    last_grass: grass && !Number.isNaN(Date.parse(grass)) ? { timestamp: grass } : null,
    rage_count: Number(hash.get("rage")) || 0,
    location: PlaceSchema.parse(parseJson(hash.get("place")))
  };
}

/**
 * Builds the environment for one tool call from the request's `_meta`.
 * A user is whoever `openai/subject` says they are; what is stored sits under a
 * keyed hash of that id, never the id itself. No id, no memory.
 */
export async function hostedEnv(
  meta: Record<string, unknown> = {},
  { redis, secret, now = Date.now }: Hosting
): Promise<GrassEnv> {
  const subject = words(meta["openai/subject"], 512);
  const hint = readHint(meta);
  const minute = Math.floor(now() / 60_000);

  async function findPlace(name: string): Promise<Place | null> {
    if (name.length > 200) return null;
    const near = hint.point ?? undefined;
    const lookup = async () => coarse(await geocode(name, { near, coarse: true }));
    if (!redis) return lookup();
    // The same words can mean two towns, so a cached answer belongs to a region.
    // Keyed, so the cache cannot be searched for an address by whoever holds it.
    const region = near ? `${Math.round(near.lat)},${Math.round(near.lon)}` : "";
    const key = `grass:geo:${createHmac("sha256", secret).update(`${normalize(name)}|${region}`).digest("base64url")}`;
    const cached = async () => PlaceSchema.parse(parseJson((await redis.run([["GET", key]]))[0]));
    // Every user reaches the geocoder from this one address; its limit is one a second.
    const free = async () => (await redis.run([["SET", "grass:geo:lock", 1, "EX", 1, "NX"]]))[0] !== null;
    const known = await cached();
    if (known) return known;
    if (!(await free())) {
      // Usually the other call of the same turn, looking up the same place: wait for its answer.
      await pause(1100);
      const answered = await cached();
      if (answered) return answered;
      if (!(await free())) throw new Error(MAP_BUSY);
    }
    const found = await lookup();
    if (found) await redis.run([["SET", key, JSON.stringify(found), "EX", THIRTY_DAYS]]);
    return found;
  }

  const guess = async () => hint.point ?? (hint.city ? findPlace(hint.city) : null);
  const clock = (at: Date) =>
    hint.timeZone
      ? at.toLocaleTimeString(hint.locale, { hour: "2-digit", minute: "2-digit", timeZone: hint.timeZone })
      : null;

  if (!redis || !subject) {
    if (redis) {
      const shared = `grass:rl:shared:${minute}`;
      const [calls] = await redis.run([["INCR", shared], ["EXPIRE", shared, 120]]);
      if (Number(calls) > SHARED_CALLS_PER_MINUTE) throw new Error(SLOW_DOWN);
    }
    return {
      remembers: false,
      read: async () => ({ last_grass: null, rage_count: 0, location: null }),
      recordGrass: async () => new Date().toISOString(),
      bumpRage: async () => 1,
      pinLocation: async () => {},
      locate: guess,
      findPlace,
      clock
    };
  }

  const id = createHmac("sha256", secret).update(subject).digest("base64url");
  const key = `grass:u:${id}`;
  const rate = `grass:rl:${id}:${minute}`;
  const [calls, , fields] = await redis.run([
    ["INCR", rate],
    ["EXPIRE", rate, 120],
    ["HGETALL", key],
    ["EXPIRE", key, THIRTY_DAYS]
  ]);
  if (Number(calls) > CALLS_PER_MINUTE) throw new Error(SLOW_DOWN);
  const state = readState(fields);
  // One field per write, so the parallel calls of a single turn cannot overwrite each other.
  const write = (command: Command) => redis.run([command, ["EXPIRE", key, THIRTY_DAYS]]);

  return {
    remembers: true,
    read: async () => state,
    // The note is echoed in the reply and goes no further.
    recordGrass: async () => {
      const at = new Date().toISOString();
      await write(["HSET", key, "grass", at, "rage", 0]);
      return at;
    },
    bumpRage: async () => Number((await write(["HINCRBY", key, "rage", 1]))[0]),
    pinLocation: async ({ lat, lon, label }) => {
      await write(["HSET", key, "place", JSON.stringify({ lat, lon, label })]);
    },
    locate: async () => state.location ?? guess(),
    findPlace,
    clock
  };
}
