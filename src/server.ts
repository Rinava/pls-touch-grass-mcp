import { McpServer } from "@modelcontextprotocol/server";
import { VERSION } from "./lib/config.js";
import type { Deps } from "./lib/env.js";
import touchedGrass from "./tools/touched-grass.js";
import gottaGo from "./tools/gotta-go.js";
import frustrationDetector from "./tools/frustration-detector.js";
import grassConditions from "./tools/grass-conditions.js";
import whereToTouchGrass from "./tools/where-to-touch-grass.js";

/** The five tools, the same over stdio and over HTTP; `deps` says whose grass it is. */
export function createServer(deps: Deps): McpServer {
  const server = new McpServer({ name: "pls-touch-grass-mcp", version: VERSION });
  touchedGrass(server, deps);
  gottaGo(server, deps);
  frustrationDetector(server, deps);
  grassConditions(server, deps);
  whereToTouchGrass(server, deps);
  return server;
}
