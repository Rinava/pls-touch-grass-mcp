import { readFileSync } from "node:fs";

export const VERSION: string = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
).version;

export const THRESHOLD_MINUTES = 2;

export const OBELISCO = { lat: -34.6037, lon: -58.3816, label: "your area (Obelisco)" };

export const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export const NEIGHBORHOODS: Record<string, { label: string; lat: number; lon: number }> = {
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
