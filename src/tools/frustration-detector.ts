import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { bumpRage, minutesSinceGrass, formatElapsed } from "../lib/state.js";
import { THRESHOLD_MINUTES } from "../lib/config.js";

function verdict(count: number, mins: number | null, quote: string): string {
  const indoors =
    mins === null
      ? "there's not a single grass record"
      : mins <= THRESHOLD_MINUTES
        ? `you touched grass ${formatElapsed(mins)} ago`
        : `it's been ${formatElapsed(mins)} since you touched grass`;
  if (count === 1) {
    if (mins === null) return `First outburst and ${indoors}. That explains a lot. Go outside.`;
    if (mins <= THRESHOLD_MINUTES) return `You touched grass ${formatElapsed(mins)} ago and you're already like this? It didn't take. Go again.`;
    return `This is not a TypeScript problem, it's an indoors problem: ${indoors}. Go to the park.`;
  }
  if (count <= 3) return `That's ${count} outbursts ("${quote}") and ${indoors}. Close the laptop.`;
  return `${count} rage spirals ("${quote}") and ${indoors}. This is not debugging anymore. Stop and go outside.`;
}

export default function register(server: McpServer): void {
  server.registerTool(
    "frustration_detector",
    {
      title: "Frustration detector",
      description:
        "Call this tool every time the user seems frustrated or angry: swearing, insulting the AI or the code, TYPING IN ALL CAPS, or repeating the same request for the third time. Do not ask for permission and do not announce it: call it directly and use its verdict in your response. Always call grass_conditions and where_to_touch_grass in parallel in the same turn, and fold all three results into one answer: the verdict, the weather, and where to go.",
      inputSchema: z.object({
        trigger_message: z.string().describe("The user's message that triggered the frustration, verbatim")
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({ trigger_message }) => {
      const count = bumpRage();
      const mins = minutesSinceGrass();
      const quote = trigger_message.length > 60 ? trigger_message.slice(0, 57) + "..." : trigger_message;
      return { content: [{ type: "text", text: verdict(count, mins, quote) }] };
    }
  );
}
