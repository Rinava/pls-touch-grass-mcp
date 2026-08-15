import { spawn } from "node:child_process";

const live = process.argv.includes("--live");
const target = live
  ? { cmd: "npx", args: ["-y", "pls-touch-grass-mcp"], label: "live npm" }
  : { cmd: "node", args: ["dist/index.js"], label: "local build" };

const requests = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "probe", version: "0" }
    }
  },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/list" }
];

const child = spawn(target.cmd, target.args, { stdio: ["pipe", "pipe", "ignore"] });
child.stdin.write(requests.map((r) => JSON.stringify(r) + "\n").join(""));
child.stdin.end();

const timeout = setTimeout(() => {
  console.error("no response after 30s");
  child.kill();
  process.exit(1);
}, 30_000);

const responses = new Map();
let buffer = "";
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (message.id != null) responses.set(message.id, message);
    if (responses.size === 2) report();
  }
});

function report() {
  clearTimeout(timeout);
  child.kill();
  const init = responses.get(1).result;
  const { tools } = responses.get(2).result;
  console.log(`${init.serverInfo.name} ${init.serverInfo.version} (${target.label})`);
  console.log(init.instructions ? `\ninstructions:\n${init.instructions}` : "\ninstructions: MISSING");
  console.log("\ntools:");
  for (const tool of tools) {
    const mark = tool.annotations?.readOnlyHint ? " [read-only]" : "";
    console.log(`- ${tool.name}${mark}`);
  }
  process.exit(init.instructions ? 0 : 1);
}
