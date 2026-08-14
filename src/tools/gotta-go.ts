import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { minutesSinceGrass, THRESHOLD_MINUTES, formatElapsed } from "../lib/state.js";

export default function register(server: McpServer): void {
  server.registerTool(
    "gotta_go",
    {
      title: "Do I need to go outside?",
      description:
        "Check whether the user needs to go outside and touch grass. Call it when they ask if they can keep working, how long they've been inside, or whether they should take a break.",
      inputSchema: z.object({
        threshold_minutes: z.number().int().positive()
          .describe("Minutes of indoor time tolerated, if the user wants a stricter or looser regime than the default 120")
          .optional()
      }),
      annotations: { readOnlyHint: true }
    },
    async ({ threshold_minutes }) => {
      const limit = threshold_minutes ?? THRESHOLD_MINUTES;
      const mins = minutesSinceGrass();
      const text =
        mins === null
          ? "No grass on record. Concerning. Go outside, then tell me with touched_grass."
          : mins <= limit
            ? `You touched grass ${formatElapsed(mins)} ago, you're fine. Keep going.`
            : `${formatElapsed(mins)} inside. Go outside NOW.`;
      return { content: [{ type: "text", text }] };
    }
  );
}
