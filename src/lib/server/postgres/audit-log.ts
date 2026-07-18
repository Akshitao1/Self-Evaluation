import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { pgQuery, withClient } from "@/lib/server/postgres/client";

const JSONL_PATH = path.join(process.cwd(), "audit_log.jsonl");

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS audit_log (
    id              SERIAL PRIMARY KEY,
    cell_id         TEXT NOT NULL,
    action          TEXT NOT NULL,
    request_payload JSONB,
    response_code   INTEGER,
    response_body   TEXT,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retry_count     INTEGER DEFAULT 0,
    error_message   TEXT
);
`;

const INSERT_SQL = `
INSERT INTO audit_log
    (cell_id, action, request_payload, response_code, response_body,
     timestamp, retry_count, error_message)
VALUES
    (%(cell_id)s, %(action)s, %(request_payload)s::jsonb, %(response_code)s,
     %(response_body)s, %(timestamp)s, %(retry_count)s, %(error_message)s);
`;

let tableEnsured = false;

async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  try {
    await withClient(async (client) => {
      await client.query(CREATE_TABLE_SQL);
    });
    tableEnsured = true;
  } catch (err) {
    console.debug("audit_log table creation skipped (DB may be unavailable):", err);
  }
}

export type AuditAction = "CURL_SENT" | "CURL_SUCCESS" | "CURL_FAILED" | "CURL_RETRY" | "CURL_SKIPPED";

export interface AuditEntry {
  cell_id: string;
  action: AuditAction;
  request_payload: Record<string, unknown>;
  response_code?: number | null;
  response_body?: string | null;
  timestamp?: Date;
  retry_count?: number;
  error_message?: string | null;
}

async function writeToDb(entry: Required<Omit<AuditEntry, "response_code" | "response_body" | "error_message">> & {
  response_code: number | null;
  response_body: string | null;
  error_message: string | null;
}): Promise<void> {
  try {
    await pgQuery(INSERT_SQL, {
      cell_id: entry.cell_id,
      action: entry.action,
      request_payload: JSON.stringify(entry.request_payload),
      response_code: entry.response_code,
      response_body: entry.response_body,
      timestamp: entry.timestamp.toISOString(),
      retry_count: entry.retry_count,
      error_message: entry.error_message,
    });
  } catch (err) {
    console.warn("Failed to write audit entry to PostgreSQL:", err);
  }
}

async function writeToJsonl(entry: AuditEntry & { timestamp: Date }): Promise<void> {
  try {
    const serializable = { ...entry, timestamp: entry.timestamp.toISOString() };
    await fs.appendFile(JSONL_PATH, JSON.stringify(serializable) + "\n", "utf-8");
  } catch (err) {
    console.warn("Failed to write audit entry to JSONL:", err);
  }
}

export async function logAction(entry: AuditEntry): Promise<void> {
  const ts = entry.timestamp ?? new Date();
  const fullEntry = {
    cell_id: entry.cell_id,
    action: entry.action,
    request_payload: entry.request_payload,
    response_code: entry.response_code ?? null,
    response_body: entry.response_body ?? null,
    timestamp: ts,
    retry_count: entry.retry_count ?? 0,
    error_message: entry.error_message ?? null,
  };

  if (entry.action === "CURL_SUCCESS") {
    console.log(`audit cell=${entry.cell_id} action=${entry.action} status=${fullEntry.response_code}`);
  } else if (entry.action === "CURL_RETRY") {
    console.warn(
      `audit cell=${entry.cell_id} action=${entry.action} status=${fullEntry.response_code} retry=${fullEntry.retry_count} error=${fullEntry.error_message}`,
    );
  } else if (entry.action === "CURL_FAILED") {
    console.error(
      `audit cell=${entry.cell_id} action=${entry.action} status=${fullEntry.response_code} error=${fullEntry.error_message}`,
    );
  } else {
    console.log(`audit cell=${entry.cell_id} action=${entry.action}`);
  }

  await ensureTable();
  await Promise.all([writeToDb(fullEntry), writeToJsonl(fullEntry)]);
}
