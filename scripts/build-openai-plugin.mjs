import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

// OpenAI's portal takes the plugin as a ZIP with plugin.json at its root.
// The README is for people reading the repository, so it stays out.
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const out = resolve(`pls-touch-grass-openai-${version}.zip`);

rmSync(out, { force: true });
execFileSync("zip", ["-r", "-X", out, "plugin.json", "mcp.json", "assets", "-x", "*.DS_Store"], {
  cwd: "openai-plugin",
  stdio: "inherit"
});
console.log(out);
