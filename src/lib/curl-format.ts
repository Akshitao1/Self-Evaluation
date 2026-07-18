// Pure curl-formatting helpers shared by the server execute-runner (the actual
// outbound request) and the client Execute page (the "formed curl" preview).
// Keep this module free of `server-only` imports so the client can use it.

export type CurlType = "MARKUP" | "MARKDOWN";

/** Minimal shape needed to build a curl — satisfied by both `Cell` and `PreviewRow`. */
export interface CurlSource {
  publisher_id: string;
  entity_id: string;
  entity_level: string;
  event_publisher_date: string;
  curl_type: CurlType | null;
  markup_new: number | null;
}

/** Hardcoded markup-audit base URL — matches the working manual curl. */
export const API_BASE_URL = "https://trk-ingestion-admin-service.prod.joveo.com";

/** Constants stamped on every dynamic-margin markup audit request. */
const CURL_REASON = "dynamic_margin";
const CURL_CREATOR = "dynamic_margin";

/**
 * Hardcoded CTK cookie sent on every markup audit request — matches the working
 * manual curl so the app authenticates exactly like Postman.
 * NOTE: CTK is a session token and will expire; refresh these values when curls
 * start failing with auth errors.
 */
export const CTK_COOKIE =
  "CTK=048daa5b-0785-480a-9029-ad3f81030328; CTK=048daa5b-0785-480a-9029-ad3f81030328; CTK=ad1aed6e-cd39-477d-a31d-d74d7a910fe0";

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * The actual wire body sent to the ingestion service — identical in shape to
 * what `execute-runner` transmits. The markup audit endpoint expects camelCase
 * fields and a per-cell date: each curl targets a single (publisher × date ×
 * entity) cell, so startDate and endDate are both that cell's event date.
 */
export function buildCurlBody(row: CurlSource): Record<string, unknown> {
  return {
    entityId: row.entity_id,
    entityLevel: row.entity_level,
    publisherId: row.publisher_id,
    startDate: row.event_publisher_date,
    endDate: row.event_publisher_date,
    reason: CURL_REASON,
    creator: CURL_CREATOR,
    markup: row.markup_new === null ? null : round2(row.markup_new),
  };
}

/** Full endpoint URL for the markup audit (defaults to the hardcoded API_BASE_URL). */
export function curlEndpoint(_curlType: CurlType | null, base: string = API_BASE_URL): string {
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/api/v1/mark-up/audit`;
}

/**
 * Full `curl` string matching the actual outbound request (same CTK cookie),
 * with only the API host redacted. Intended for the testing/preview UI.
 */
export function formatCurl(row: CurlSource): string {
  const url = curlEndpoint(row.curl_type);
  const body = buildCurlBody(row);
  const json = JSON.stringify(body, null, 2);
  return [
    `curl --location '${url}' \\`,
    `  --header 'Content-Type: application/json' \\`,
    `  --header 'Cookie: ${CTK_COOKIE}' \\`,
    `  --data '${json}'`,
  ].join("\n");
}
