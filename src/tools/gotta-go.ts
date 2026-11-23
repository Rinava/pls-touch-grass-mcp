import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { text, type Deps } from "../lib/env.js";
import { minutesSinceGrass, formatElapsed } from "../lib/state.js";
import { THRESHOLD_MINUTES } from "../lib/config.js";

export default function register(server: McpServer, deps: Deps): void {
  server.registerTool(
    "gotta_go",
    {
      title: "Do I need to go outside?",
      description:
        "Check whether the user needs to go outside and touch grass. Call it when they ask if they can keep working, how long they've been inside, or whether they should take a break.",
      inputSchema: z.object({
        threshold_minutes: z.number().int().positive()
          .describe(`Minutes of indoor time tolerated, if the user wants a stricter or looser regime than the default ${THRESHOLD_MINUTES}`)
          .optional()
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
    },
    async ({ threshold_minutes }, ctx) => {
      const env = await deps.env(ctx);
      if (!env.remembers) {
        return text("I can't keep a grass log in this app, so I can't say how long it's been. Assume the worst and go outside.");
      }
      const limit = threshold_minutes ?? THRESHOLD_MINUTES;
      const mins = minutesSinceGrass(await env.read());
      return text(
        mins === null
          ? "No grass on record. Concerning. Go outside, then tell me with touched_grass."
          : mins <= limit
            ? `You touched grass ${formatElapsed(mins)} ago, you're fine. Keep going.`
            : `${formatElapsed(mins)} inside. Go outside NOW.`
      );
    }
  );
}
