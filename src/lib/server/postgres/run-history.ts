import "server-only";
import { pgQuery, withClient } from "@/lib/server/postgres/client";

export class RunHistoryError extends Error {}

const CREATE_SAVED_CONFIG_SQL = `
CREATE TABLE IF NOT EXISTS dm_saved_config (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label        TEXT NOT NULL,
    client_id    TEXT NOT NULL,
    client_name  TEXT NOT NULL,
    agency_id    TEXT,
    agency_name  TEXT,
    status       TEXT,
    config       JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const CREATE_SAVED_INDEXES_SQL = [
  "CREATE INDEX IF NOT EXISTS idx_saved_config_client_name ON dm_saved_config(client_name, updated_at DESC);",
  "CREATE INDEX IF NOT EXISTS idx_saved_config_client_id ON dm_saved_config(client_id, updated_at DESC);",
];

const CREATE_EXEC_HISTORY_SQL = `
CREATE TABLE IF NOT EXISTS dm_execution_history (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saved_config_id   UUID REFERENCES dm_saved_config(id) ON DELETE SET NULL,
    client_id         TEXT NOT NULL,
    client_name       TEXT NOT NULL,
    agency_id         TEXT,
    agency_name       TEXT,
    status            TEXT,
    config            JSONB NOT NULL,
    summary           JSONB NOT NULL,
    payloads          JSONB,
    executed_by_email TEXT,
    executed_by_name  TEXT,
    executed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

// Idempotent column adds for tables created before these columns existed
// (CREATE TABLE IF NOT EXISTS won't alter an existing table).
const ALTER_EXEC_HISTORY_SQL = [
  "ALTER TABLE dm_execution_history ADD COLUMN IF NOT EXISTS executed_by_email TEXT;",
  "ALTER TABLE dm_execution_history ADD COLUMN IF NOT EXISTS executed_by_name TEXT;",
  "ALTER TABLE dm_execution_history ADD COLUMN IF NOT EXISTS payloads JSONB;",
];

const CREATE_EXEC_INDEXES_SQL = [
  "CREATE INDEX IF NOT EXISTS idx_exec_history_client_name ON dm_execution_history(client_name, executed_at DESC);",
  "CREATE INDEX IF NOT EXISTS idx_exec_history_client_id ON dm_execution_history(client_id, executed_at DESC);",
];

const ENSURE_PGCRYPTO_SQL = 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";';

let tablesEnsured = false;

async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  try {
    await withClient(async (client) => {
      try {
        await client.query(ENSURE_PGCRYPTO_SQL);
      } catch (err) {
        // Postgres 13+ has gen_random_uuid() in core; safe to skip.
        console.debug("pgcrypto extension not created:", err);
      }
      await client.query(CREATE_SAVED_CONFIG_SQL);
      for (const stmt of CREATE_SAVED_INDEXES_SQL) await client.query(stmt);
      await client.query(CREATE_EXEC_HISTORY_SQL);
      for (const stmt of ALTER_EXEC_HISTORY_SQL) await client.query(stmt);
      for (const stmt of CREATE_EXEC_INDEXES_SQL) await client.query(stmt);
    });
    tablesEnsured = true;
    console.log("run_history tables ensured");
  } catch (err) {
    console.warn("Could not ensure run_history tables:", err);
  }
}

function iso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

interface SavedRow {
  id: string;
  label: string;
  client_id: string;
  client_name: string;
  agency_id: string | null;
  agency_name: string | null;
  status: string | null;
  config?: Record<string, unknown>;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

function savedRowOut(r: SavedRow, includeConfig = true): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: String(r.id),
    label: r.label,
    client_id: r.client_id,
    client_name: r.client_name,
    agency_id: r.agency_id,
    agency_name: r.agency_name,
    status: r.status,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  };
  if (includeConfig) out.config = r.config ?? {};
  return out;
}

interface ExecRow {
  id: string;
  saved_config_id: string | null;
  client_id: string;
  client_name: string;
  agency_id: string | null;
  agency_name: string | null;
  status: string | null;
  config?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  payloads?: unknown[] | null;
  executed_by_email: string | null;
  executed_by_name: string | null;
  executed_at: Date | string | null;
}

