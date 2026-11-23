import { readFileSync } from "node:fs";

const REPO = "https://github.com/Rinava/pls-touch-grass-mcp";

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/** Markdown shown as written, with its links and headings made real. Enough for two pages. */
const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ENTITIES[c]);

function page(title: string, markdown: string): string {
  const body = escape(markdown)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>')
    .replace(/^#{1,3} (.+)$/gm, "<strong>$1</strong>");
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escape(title)}</title>
<style>
  body { margin: 0 auto; max-width: 46rem; padding: 2rem 1rem; font: 15px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; }
  pre { margin: 0; font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
  a { color: #2e7d32; }
  @media (prefers-color-scheme: dark) { a { color: #81c784; } }
</style>
<pre>${body}</pre>
</html>
`;
}

export function home(origin: string): string {
  return page(
    "pls touch grass",
    `# pls touch grass

An MCP server that knows how long it's been since you touched grass, and won't
shut up about it. This is the hosted one. Point an MCP client at:

    ${origin}/mcp

## The five tools

- touched_grass          logs that you went outside
- gotta_go               tells you whether you need to go out
- frustration_detector   catches the rage and sends you to a park
- grass_conditions       real weather before it sends you out
- where_to_touch_grass   nearby parks, with distances

## The fine print

- [Privacy policy](/privacy)
- [Terms of service](/terms)
- [Support](/support)
- [Source](${REPO})
- Rather keep it on your own machine? npx -y pls-touch-grass-mcp
`
  );
}

export function support(): string {
  return page(
    "Support: pls touch grass",
    `# Support

Something broken, wrong or unclear? One person runs this, and she reads everything.

- [Open an issue](${REPO}/issues) for bugs, questions and requests. If a tool did
  not fire when it should have, include the exact words you typed.
- [Report a vulnerability privately](${REPO}/security/advisories/new) if it is a
  security problem. Please do not open a public issue for those.

Replies usually arrive within a week.

[Back to the start](/)
`
  );
}

/**
 * PRIVACY.md and TERMS.md are the one copy of each document; the site publishes
 * those files. Null when the file did not ship, and the caller links to the
 * repository's copy instead.
 */
export function legal(file: "PRIVACY.md" | "TERMS.md"): string | null {
  try {
    const markdown = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    return page(`${markdown.match(/^# (.+)$/m)?.[1] ?? file}: pls touch grass`, markdown);
  } catch {
    return null;
  }
}

export const sourceOf = (file: string) => `${REPO}/blob/main/${file}`;
