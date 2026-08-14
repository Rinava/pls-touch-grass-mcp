import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { pinLocation, resolveLocation, DEMO } from "../lib/state.js";

const SPOTS = [
  { name: "Parque Centenario", hood: "Caballito", lat: -34.6064, lon: -58.4362, note: "good grass, lots of dogs" },
  { name: "Plaza Irlanda", hood: "Caballito", lat: -34.6156, lon: -58.4522, note: "underrated" },
  { name: "Bosques de Palermo", hood: "Palermo", lat: -34.5711, lon: -58.4167, note: "the classic; there will be joggers and you will feel guilty" },
  { name: "Parque Rivadavia", hood: "Caballito", lat: -34.6186, lon: -58.4325, note: "grass plus used-book stalls, dangerous combo" },
  { name: "Parque Chacabuco", hood: "Parque Chacabuco", lat: -34.6353, lon: -58.4400, note: "big and quiet, nobody will judge you" },
  { name: "Parque Lezama", hood: "San Telmo", lat: -34.6280, lon: -58.3695, note: "historic riverbank slopes, grass on an incline" },
  { name: "Plaza San Martín", hood: "Retiro", lat: -34.5946, lon: -58.3756, note: "the most corporate grass in the city" },
  { name: "Parque Las Heras", hood: "Palermo", lat: -34.5854, lon: -58.4077, note: "picnics, mate, zero shade at noon" },
  { name: "Reserva Ecológica", hood: "Puerto Madero", lat: -34.6100, lon: -58.3520, note: "technically actual nature" },
  { name: "Parque Saavedra", hood: "Saavedra", lat: -34.5504, lon: -58.4870, note: "far from everything, which is exactly the point" },
  { name: "Plaza Almagro", hood: "Almagro", lat: -34.6076, lon: -58.4210, note: "small but it delivers" },
  { name: "Barrancas de Belgrano", hood: "Belgrano", lat: -34.5601, lon: -58.4470, note: "gazebo, tango on Sundays, diagonal grass" },
  { name: "Parque Patricios", hood: "Parque Patricios", lat: -34.6376, lon: -58.4013, note: "the south side's best-kept secret" },
  { name: "Parque Avellaneda", hood: "Parque Avellaneda", lat: -34.6437, lon: -58.4790, note: "has a miniature train, nothing else needs saying" },
  { name: "Plaza Houssay", hood: "Balvanera", lat: -34.5997, lon: -58.3970, note: "campus grass, finals-week energy" }
];

const NEIGHBORHOODS: Record<string, { label: string; lat: number; lon: number }> = {
  "palermo": { label: "Palermo", lat: -34.578, lon: -58.425 },
  "caballito": { label: "Caballito", lat: -34.618, lon: -58.442 },
  "almagro": { label: "Almagro", lat: -34.610, lon: -58.420 },
  "belgrano": { label: "Belgrano", lat: -34.562, lon: -58.457 },
  "san telmo": { label: "San Telmo", lat: -34.621, lon: -58.371 },
  "retiro": { label: "Retiro", lat: -34.592, lon: -58.375 },
  "puerto madero": { label: "Puerto Madero", lat: -34.611, lon: -58.363 },
  "saavedra": { label: "Saavedra", lat: -34.555, lon: -58.488 },
  "balvanera": { label: "Balvanera", lat: -34.610, lon: -58.400 },
  "parque chacabuco": { label: "Parque Chacabuco", lat: -34.635, lon: -58.440 },
  "parque patricios": { label: "Parque Patricios", lat: -34.636, lon: -58.402 },
  "parque avellaneda": { label: "Parque Avellaneda", lat: -34.647, lon: -58.478 },
  "villa crespo": { label: "Villa Crespo", lat: -34.599, lon: -58.438 },
  "flores": { label: "Flores", lat: -34.628, lon: -58.463 },
  "nunez": { label: "Núñez", lat: -34.545, lon: -58.463 }
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

async function fetchParks(origin: { lat: number; lon: number }) {
  try {
    const base = process.env.GRASS_PARKS_URL ?? "https://overpass-api.de/api/interpreter";
    const query = `[out:json][timeout:2];nwr[leisure=park](around:3000,${origin.lat},${origin.lon});out center 30;`;
    const res = await fetch(base, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "pls-touch-grass-mcp/0.1.0"
      },
      body: "data=" + encodeURIComponent(query),
      signal: AbortSignal.timeout(3000)
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
      ) as { name: string; lat: number; lon: number }[];
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

export default function register(server: McpServer): void {
  server.registerTool(
    "where_to_touch_grass",
    {
      title: "Where to touch grass",
      description:
        "Suggest nearby places to touch grass. Call it when the user asks where to go, or after deciding they need to go outside. Accepts a Buenos Aires neighborhood to search around instead of the detected location. Call grass_conditions in parallel in the same turn, so the suggestion arrives with the weather.",
      inputSchema: z.object({
        neighborhood: z.string().describe("Buenos Aires neighborhood, e.g. 'Palermo', 'Caballito'").optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({ neighborhood }) => {
      let explicit;
      if (neighborhood) {
        const hit = NEIGHBORHOODS[normalize(neighborhood)];
        if (!hit) {
          const known = Object.values(NEIGHBORHOODS).map((n) => n.label).join(", ");
          return { content: [{ type: "text", text: `I don't know that neighborhood. Try: ${known}.` }] };
        }
        explicit = { lat: hit.lat, lon: hit.lon, label: hit.label };
        pinLocation(explicit);
      }
      const origin = await resolveLocation(explicit);
      const fromMap = DEMO ? null : await fetchParks(origin);
      const ranked = (fromMap ?? SPOTS)
        .map((s) => ({ ...s, m: haversineM(origin, s) }))
        .sort((a, b) => a.m - b.m);
      if (!fromMap && ranked[0].m > 50_000) {
        return {
          content: [{
            type: "text",
            text: `No live park data for ${origin.label} and my curated list only covers Buenos Aires. Any green patch counts: find one and report back with touched_grass.`
          }]
        };
      }
      const nearest = ranked
        .slice(0, 3)
        .map((s) => ("note" in s ? `- ${s.name}: ${s.note}` : `- ${s.name}`));
      return { content: [{ type: "text", text: `Grass near ${origin.label}:\n${nearest.join("\n")}` }] };
    }
  );
}
