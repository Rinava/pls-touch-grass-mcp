import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { DEMO, DEMO_LOCATION, OBELISCO, PIN_MINUTES } from "./config.js";

export interface GrassState {
  last_grass: { timestamp: string; note?: string } | null;
  rage_count: number;
  location: { lat: number; lon: number; label: string; pinned_at?: string } | null;
}

const DEFAULTS: GrassState = { last_grass: null, rage_count: 0, location: null };

const StateSchema = z.object({
  last_grass: z.object({ timestamp: z.string(), note: z.string().optional() }).nullable().catch(null),
  rage_count: z.number().int().min(0).catch(0),
  location: z
    .object({ lat: z.number(), lon: z.number(), label: z.string(), pinned_at: z.string().optional() })
    .nullable()
    .catch(null)
});

function statePath(): string {
  return process.env.GRASS_STATE_FILE ?? join(homedir(), ".pls-touch-grass.json");
}

export function readState(): GrassState {
  try {
    return StateSchema.parse({ ...DEFAULTS, ...JSON.parse(readFileSync(statePath(), "utf8")) });
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
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} ${h === 1 ? "hour" : "hours"}` : `${h}h ${m}m`;
}

export function minutesSinceGrass(state: GrassState = readState()): number | null {
  if (!state.last_grass) return null;
  return Math.max(0, Math.floor((Date.now() - Date.parse(state.last_grass.timestamp)) / 60000));
}

export function bumpRage(): number {
  const state = readState();
  state.rage_count += 1;
  writeState(state);
  return state.rage_count;
}

export function setLocation(loc: { lat: number; lon: number; label: string; pinned_at?: string }): void {
  const state = readState();
  state.location = loc;
  writeState(state);
}

export function pinLocation(loc: { lat: number; lon: number; label: string }): void {
  setLocation({ ...loc, pinned_at: new Date().toISOString() });
}

function freshPin(loc: GrassState["location"]): boolean {
  return !!loc?.pinned_at && Date.now() - Date.parse(loc.pinned_at) < PIN_MINUTES * 60000;
}

export async function resolveLocation(explicit?: { lat: number; lon: number; label: string }) {
  if (explicit) return explicit;
  if (DEMO) return DEMO_LOCATION;
  const saved = readState().location;
  if (saved && freshPin(saved)) return saved;
  return (await detectOnce()) ?? saved ?? OBELISCO;
}

let pending: ReturnType<typeof detectLocation> | null = null;

function detectOnce(): ReturnType<typeof detectLocation> {
  pending ??= detectLocation().then((loc) => {
    if (loc) {
      if (!freshPin(readState().location)) setLocation(loc);
    } else pending = null;
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
