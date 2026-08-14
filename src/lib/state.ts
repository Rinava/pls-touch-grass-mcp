import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface GrassState {
  last_grass: { timestamp: string; note?: string } | null;
  rage_count: number;
  location: { lat: number; lon: number; label: string } | null;
}

const DEFAULTS: GrassState = { last_grass: null, rage_count: 0, location: null };

function statePath(): string {
  return process.env.GRASS_STATE_FILE ?? join(homedir(), ".pls-touch-grass.json");
}

export function readState(): GrassState {
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(statePath(), "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeState(state: GrassState): void {
  try {
    writeFileSync(statePath(), JSON.stringify(state, null, 2));
  } catch {}
}

export function recordGrass(note?: string): GrassState {
  const state = readState();
  state.last_grass = { timestamp: new Date().toISOString(), ...(note ? { note } : {}) };
  state.rage_count = 0;
  writeState(state);
  return state;
}

export function formatElapsed(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.round(mins / 60);
  return `${h} ${h === 1 ? "hour" : "hours"}`;
}

export function minutesSinceGrass(state: GrassState = readState()): number | null {
  if (!state.last_grass) return null;
  return Math.max(0, Math.floor((Date.now() - Date.parse(state.last_grass.timestamp)) / 60000));
}

export const THRESHOLD_MINUTES = 120;

export function bumpRage(): number {
  const state = readState();
  state.rage_count += 1;
  writeState(state);
  return state.rage_count;
}

export const DEMO = process.argv.includes("--demo");

const OBELISCO = { lat: -34.6037, lon: -58.3816, label: "your area (Obelisco)" };
const DEMO_LOCATION = { lat: -34.6037, lon: -58.3816, label: "Buenos Aires" };

export function setLocation(loc: { lat: number; lon: number; label: string }): void {
  const state = readState();
  state.location = loc;
  writeState(state);
}

export async function resolveLocation(explicit?: { lat: number; lon: number; label: string }) {
  if (explicit) return explicit;
  if (DEMO) return DEMO_LOCATION;
  return (await detectOnce()) ?? readState().location ?? OBELISCO;
}

let pending: ReturnType<typeof detectLocation> | null = null;

function detectOnce(): ReturnType<typeof detectLocation> {
  pending ??= detectLocation().then((loc) => {
    if (loc) setLocation(loc);
    else pending = null;
    return loc;
  });
  return pending;
}

async function detectLocation(): Promise<{ lat: number; lon: number; label: string } | null> {
  try {
    const url = process.env.GRASS_GEO_URL ?? "https://ipwho.is/";
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const { latitude, longitude, city } = await res.json();
    if (typeof latitude !== "number" || typeof longitude !== "number") return null;
    return { lat: latitude, lon: longitude, label: typeof city === "string" && city ? city : "your area" };
  } catch {
    return null;
  }
}
