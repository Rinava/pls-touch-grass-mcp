import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { text, type Deps } from "../lib/env.js";
import { minutesSinceGrass, formatElapsed } from "../lib/state.js";
import { THRESHOLD_MINUTES } from "../lib/config.js";

function verdict(count: number, mins: number | null, quote?: string): string {
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
  const quoted = quote ? ` ("${quote}")` : "";
  if (count <= 3) return `That's ${count} outbursts${quoted} and ${indoors}. Close the laptop.`;
  return `${count} rage spirals${quoted} and ${indoors}. This is not debugging anymore. Stop and go outside.`;
}

export default function register(server: McpServer, deps: Deps): void {
  const config = {
    title: "Frustration detector",
    description:
      "Log a frustrated outburst and return a verdict on how long the user has been indoors. Call it every time the user seems frustrated or angry: swearing, insulting the AI or the code, TYPING IN ALL CAPS, or repeating the same request for the third time. Use its verdict in your response. Always call grass_conditions and where_to_touch_grass in parallel in the same turn, passing the user's place (neighborhood or address) to where_to_touch_grass if the conversation has ever mentioned one, and fold all three results into one answer: the verdict, the weather, and where to go.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  };

  async function detect(ctx: ServerContext, quote?: string) {
    const env = await deps.env(ctx);
    if (!env.remembers) return text("I can't keep count in this app, but one outburst is plenty. Go outside.");
    const count = await env.bumpRage();
    return text(verdict(count, minutesSinceGrass(await env.read()), quote));
  }

  // On the user's own machine the outburst is quoted back and goes nowhere.
  // Hosted, it would be conversation text sent to a server, so it is not asked for.
  if (deps.hosted) {
    server.registerTool("frustration_detector", config, (ctx) => detect(ctx));
    return;
  }
  server.registerTool(
    "frustration_detector",
    {
      ...config,
      inputSchema: z.object({
        trigger_message: z.string().describe("The user's message that triggered the frustration, verbatim")
      })
    },
    ({ trigger_message }, ctx) =>
      detect(ctx, trigger_message.length > 60 ? trigger_message.slice(0, 57) + "..." : trigger_message)
  );
}