function execRowOut(r: ExecRow, includeConfig = true): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: String(r.id),
    saved_config_id: r.saved_config_id ? String(r.saved_config_id) : null,
    client_id: r.client_id,
    client_name: r.client_name,
    agency_id: r.agency_id,
    agency_name: r.agency_name,
    status: r.status,
    summary: r.summary ?? {},
    executed_by_email: r.executed_by_email ?? null,
    executed_by_name: r.executed_by_name ?? null,
    executed_at: iso(r.executed_at),
  };
  if (includeConfig) {
    out.config = r.config ?? {};
    out.payloads = r.payloads ?? [];
  }
  return out;
}

// ── Saved-config CRUD ───────────────────────────────────────────────────────

export async function listSavedConfigs(opts: {
  client_id?: string;
  q?: string;
  limit?: number;
}): Promise<Record<string, unknown>[]> {
  await ensureTables();
  const { client_id, q, limit = 100 } = opts;
  const clauses: string[] = [];
  const params: Record<string, unknown> = { limit };
  if (client_id) {
    clauses.push("client_id = %(client_id)s");
    params.client_id = client_id;
  }
  if (q) {
    clauses.push("(client_name ILIKE %(q)s OR label ILIKE %(q)s)");
    params.q = `%${q}%`;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `
SELECT id, label, client_id, client_name, agency_id, agency_name, status, created_at, updated_at
FROM dm_saved_config ${where}
ORDER BY updated_at DESC LIMIT %(limit)s
`;
  try {
    const result = await pgQuery<SavedRow>(sql, params);
    return result.rows.map((r) => savedRowOut(r, false));
  } catch (err) {
    console.warn("list_saved_configs failed:", err);
    throw new RunHistoryError(`Could not load saved configs: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function getSavedConfig(savedId: string): Promise<Record<string, unknown> | null> {
  await ensureTables();
  const sql = `
SELECT id, label, client_id, client_name, agency_id, agency_name, status, config, created_at, updated_at
FROM dm_saved_config WHERE id = %(id)s
`;
  try {
    const result = await pgQuery<SavedRow>(sql, { id: savedId });
    if (result.rowCount === 0) return null;
    return savedRowOut(result.rows[0]);
  } catch (err) {
    console.warn("get_saved_config failed:", err);
    throw new RunHistoryError(`Could not load saved config: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function createSavedConfig(payload: {
  label: string;
  client_id: string;
  client_name: string;
  agency_id?: string | null;
  agency_name?: string | null;
  status?: string | null;
  config: unknown;
}): Promise<Record<string, unknown>> {
  await ensureTables();
  const sql = `
INSERT INTO dm_saved_config
    (label, client_id, client_name, agency_id, agency_name, status, config)
VALUES (%(label)s, %(client_id)s, %(client_name)s, %(agency_id)s, %(agency_name)s, %(status)s, %(config)s::jsonb)
RETURNING id, label, client_id, client_name, agency_id, agency_name, status, config, created_at, updated_at
`;
  try {
    const result = await pgQuery<SavedRow>(sql, {
      label: payload.label,
      client_id: payload.client_id,
      client_name: payload.client_name,
      agency_id: payload.agency_id ?? null,
      agency_name: payload.agency_name ?? null,
      status: payload.status ?? null,
      config: JSON.stringify(payload.config),
    });
    return savedRowOut(result.rows[0]);
  } catch (err) {
    console.warn("create_saved_config failed:", err);
    throw new RunHistoryError(`Could not create saved config: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function updateSavedConfig(
  savedId: string,
  patch: { label?: string; config?: unknown },
): Promise<Record<string, unknown> | null> {
  await ensureTables();
  const sets: string[] = [];
  const params: Record<string, unknown> = { id: savedId };
  if (patch.label !== undefined) {
    sets.push("label = %(label)s");
    params.label = patch.label;
  }
  if (patch.config !== undefined) {
    sets.push("config = %(config)s::jsonb");
    params.config = JSON.stringify(patch.config);
  }
  if (sets.length === 0) {
    return getSavedConfig(savedId);
  }
  sets.push("updated_at = NOW()");
  const sql = `
UPDATE dm_saved_config SET ${sets.join(", ")}
WHERE id = %(id)s
RETURNING id, label, client_id, client_name, agency_id, agency_name, status, config, created_at, updated_at
`;
  try {
    const result = await pgQuery<SavedRow>(sql, params);
    if (result.rowCount === 0) return null;
    return savedRowOut(result.rows[0]);
  } catch (err) {
    console.warn("update_saved_config failed:", err);
    throw new RunHistoryError(`Could not update saved config: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function deleteSavedConfig(savedId: string): Promise<boolean> {
  await ensureTables();
  try {
    const result = await pgQuery("DELETE FROM dm_saved_config WHERE id = %(id)s", { id: savedId });
    return (result.rowCount ?? 0) > 0;
  } catch (err) {
    console.warn("delete_saved_config failed:", err);
    throw new RunHistoryError(`Could not delete saved config: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Execution-history ───────────────────────────────────────────────────────

export async function listExecutions(opts: {
  client_id?: string;
  limit?: number;
}): Promise<Record<string, unknown>[]> {
  await ensureTables();
  const { client_id, limit = 100 } = opts;
  const clauses: string[] = [];
  const params: Record<string, unknown> = { limit };
  if (client_id) {
    clauses.push("client_id = %(client_id)s");
    params.client_id = client_id;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `
SELECT id, saved_config_id, client_id, client_name, agency_id, agency_name, status, summary,
       executed_by_email, executed_by_name, executed_at
FROM dm_execution_history ${where}
ORDER BY executed_at DESC LIMIT %(limit)s
`;
  try {
    const result = await pgQuery<ExecRow>(sql, params);
    return result.rows.map((r) => execRowOut(r, false));
  } catch (err) {
    console.warn("list_executions failed:", err);
    throw new RunHistoryError(`Could not load execution history: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function getExecution(execId: string): Promise<Record<string, unknown> | null> {
  await ensureTables();
  const sql = `
SELECT id, saved_config_id, client_id, client_name, agency_id, agency_name, status, config, summary,
       payloads, executed_by_email, executed_by_name, executed_at
FROM dm_execution_history WHERE id = %(id)s
`;
  try {
    const result = await pgQuery<ExecRow>(sql, { id: execId });
    if (result.rowCount === 0) return null;
    return execRowOut(result.rows[0]);
  } catch (err) {
    console.warn("get_execution failed:", err);
    throw new RunHistoryError(`Could not load execution: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function createExecution(payload: {
  config: unknown;
  summary: unknown;
  payloads?: unknown;
  client_id: string;
  client_name?: string;
  agency_id?: string | null;
  agency_name?: string | null;
  status?: string | null;
  saved_config_id?: string | null;
  executed_by_email?: string | null;
  executed_by_name?: string | null;
}): Promise<{ id: string; executed_at: string | null } | null> {
  await ensureTables();
  const effectiveName = payload.client_name ?? payload.client_id;
  const sql = `
INSERT INTO dm_execution_history
    (saved_config_id, client_id, client_name, agency_id, agency_name, status, config, summary,
     payloads, executed_by_email, executed_by_name)
VALUES (%(saved_config_id)s, %(client_id)s, %(client_name)s, %(agency_id)s, %(agency_name)s, %(status)s, %(config)s::jsonb, %(summary)s::jsonb,
        %(payloads)s::jsonb, %(executed_by_email)s, %(executed_by_name)s)
RETURNING id, executed_at
`;
  try {
    const result = await pgQuery<{ id: string; executed_at: Date | string }>(sql, {
      saved_config_id: payload.saved_config_id ?? null,
      client_id: payload.client_id,
      client_name: effectiveName,
      agency_id: payload.agency_id ?? null,
      agency_name: payload.agency_name ?? null,
      status: payload.status ?? null,
      config: JSON.stringify(payload.config),
      summary: JSON.stringify(payload.summary),
      payloads: payload.payloads === undefined ? null : JSON.stringify(payload.payloads),
      executed_by_email: payload.executed_by_email ?? null,
      executed_by_name: payload.executed_by_name ?? null,
    });
    const row = result.rows[0];
    console.log(`Execution history row created: ${row.id} (client=${payload.client_id})`);
    return { id: String(row.id), executed_at: iso(row.executed_at) };
  } catch (err) {
    console.warn("create_execution failed — continuing without history row:", err);
    return null;
  }
}
