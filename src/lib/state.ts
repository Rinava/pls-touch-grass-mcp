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
