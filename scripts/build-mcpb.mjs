import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const stage = ".mcpb-build";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

const manifest = {
  manifest_version: "0.3",
  name: pkg.name,
  display_name: "pls touch grass",
  version: pkg.version,
  description: pkg.description,
  long_description:
    "You log when you go outside, it warns you when you've been inside too long, it detects when you're raging at your AI and sends you to the nearest park, weather checked first. Five tools, shared state, and descriptions that make the model call them on its own.",
  author: { name: pkg.author },
  repository: { type: "git", url: pkg.repository.url.replace(/^git\+/, "").replace(/\.git$/, "") },
  homepage: pkg.homepage,
  documentation: pkg.homepage,
  support: pkg.bugs.url,
  license: pkg.license,
  keywords: pkg.keywords,
  server: {
    type: "node",
    entry_point: "dist/index.js",
    mcp_config: { command: "node", args: ["${__dirname}/dist/index.js"] }
  },
  tools: [
    { name: "touched_grass", description: "Logs that you went outside" },
    { name: "gotta_go", description: "Tells you whether you need to go out" },
    { name: "frustration_detector", description: "Catches the rage and escalates" },
    { name: "grass_conditions", description: "Real weather before it sends you out" },
    { name: "where_to_touch_grass", description: "Nearby parks, curated spots offline" }
  ],
  compatibility: {
    platforms: ["darwin", "win32", "linux"],
    runtimes: { node: pkg.engines.node }
  }
};

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage);
for (const file of ["package.json", "package-lock.json"]) cpSync(file, `${stage}/${file}`);
cpSync("dist", `${stage}/dist`, { recursive: true });
writeFileSync(`${stage}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
run("npm", ["ci", "--omit=dev", "--ignore-scripts", "--prefix", stage]);
rmSync(`${stage}/package-lock.json`);
run("npx", ["-y", "@anthropic-ai/mcpb", "pack", stage, `${pkg.name}-${pkg.version}.mcpb`]);
rmSync(stage, { recursive: true, force: true });
