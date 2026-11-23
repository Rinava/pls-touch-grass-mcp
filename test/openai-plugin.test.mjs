import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { hosted, rpc } from "./helpers/hosted.mjs";

// The limits below are OpenAI's, from developers.openai.com/plugins/deploy/submission
// as read on 2026-11-18. A manifest that breaks one uploads fine and fails review.
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const plugin = json("openai-plugin/plugin.json");
const openai = plugin.extensions["com.openai"];
const [[, server], ...otherServers] = Object.entries(json("openai-plugin/mcp.json").mcpServers);

test("the OpenAI plugin carries the version being released", () => {
  assert.equal(plugin.version, json("package.json").version);
});

test("its name follows the directory's rules", () => {
  assert.match(plugin.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.ok(plugin.name.length <= 64);
  assert.doesNotMatch(`${plugin.name} ${openai.interface.displayName}`, /\b(mcp|plugin|server)\b/i);
});

test("listing copy fits the limits", () => {
  const ui = openai.interface;
  assert.ok(ui.displayName.length <= 30, "displayName");
  assert.ok(ui.shortDescription.length <= 30, "shortDescription");
  assert.ok(ui.longDescription.length <= 4000, "longDescription");
  assert.ok(ui.developerName.length <= 80, "developerName");
  assert.ok(ui.category);
  assert.ok(ui.capabilities.length <= 20 && ui.capabilities.every((c) => c.length <= 120));
  assert.ok(ui.defaultPrompt.length <= 3 && ui.defaultPrompt.every((p) => p.length <= 128 && !p.includes("@")));
  assert.equal(new Set(ui.defaultPrompt).size, ui.defaultPrompt.length);
  for (const color of [ui.brandColor, ui.brandColorDark]) assert.match(color, /^#[0-9A-F]{6}$/i);
  assert.doesNotMatch(ui.longDescription + ui.shortDescription, /free trial|discount|subscription|\$\d/i);
});

test("one remote server, no auth, and every listing URL lives on its host", () => {
  assert.deepEqual(otherServers, []);
  assert.equal(server.type, "streamable-http");
  assert.deepEqual(server.extensions["com.openai"].auth, { type: "none" });
  const { protocol, host, pathname } = new URL(server.url);
  assert.equal(protocol, "https:");
  assert.equal(pathname, "/mcp");
  const ui = openai.interface;
  for (const field of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) {
    assert.equal(new URL(ui[field]).host, host, field);
    assert.ok(ui[field].length <= 1024, field);
  }
});

test("the pages the listing links to are pages the server serves", async () => {
  const { app } = await hosted();
  const ui = openai.interface;
  for (const field of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) {
    const res = await app.fetch(new Request(ui[field]));
    assert.equal(res.status, 200, field);
  }
});

test("icons exist, are square SVGs, and stay under the size limit", () => {
  const ui = openai.interface;
  for (const field of ["logo", "composerIcon"]) {
    assert.match(ui[field], /^\.\/assets\//, field);
    const file = `openai-plugin/${ui[field].slice(2)}`;
    assert.ok(existsSync(file), file);
    assert.ok(statSync(file).size <= 5 * 1024 * 1024, file);
    const [, w, h] = readFileSync(file, "utf8").match(/viewBox="0 0 (\d+) (\d+)"/);
    assert.ok(w === h && Number(w) >= 48, `${file} is square and at least 48`);
  }
});

test("five positive and three negative review cases, naming tools that exist", async () => {
  const { positive, negative } = openai.review.test_cases;
  assert.equal(positive.length, 5);
  assert.equal(negative.length, 3);
  const { app } = await hosted();
  const { message } = await rpc(app, "tools/list");
  const tools = new Set(message.result.tools.map((t) => t.name));
  const used = new Set();
  for (const c of positive) {
    assert.ok(c.description && c.prompt && c.expected_behavior, c.description);
    for (const name of c.tools_triggered.split(", ")) {
      assert.ok(tools.has(name), `${name} is a tool`);
      used.add(name);
    }
  }
  assert.deepEqual([...used].sort(), [...tools].sort(), "every tool appears in a positive case");
  for (const c of negative) assert.ok(c.description && c.prompt && !c.tools_triggered, c.description);
});

test("nothing in the package blocks public submission or leaks a secret", () => {
  assert.equal(openai.apps, undefined);
  assert.equal(openai.hooks, undefined);
  assert.equal(openai.review.test_credentials, undefined);
  assert.equal(openai.review.reviewer_instructions, undefined);
  assert.equal(server.headers, undefined);
  assert.doesNotMatch(JSON.stringify([plugin, server]), /token|secret|password|bearer/i);
});
