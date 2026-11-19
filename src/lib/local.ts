import { NEIGHBORHOODS } from "./config.js";
import type { GrassEnv } from "./env.js";
import { geocode, normalize } from "./places.js";
import { bumpRage, pinLocation, readState, recordGrass, resolveLocation } from "./state.js";

/** One user, one JSON file, one machine: the stdio server's world. */
export const localEnv: GrassEnv = {
  remembers: true,
  read: async () => readState(),
  recordGrass: async (note) => recordGrass(note).last_grass!.timestamp,
  bumpRage: async () => bumpRage(),
  pinLocation: async (place) => pinLocation(place),
  locate: () => resolveLocation(),
  findPlace: async (name) => {
    const hit = NEIGHBORHOODS[normalize(name)];
    return hit ? { lat: hit.lat, lon: hit.lon, label: hit.label } : geocode(name);
  },
  clock: (at) => at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
};
