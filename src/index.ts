#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import touchedGrass from "./tools/touched-grass.js";

void serveStdio(() => {
  const server = new McpServer({ name: "pls-touch-grass-mcp", version: "0.1.0" });
  touchedGrass(server);
  return server;
});
