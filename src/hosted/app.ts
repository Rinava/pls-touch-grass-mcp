import { createMcpHandler } from "@modelcontextprotocol/server";
import { createServer } from "../server.js";
import { hostedEnv, type Hosting } from "./env.js";
import { home, legal, sourceOf, support } from "./pages.js";
import { budgeted, upstash } from "./upstash.js";

export interface AppOptions extends Hosting {
  /** The token OpenAI's portal hands out to prove the domain is yours. */
  challenge?: string;
}

const reply = (body: string, status = 200, type = "text/plain") =>
  new Response(body, { status, headers: { "content-type": `${type}; charset=utf-8` } });

/**
 * The hosted server as a web-standard fetch handler: the MCP endpoint, the
 * domain challenge, and the pages a directory listing has to link to.
 */
export function createApp(options: AppOptions): { fetch(request: Request): Promise<Response> } {
  // 10,000 a day is about 1,500 tool calls, and at most 300,000 of the free
  // tier's 500,000 commands a month, which this server shares with another site.
  const redis = options.redis && budgeted(options.redis, options.dailyCommands ?? 10_000, options.now);
  const hosting = { ...options, redis };
  const mcp = createMcpHandler(
    () => {
      // A server is built per HTTP request, and an honest client sends one tool
      // call in each. A JSON-RPC batch could pack a hundred into one POST, each
      // with its own invented user, so only the first gets an answer.
      let calls = 0;
      return createServer({
        hosted: true,
        env: (ctx) => {
          if (++calls > 1) throw new Error("One tool call per request. Send the others on their own.");
          return hostedEnv(ctx.mcpReq._meta, hosting);
        }
      });
    },
    {
      // The largest honest request is a sentence or two. The SDK's default is 4 MiB.
      maxRequestBodySize: 64 * 1024,
      // No tool here ever changes, so there is nothing to subscribe to, and an
      // open stream would sit outside every limit above.
      maxSubscriptions: 0,
      // Says why a request was turned away, never what was in it: the SDK's
      // messages quote the request after the first colon.
      onerror: (error) => console.error(`mcp: ${error.message.split(":")[0].replace(/[^\x20-\x7e]/g, "").slice(0, 120)}`)
    }
  );

  return {
    async fetch(request) {
      const { pathname, origin } = new URL(request.url);
      if (pathname === "/mcp") return mcp.fetch(request);
      if (request.method !== "GET" && request.method !== "HEAD") return reply("Method not allowed", 405);
      if (pathname === "/.well-known/openai-apps-challenge" && options.challenge) return reply(options.challenge);
      if (pathname === "/") return reply(home(origin), 200, "text/html");
      if (pathname === "/support") return reply(support(), 200, "text/html");
      if (pathname === "/privacy" || pathname === "/terms") {
        const file = pathname === "/privacy" ? "PRIVACY.md" : "TERMS.md";
        const html = legal(file);
        return html ? reply(html, 200, "text/html") : Response.redirect(sourceOf(file), 302);
      }
      return reply("Nothing here. Go outside.", 404);
    }
  };
}

/**
 * The app as its environment configures it: an Upstash Redis database for
 * memory (either pair of names Upstash and Vercel hand out), and the domain
 * token. Without a database it runs, and remembers nobody.
 */
export function appFromEnv(env: Record<string, string | undefined> = process.env) {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  const remembers = Boolean(url && token);
  const app = createApp({
    redis: remembers ? upstash(url!, token!) : null,
    secret: token ?? "",
    challenge: env.OPENAI_APPS_CHALLENGE
  });
  return { ...app, remembers };
}
