export type Command = (string | number)[];

export interface Redis {
  /** Runs the commands in one round trip and returns one reply per command. */
  run(commands: Command[]): Promise<unknown[]>;
}

export const LEDGER_DOWN = "The grass ledger isn't answering. Try again in a minute.";

/** Upstash's REST API over plain fetch: one POST per pipeline, no client library. */
export function upstash(url: string, token: string): Redis {
  return {
    async run(commands) {
      try {
        const res = await fetch(`${url}/pipeline`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify(commands),
          signal: AbortSignal.timeout(3000)
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const replies = (await res.json()) as { result?: unknown; error?: string }[];
        if (replies.some((reply) => reply.error)) throw new Error("a command was refused");
        return replies.map((reply) => reply.result ?? null);
      } catch (error) {
        console.error(`grass ledger: ${error instanceof Error ? error.message : "unreachable"}`);
        throw new Error(LEDGER_DOWN);
      }
    }
  };
}

export const LEDGER_CLOSED = "The grass ledger is closed for the day: too many visitors. It reopens at midnight UTC.";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Caps how many commands this server may spend per UTC day. The database is
 * free, small and shared, and nothing stops a stranger from inventing user ids
 * to slip past the per-user limit, so the whole server gets a ceiling instead.
 * Once it is hit, this instance stops calling the store until the day turns.
 */
export function budgeted(redis: Redis, perDay: number, now: () => number = Date.now): Redis {
  let closedUntil = 0;
  return {
    async run(commands) {
      if (now() < closedUntil) throw new Error(LEDGER_CLOSED);
      const day = Math.floor(now() / DAY);
      const key = `grass:budget:${day}`;
      const cost = commands.length + 1;
      const replies = await redis.run([...commands, ["INCRBY", key, cost]]);
      const spent = Number(replies.pop());
      if (spent === cost) await redis.run([["EXPIRE", key, 2 * 24 * 60 * 60]]);
      if (spent > perDay) closedUntil = (day + 1) * DAY;
      return replies;
    }
  };
}
