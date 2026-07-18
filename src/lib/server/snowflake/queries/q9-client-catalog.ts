import "server-only";
import { executeQuery } from "@/lib/server/snowflake/client";
import { AGENCIES, CLIENTS } from "@/lib/server/snowflake/table-registry";

export interface ClientCatalogEntry {
  client_id: string;
  client_name: string;
  agency_id: string | null;
  agency_name: string | null;
  status: string | null;
}

const SQL = `
SELECT
    c.id           AS client_id,
    c.name         AS client_name,
    c.agency_id    AS agency_id,
    a.display_name AS agency_name,
    c.status       AS status
FROM ${CLIENTS} c
LEFT JOIN ${AGENCIES} a
    ON a.id = c.agency_id
WHERE c.name ILIKE %(q)s
ORDER BY c.name
LIMIT %(limit)s
`.trim();

const SQL_BY_ID = `
SELECT
    c.id           AS client_id,
    c.name         AS client_name,
    c.agency_id    AS agency_id,
    a.display_name AS agency_name,
    c.status       AS status
FROM ${CLIENTS} c
LEFT JOIN ${AGENCIES} a
    ON a.id = c.agency_id
WHERE c.id = %(id)s
LIMIT 1
`.trim();

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { ts: number; rows: ClientCatalogEntry[] }>();

export async function searchClients(query: string, limit = 20): Promise<ClientCatalogEntry[]> {
  const normalized = (query ?? "").trim();
  if (normalized.length < 2) return [];

  const key = `${normalized.toLowerCase()}::${limit}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.rows;

  const rows = await executeQuery<{
    client_id: string | null;
    client_name: string | null;
    agency_id: string | null;
    agency_name: string | null;
    status: string | null;
  }>(SQL, { q: `%${normalized}%`, limit });

  const result: ClientCatalogEntry[] = rows
    .filter((r) => r.client_id !== null)
    .map((r) => ({
      client_id: String(r.client_id),
      client_name: r.client_name ?? "",
      agency_id: r.agency_id,
      agency_name: r.agency_name,
      status: r.status,
    }));

  cache.set(key, { ts: now, rows: result });
  console.log(`Q9 client catalog: query=${JSON.stringify(normalized)} -> ${result.length} match(es)`);
  return result;
}

export async function getClientById(clientId: string): Promise<ClientCatalogEntry | null> {
  const normalized = (clientId ?? "").trim();
  if (!normalized) return null;

  const key = `id::${normalized}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.rows[0] ?? null;

  const rows = await executeQuery<{
    client_id: string | null;
    client_name: string | null;
    agency_id: string | null;
    agency_name: string | null;
    status: string | null;
  }>(SQL_BY_ID, { id: normalized });

  const result: ClientCatalogEntry[] = rows
    .filter((r) => r.client_id !== null)
    .map((r) => ({
      client_id: String(r.client_id),
      client_name: r.client_name ?? "",
      agency_id: r.agency_id,
      agency_name: r.agency_name,
      status: r.status,
    }));

  cache.set(key, { ts: now, rows: result });
  console.log(`Q9 client by id: id=${JSON.stringify(normalized)} -> ${result.length ? "hit" : "miss"}`);
  return result[0] ?? null;
}
