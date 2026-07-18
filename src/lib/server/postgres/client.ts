import "server-only";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { getSettings } from "@/lib/server/settings";

let pool: Pool | null = null;
let poolPromise: Promise<Pool> | null = null;

export async function getPool(): Promise<Pool> {
  if (pool) return pool;
  if (poolPromise) return poolPromise;

  poolPromise = (async () => {
    const { postgresUrl } = await getSettings();
    const useSsl = /sslmode=require/.test(postgresUrl) || process.env.PG_SSL === "true";
    const p = new Pool({
      connectionString: postgresUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });
    p.on("error", (err) => console.error("Postgres pool error:", err));
    pool = p;
    poolPromise = null;
    return p;
  })();
  return poolPromise;
}

/**
 * Translates Python-style `%(name)s` placeholders to pg `$N` positional binds.
 * Reused names are deduped — same name → same `$N` placeholder.
 * Also supports positional `%s` (translated in encounter order).
 */
export function translateBinds(
  sql: string,
  params?: Record<string, unknown> | unknown[],
): { text: string; values: unknown[] } {
  if (!params) return { text: sql, values: [] };

  if (Array.isArray(params)) {
    let i = 0;
    const text = sql.replace(/%s/g, () => {
      if (i >= params.length) throw new Error("Not enough positional params for %s");
      i += 1;
      return `$${i}`;
    });
    return { text, values: params.slice(0, i) };
  }

  const values: unknown[] = [];
  const indexMap = new Map<string, number>();
  const text = sql.replace(/%\((\w+)\)s/g, (_match, key: string) => {
    if (!(key in params)) throw new Error(`Missing Postgres bind parameter: ${key}`);
    let idx = indexMap.get(key);
    if (idx === undefined) {
      values.push(params[key]);
      idx = values.length;
      indexMap.set(key, idx);
    }
    return `$${idx}`;
  });
  return { text, values };
}

export async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: Record<string, unknown> | unknown[],
): Promise<QueryResult<T>> {
  const { text, values } = translateBinds(sql, params);
  const p = await getPool();
  return p.query<T>(text, values);
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const p = await getPool();
  const client = await p.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });
}
