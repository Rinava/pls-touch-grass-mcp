import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { recordGrass } from "../lib/state.js";

export default function register(server: McpServer): void {
  server.registerTool(
    "touched_grass",
    {
      title: "Record grass touched",
      description:
        "Record that the user went outside to touch grass. Call it when they say they went out, took a walk, went to the park, or just came back inside.",
      inputSchema: z.object({
        note: z.string().describe("What they did outside, e.g. 'went to the park'").optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({ note }) => {
      const state = recordGrass(note);
      const time = new Date(state.last_grass!.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
      const noted = note ? ` Noted: "${note}".` : "";
      return { content: [{ type: "text", text: `Grass touched at ${time}. Good for you.${noted}` }] };
    }
  );
}
