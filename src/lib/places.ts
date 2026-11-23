import { NOMINATIM_URL, VERSION } from "./config.js";
import type { Place } from "./env.js";

export function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

const AREAS = ["suburb", "neighbourhood", "town", "village", "city"];

/**
 * `near` leans the search toward a point without fencing it in. `coarse` keeps
 * the label to a named area, so a typed street address never comes back as one.
 */
export async function geocode(
  place: string,
  { near, coarse = false }: { near?: { lat: number; lon: number }; coarse?: boolean } = {}
): Promise<Place | null> {
  try {
    const base = process.env.GRASS_GEOCODE_URL ?? NOMINATIM_URL;
    const box = near
      ? `&viewbox=${[near.lon - 0.5, near.lat + 0.5, near.lon + 0.5, near.lat - 0.5].map((n) => n.toFixed(2)).join(",")}`
      : "";
    const res = await fetch(`${base}?q=${encodeURIComponent(place)}&format=jsonv2&limit=1&addressdetails=1${box}`, {
      headers: { "user-agent": `pls-touch-grass-mcp/${VERSION}` },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return null;
    const hit = (await res.json())?.[0];
    const lat = Number(hit?.lat);
    const lon = Number(hit?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const a = hit.address ?? {};
    const area = AREAS.map((k) => a[k]).find((v) => typeof v === "string" && v);
    const label = area ?? (coarse ? "your spot" : String(hit.display_name ?? place).split(",")[0]);
    return { lat, lon, label };
  } catch {
    return null;
  }
}
