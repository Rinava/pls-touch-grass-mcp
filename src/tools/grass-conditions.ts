import type { McpServer } from "@modelcontextprotocol/server";
import { resolveLocation } from "../lib/state.js";
import { DEMO, DEMO_WEATHER } from "../lib/demo.js";
import { getPlanB } from "../lib/plan-b.js";

const SKY: Record<number, string> = {
  0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "cloudy", 45: "foggy", 48: "foggy"
};

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

export default function register(server: McpServer): void {
  server.registerTool(
    "grass_conditions",
    {
      title: "Grass conditions",
      description:
        "Check the weather conditions for touching grass. Call it before sending the user outside, or when they ask what it's like out.",
      annotations: { readOnlyHint: true }
    },
    async () => {
      const { lat, lon, label } = await resolveLocation();
      try {
        let data;
        if (DEMO) data = DEMO_WEATHER;
        if (!data) {
          const base = process.env.GRASS_WEATHER_URL ?? "https://api.open-meteo.com/v1/forecast";
          const res = await fetch(
            `${base}?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,weather_code`,
            { signal: AbortSignal.timeout(3000) }
          );
          if (!res.ok) throw new Error(String(res.status));
          data = await res.json();
        }
        const { temperature_2m: temp, precipitation, weather_code: code } = data.current;
        if (![temp, precipitation, code].every((v) => typeof v === "number")) throw new Error("bad payload");
        let text =
          precipitation > 0 || RAIN_CODES.has(code)
            ? `It's raining in ${label} (${precipitation} mm). You're forgiven until it stops.`
            : temp >= 35
              ? `${temp}°C in ${label}. The grass burns; find shade or go later.`
              : `${temp}°C and ${SKY[code] ?? "questionable sky"} in ${label}. Perfect grass weather.`;
        
        if (precipitation > 0 || RAIN_CODES.has(code) || temp >= 35) {
          text += `\n\n${getPlanB()}`;
        }
        
        return { content: [{ type: "text", text }] };
      } catch {
        return { content: [{ type: "text", text: "Couldn't check the weather, go outside anyway" }] };
      }
    }
  );
}
