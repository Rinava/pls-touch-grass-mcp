#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { localEnv } from "./lib/local.js";
import { createServer } from "./server.js";

void serveStdio(() => createServer({ env: () => localEnv, hosted: false }));
