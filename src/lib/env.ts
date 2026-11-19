import type { ServerContext } from "@modelcontextprotocol/server";
import type { GrassState } from "./state.js";

export type Place = { lat: number; lon: number; label: string };

/**
 * Whose grass this is and where they are. The stdio server has one user and one
 * file; the hosted server builds one of these per call from what the client sends.
 */
export interface GrassEnv {
  /** False when the client gives no way to tell users apart, so nothing is kept. */
  remembers: boolean;
  read(): Promise<GrassState>;
  /** Logs grass now, resets the outburst count, returns the timestamp. */
  recordGrass(note?: string): Promise<string>;
  bumpRage(): Promise<number>;
  pinLocation(place: Place): Promise<void>;
  /** A place they named, else the best guess, else null: ask, don't invent. */
  locate(): Promise<Place | null>;
  /** Turns a neighborhood or an address into a place. */
  findPlace(name: string): Promise<Place | null>;
  /** Clock time where the user is, or null when nobody knows their timezone. */
  clock(at: Date): string | null;
}

export interface Deps {
  env: (ctx: ServerContext) => GrassEnv | Promise<GrassEnv>;
  /** The public HTTPS server: many users, and nothing leaves a machine they own. */
  hosted: boolean;
}

export const text = (body: string) => ({ content: [{ type: "text" as const, text: body }] });
