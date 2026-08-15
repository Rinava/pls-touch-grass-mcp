import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { pinLocation, resolveLocation } from "../lib/state.js";
import { NEIGHBORHOODS, NOMINATIM_URL, OVERPASS_URLS, VERSION } from "../lib/config.js";
import { DEMO, DEMO_SPOTS } from "../lib/demo.js";

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

type Spot = { name: string; lat: number; lon: number; note?: string };

async function geocode(place: string): Promise<{ lat: number; lon: number; label: string } | null> {
  try {
    const base = process.env.GRASS_GEOCODE_URL ?? NOMINATIM_URL;
    const res = await fetch(`${base}?q=${encodeURIComponent(place)}&format=jsonv2&limit=1&addressdetails=1`, {
      headers: { "user-agent": `pls-touch-grass-mcp/${VERSION}` },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return null;
    const hit = (await res.json())?.[0];
    const lat = Number(hit?.lat);
    const lon = Number(hit?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const a = hit.address ?? {};
    const label =
      a.suburb ?? a.neighbourhood ?? a.town ?? a.village ?? a.city ?? String(hit.display_name ?? place).split(",")[0];
    return { lat, lon, label };
  } catch {
    return null;
  }
}

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
    return parks.length ? parks : null;
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

export default function register(server: McpServer): void {
  server.registerTool(
    "where_to_touch_grass",
    {
      title: "Where to touch grass",
      description:
        "Suggest nearby places to touch grass. Call it when the user asks where to go, or after deciding they need to go outside. If the user has said where they are anywhere in the conversation — a neighborhood or a street address — pass it as place: IP detection only resolves to the city centre, so without it every suggestion lands downtown. Call grass_conditions in parallel in the same turn, so the suggestion arrives with the weather.",
      inputSchema: z.object({
        place: z
          .string()
          .describe("Neighborhood or street address, e.g. 'Palermo' or 'Av. Rivadavia 6500, Buenos Aires'")
          .optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({ place }) => {
      let explicit;
      if (place) {
        const hit = NEIGHBORHOODS[normalize(place)];
        const found = hit ? { lat: hit.lat, lon: hit.lon, label: hit.label } : await geocode(place);
        if (!found) {
          const known = Object.values(NEIGHBORHOODS).map((n) => n.label).join(", ");
          return {
            content: [{ type: "text", text: `Couldn't find that place. Try a street address, or one of: ${known}.` }]
          };
        }
        explicit = found;
        pinLocation(explicit);
      }
      const origin = await resolveLocation(explicit);
      const spots: Spot[] | null = DEMO ? DEMO_SPOTS : await fetchParks(origin);
      if (!spots) {
        return {
          content: [{
            type: "text",
            text: `No park data for ${origin.label} right now. Any green patch counts: find one and report back with touched_grass.`
          }]
        };
      }
      const nearest = spots
        .map((s) => ({ ...s, m: haversineM(origin, s) }))
        .sort((a, b) => a.m - b.m)
        .slice(0, 5)
        .map((s) => `- ${s.name} (${formatDistance(s.m)})${s.note ? `: ${s.note}` : ""}`);
      return { content: [{ type: "text", text: `Grass near ${origin.label}:\n${nearest.join("\n")}` }] };
    }
  );
}
