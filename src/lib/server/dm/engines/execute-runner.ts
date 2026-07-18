import "server-only";
import pLimit from "p-limit";
import type { Cell, CurlPayload, ExecutionResult, ExecutionSummary } from "@/lib/server/dm/models/cell";
import { buildCurlBody, CTK_COOKIE, curlEndpoint } from "@/lib/curl-format";
import { logAction } from "@/lib/server/postgres/audit-log";

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;
const TIMEOUT_MS = 30_000;
const MAX_CONCURRENCY = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cellId(cell: Cell): string {
  return `${cell.publisher_id}_${cell.event_publisher_date}_${cell.entity_id}`;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function buildPayload(cell: Cell): CurlPayload {
  return {
    entityId: cell.entity_id,
    entityLevel: cell.entity_level,
    publisherId: cell.publisher_id,
    startDate: cell.event_publisher_date,
    endDate: cell.event_publisher_date,
    reason: "dynamic_margin",
    creator: "dynamic_margin",
    markup: cell.markup_new === null ? null : round2(cell.markup_new),
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isNetworkOrTimeout(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof TypeError) return true; // fetch network errors surface as TypeError
  return false;
}

async function sendCurl(
  url: string,
  payload: CurlPayload,
  body: Record<string, unknown>,
  cid: string,
): Promise<ExecutionResult> {
  const headers = { Cookie: CTK_COOKIE, "Content-Type": "application/json" };
  const bodyStr = JSON.stringify(body);
  let retries = 0;

  for (;;) {
    try {
      await logAction({ cell_id: cid, action: "CURL_SENT", request_payload: body, retry_count: retries });
      const resp = await fetchWithTimeout(
        url,
        { method: "POST", headers, body: bodyStr },
        TIMEOUT_MS,
      );
      const text = await resp.text();
      const truncated = text.slice(0, 2000);

      if (resp.status >= 200 && resp.status < 300) {
        const now = new Date();
        await logAction({
          cell_id: cid,
          action: "CURL_SUCCESS",
          request_payload: body,
          response_code: resp.status,
          response_body: truncated,
          timestamp: now,
        });
        return {
          cell_id: cid,
          curl_payload: payload,
          http_status: resp.status,
          response_body: truncated,
          success: true,
          retry_count: retries,
          error_message: null,
          timestamp: now.toISOString(),
        };
      }

      if (resp.status >= 400 && resp.status < 500) {
        const now = new Date();
        const err = `Client error ${resp.status}: ${truncated.slice(0, 200)}`;
        await logAction({
          cell_id: cid,
          action: "CURL_FAILED",
          request_payload: body,
          response_code: resp.status,
          response_body: truncated,
          error_message: err,
          timestamp: now,
        });
        return {
          cell_id: cid,
          curl_payload: payload,
          http_status: resp.status,
          response_body: truncated,
          success: false,
          retry_count: retries,
          error_message: err,
          timestamp: now.toISOString(),
        };
      }

      // 5xx
      retries += 1;
      if (retries > MAX_RETRIES) {
        const now = new Date();
        const err = `Server error ${resp.status} after ${MAX_RETRIES} retries`;
        await logAction({
          cell_id: cid,
          action: "CURL_FAILED",
          request_payload: body,
          response_code: resp.status,
          response_body: truncated,
          retry_count: MAX_RETRIES,
          error_message: err,
          timestamp: now,
        });
        return {
          cell_id: cid,
          curl_payload: payload,
          http_status: resp.status,
          response_body: truncated,
          success: false,
          retry_count: MAX_RETRIES,
          error_message: err,
          timestamp: now.toISOString(),
        };
      }
      const wait = BACKOFF_BASE_MS * 2 ** (retries - 1);
      await logAction({
        cell_id: cid,
        action: "CURL_RETRY",
        request_payload: body,
        response_code: resp.status,
        retry_count: retries,
        error_message: `5xx retry ${retries}/${MAX_RETRIES}, wait ${wait / 1000}s`,
      });
      await sleep(wait);
    } catch (exc) {
      if (!isNetworkOrTimeout(exc)) throw exc;
      retries += 1;
      if (retries > MAX_RETRIES) {
        const now = new Date();
        const err = `WRITE_BACK_FAILED: ${exc instanceof Error ? exc.message : String(exc)}`;
        await logAction({
          cell_id: cid,
          action: "CURL_FAILED",
          request_payload: body,
          retry_count: MAX_RETRIES,
          error_message: err,
          timestamp: now,
        });
        return {
          cell_id: cid,
          curl_payload: payload,
          http_status: null,
          response_body: null,
          success: false,
          retry_count: MAX_RETRIES,
          error_message: err,
          timestamp: now.toISOString(),
        };
      }
      const wait = BACKOFF_BASE_MS * 2 ** (retries - 1);
      await logAction({
        cell_id: cid,
        action: "CURL_RETRY",
        request_payload: body,
        retry_count: retries,
        error_message: `Network error: ${exc instanceof Error ? exc.message : String(exc)}, wait ${wait / 1000}s`,
      });
      await sleep(wait);
    }
  }
}

export async function executeCurls(
  cells: Cell[],
): Promise<ExecutionSummary> {
  const executable = cells.filter((c) => !c.curl_blocked && c.is_writeable);
  const skippedCount = cells.length - executable.length;

  console.log(`execute_curls: ${executable.length} executable, ${skippedCount} skipped, ${cells.length} total`);

  if (executable.length === 0) {
    return {
      total_cells: cells.length,
      cells_written: 0,
      cells_failed: 0,
      cells_skipped: skippedCount,
      results: [],
      run_timestamp: new Date().toISOString(),
    };
  }

  const limit = pLimit(MAX_CONCURRENCY);
  const tasks = executable.map((cell) => {
    const payload = buildPayload(cell);
    const body = buildCurlBody(cell);
    const url = curlEndpoint(null);
    const cid = cellId(cell);
    return limit(() => sendCurl(url, payload, body, cid));
  });
  const results = await Promise.all(tasks);

  const written = results.filter((r) => r.success).length;
  const failed = results.length - written;

  console.log(`execute_curls complete: written=${written} failed=${failed} skipped=${skippedCount}`);

  return {
    total_cells: cells.length,
    cells_written: written,
    cells_failed: failed,
    cells_skipped: skippedCount,
    results,
    run_timestamp: new Date().toISOString(),
  };
}
