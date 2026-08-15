import { readFileSync } from "node:fs";

export const VERSION: string = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
).version;

export const DEMO = process.argv.includes("--demo");

export const THRESHOLD_MINUTES = 120;

export const PIN_MINUTES = 30;

export const OBELISCO = { lat: -34.6037, lon: -58.3816, label: "your area (Obelisco)" };

export const DEMO_LOCATION = { lat: -34.6037, lon: -58.3816, label: "Buenos Aires" };
