import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { text, type Deps } from "../lib/env.js";

export default function register(server: McpServer, deps: Deps): void {
  server.registerTool(
    "touched_grass",
    {
      title: "Record grass touched",
      description:
        "Record that the user went outside to touch grass. Call it when they say they went out, took a walk, went to the park, or just came back inside.",
      inputSchema: z.object({
        note: z.string().describe("What they did outside, e.g. 'went to the park'").optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async ({ note }, ctx) => {
      const env = await deps.env(ctx);
      const noted = note ? ` Noted: "${note}".` : "";
      if (!env.remembers) {
        return text(`Good for you.${noted} This app doesn't tell me who you are, so I can't keep your grass log here.`);
      }
      const time = env.clock(new Date(await env.recordGrass(note)));
      return text(`Grass touched${time ? ` at ${time}` : ""}. Good for you.${noted}`);
    }
  );
}
