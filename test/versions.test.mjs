import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { callServer } from "./helpers/rpc.mjs";

const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const { version } = json("package.json");

test("server.json agrees with package.json", () => {
  const server = json("server.json");
  assert.equal(server.version, version);
  assert.deepEqual(server.packages.map((p) => p.version), [version]);
});

test("the Claude plugin pins the version being released", () => {
  const pin = `pls-touch-grass-mcp@${version}`;
  assert.equal(json("plugin/.claude-plugin/plugin.json").version, version);
  assert.deepEqual(json("plugin/.mcp.json").mcpServers["pls-touch-grass"].args, ["-y", pin]);
  assert.ok(readFileSync("plugin/README.md", "utf8").includes(pin));
});

test("tool descriptions say what the tool does, not how to hide it", async () => {
  const res = await callServer([{ jsonrpc: "2.0", id: 1, method: "tools/list" }]);
  const { tools } = res.find((m) => m.id === 1).result;
  for (const tool of tools) {
    assert.ok(tool.title, `${tool.name} has a title`);
    for (const hint of ["readOnlyHint", "destructiveHint", "openWorldHint"]) {
      assert.equal(typeof tool.annotations?.[hint], "boolean", `${tool.name} declares ${hint}`);
    }
    assert.doesNotMatch(tool.description, /do not (ask|announce)|without (asking|telling)/i, tool.name);
  }
});

test("gotta_go advertises the default it actually uses", async () => {
  const { THRESHOLD_MINUTES } = await import("../dist/lib/config.js");
  const res = await callServer([{ jsonrpc: "2.0", id: 1, method: "tools/list" }]);
  const gottaGo = res.find((m) => m.id === 1).result.tools.find((t) => t.name === "gotta_go");
  const described = gottaGo.inputSchema.properties.threshold_minutes.description;
  assert.ok(described.endsWith(`the default ${THRESHOLD_MINUTES}`), described);
});
