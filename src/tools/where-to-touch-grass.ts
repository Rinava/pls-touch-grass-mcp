import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { text, type Deps } from "../lib/env.js";
import { NEIGHBORHOODS, OVERPASS_URLS, VERSION } from "../lib/config.js";
import { DEMO, DEMO_SPOTS } from "../lib/demo.js";

type Spot = { name: string; lat: number; lon: number; note?: string };

let parkCache: { key: string; parks: Promise<Spot[] | null>; at: number } | null = null;

async function fetchParks(origin: { lat: number; lon: number }) {
  const key = `${origin.lat.toFixed(2)},${origin.lon.toFixed(2)}`;
  if (parkCache?.key === key && Date.now() - parkCache.at < 600_000) return parkCache.parks;
  const parks = queryParks(origin);
  parkCache = { key, parks, at: Date.now() };
  if (!(await parks)) parkCache = null;
  return parks;
}

async function queryParks(origin: { lat: number; lon: number }) {
  const urls = process.env.GRASS_PARKS_URL?.split(",").filter(Boolean) ?? OVERPASS_URLS;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parks = await askOverpass(urls[attempt % urls.length], origin);
    if (parks) return parks;
  }
  return null;
}

async function askOverpass(base: string, origin: { lat: number; lon: number }) {
  try {
    const query = `[out:json][timeout:4];nwr[leisure=park](around:3000,${origin.lat},${origin.lon});out center 30;`;
    const res = await fetch(base, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": `pls-touch-grass-mcp/${VERSION}`
      },
      body: "data=" + encodeURIComponent(query),
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parks = (data.elements ?? [])
      .map((e: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: { name?: string } }) => ({
        name: e.tags?.name,
        lat: e.lat ?? e.center?.lat,
        lon: e.lon ?? e.center?.lon
      }))
      .filter(
        (p: { name?: string; lat?: number; lon?: number }) =>
          typeof p.name === "string" && typeof p.lat === "number" && typeof p.lon === "number"
      ) as Spot[];
    // An answer with no parks in it is an answer: asking twice more won't grow any.
    return parks;
  } catch {
    return null;
  }
}

function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(m: number): string {
  if (m < 975) return `~${Math.max(50, Math.round(m / 50) * 50)} m`;
  return `~${(m / 1000).toFixed(1)} km`;
}

const LOCAL = {
  description:
    "Suggest nearby places to touch grass. Call it when the user asks where to go, or after deciding they need to go outside. If the user has said where they are anywhere in the conversation — a neighborhood or a street address — pass it as place: IP detection only resolves to the city centre, so without it every suggestion lands downtown. Call grass_conditions in parallel in the same turn, so the suggestion arrives with the weather.",
  place: "Neighborhood or street address, e.g. 'Palermo' or 'Av. Rivadavia 6500, Buenos Aires'",
  notFound: () =>
    `Couldn't find that place. Try a street address, or one of: ${Object.values(NEIGHBORHOODS).map((n) => n.label).join(", ")}.`
};

// Hosted, nobody's IP is looked up and the caller could be anywhere on Earth,
// so the copy stops talking about IPs and about Buenos Aires.
const HOSTED = {
  description:
    "Suggest nearby places to touch grass. Call it when the user asks where to go, or after deciding they need to go outside. If the user has said where they are anywhere in the conversation — a neighborhood, a city or a street address — pass it as place: the location the app shares is city-level at best and sometimes missing, so without it suggestions land downtown or not at all. A place passed here is remembered for that user. Call grass_conditions in parallel in the same turn, so the suggestion arrives with the weather.",
  place: "Neighborhood, city or street address, with the city when you know it, e.g. 'Palermo, Buenos Aires' or 'Av. Rivadavia 6500, Buenos Aires'",
  notFound: () => "Couldn't find that place. Try a street address with its city, or a neighborhood and its city."
};

export default function register(server: McpServer, deps: Deps): void {
  const copy = deps.hosted ? HOSTED : LOCAL;
  server.registerTool(
    "where_to_touch_grass",
    {
      title: "Where to touch grass",
      description: copy.description,
      inputSchema: z.object({ place: z.string().describe(copy.place).optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async ({ place }, ctx) => {
      const env = await deps.env(ctx);
      let explicit;
      if (place) {
        explicit = await env.findPlace(place);
        if (!explicit) return text(copy.notFound());
        await env.pinLocation(explicit);
      }
      const origin = explicit ?? (await env.locate());
      if (!origin) return text("Where are you? Name a neighborhood, a city or a street address and I'll find the grass.");
      const spots: Spot[] | null = DEMO ? DEMO_SPOTS : await fetchParks(origin);
      if (!spots?.length) {
        return text(
          `No park data for ${origin.label} right now. Any green patch counts: find one and report back with touched_grass.`
        );
      }
      const nearest = spots
        .map((s) => ({ ...s, m: haversineM(origin, s) }))
        .sort((a, b) => a.m - b.m)
        .slice(0, 5)
        .map((s) => `- ${s.name} (${formatDistance(s.m)})${s.note ? `: ${s.note}` : ""}`);
      return text(`Grass near ${origin.label}:\n${nearest.join("\n")}`);
    }
  );
}
