import { createServer } from "node:http";
import { createApp } from "../../dist/hosted/app.js";
import { upstash } from "../../dist/hosted/upstash.js";

// A stand-in for Upstash's REST API: the handful of Redis commands the hosted
// server sends, kept in a Map. `seen` records every command, so a test can
// prove what never reached the store.
export function fakeUpstash(token = "test-token") {
  const data = new Map();
  const ttl = new Map();
  const expires = new Map();
  const seen = [];
  const state = { down: false };

  const expireIn = (key, seconds) => {
    ttl.set(key, Number(seconds));
    expires.set(key, Date.now() + Number(seconds) * 1000);
  };
  const hash = (key) => data.get(key) ?? data.set(key, new Map()).get(key);

  function exec([name, key, ...args]) {
    seen.push([name, key, ...args]);
    if (expires.has(key) && expires.get(key) <= Date.now()) {
      data.delete(key);
      expires.delete(key);
    }
    switch (String(name).toUpperCase()) {
      case "HGETALL":
        return [...(data.get(key) ?? new Map())].flat();
      case "HSET":
        for (let i = 0; i < args.length; i += 2) hash(key).set(String(args[i]), String(args[i + 1]));
        return args.length / 2;
      case "HINCRBY": {
        const next = Number(hash(key).get(args[0]) ?? 0) + Number(args[1]);
        hash(key).set(args[0], String(next));
        return next;
      }
      case "INCR":
      case "INCRBY": {
        const next = Number(data.get(key) ?? 0) + Number(args[0] ?? 1);
        data.set(key, String(next));
        return next;
      }
      case "EXPIRE":
        if (!data.has(key)) return 0;
        expireIn(key, args[0]);
        return 1;
      case "GET":
        return data.get(key) ?? null;
      case "SET": {
        const options = args.slice(1).map((a) => String(a).toUpperCase());
        if (options.includes("NX") && data.has(key)) return null;
        data.set(key, String(args[0]));
        if (options.includes("EX")) expireIn(key, options[options.indexOf("EX") + 1]);
        return "OK";
      }
      default:
        throw new Error(`fake upstash does not speak ${name}`);
    }
  }

  const srv = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    res.setHeader("content-type", "application/json");
    if (state.down) {
      res.statusCode = 503;
      return res.end("{}");
    }
    if (req.url !== "/pipeline" || req.headers.authorization !== `Bearer ${token}`) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: "unauthorized" }));
    }
    res.end(JSON.stringify(JSON.parse(body).map((command) => ({ result: exec(command) }))));
  });

  return new Promise((resolve) =>
    srv.listen(0, "127.0.0.1", () => {
      srv.unref();
      resolve({
        url: `http://127.0.0.1:${srv.address().port}`,
        token,
        data,
        ttl,
        seen,
        keys: (prefix) => [...data.keys()].filter((k) => k.startsWith(prefix)),
        goDown: () => (state.down = true),
        close: () => srv.close()
      });
    })
  );
}

export async function hosted(options = {}) {
  const store = await fakeUpstash();
  const app = createApp({ redis: upstash(store.url, store.token), secret: store.token, ...options });
  return { app, store };
}

export function meta(subject, location) {
  return {
    ...(subject ? { "openai/subject": subject } : {}),
    ...(location ? { "openai/userLocation": location } : {})
  };
}

export async function rpc(app, method, params = {}, { meta: _meta, headers = {} } = {}) {
  const res = await app.fetch(
    new Request("https://grass.test/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: _meta ? { ...params, _meta } : params })
    })
  );
  const body = await res.text();
  const framed = body.split("\n").find((line) => line.startsWith("data: "));
  return { status: res.status, message: JSON.parse(framed ? framed.slice(6) : body) };
}

export async function call(app, name, args = {}, _meta) {
  const { message } = await rpc(app, "tools/call", { name, arguments: args }, { meta: _meta });
  return { text: message.result?.content?.[0]?.text ?? "", isError: Boolean(message.result?.isError) };
}

export function get(app, path) {
  return app.fetch(new Request(`https://grass.test${path}`));
}
