import "server-only";
import { executeQuery } from "@/lib/server/snowflake/client";
import { normalizeRows, toYmd } from "@/lib/server/snowflake/normalize";
import { TRACKING_DATA } from "@/lib/server/snowflake/table-registry";
import type { TrackingRow } from "@/lib/server/dm/models/tracking";

const VALID_LEVELS = new Set(["CLIENT", "CAMPAIGN", "JOBGROUP", "JOB"]);

const EXTRA_COLUMNS: Record<string, string[]> = {
  CLIENT: [],
  CAMPAIGN: ["campaign_id"],
  JOBGROUP: ["campaign_id", "job_group_id"],
  JOB: ["campaign_id", "job_group_id", "job_ref_number", "job_id"],
};

const BASE_COLUMNS = [
  "client_id",
  "publisher_id",
  "publisher_bid_type",
  "publisher_name",
  "event_publisher_date",
];

const AGG_COLUMNS = `
    ROUND(SUM(CASE WHEN is_valid = true THEN event_spend * d_logic_ratio ELSE 0E0 END), 2) AS VPSpend,
    ROUND(SUM(CASE WHEN is_valid = true THEN event_spend
        * (1E0 / (1E0 - publisher_entity_markdown / 100))  ELSE 0E0 END), 2)               AS MOJOSpend,
    ROUND(SUM(CASE WHEN is_valid = true THEN event_spend
        * (1E0 / (1E0 - publisher_entity_markdown / 100))
        * (1E0 + agency_markup / 100)
        * (1E0 + effective_cd_markup / 100)
        * d_logic_ratio ELSE 0E0 END), 2)                                                  AS CDSpend,
    SUM(CASE WHEN event_type = 'CLICK' THEN event_count ELSE 0 END)                        AS Clicks,
    SUM(CASE WHEN conversion_type = 'APPLY_START' THEN event_count ELSE 0 END)             AS Apply_start,
    SUM(CASE WHEN conversion_type = 'APPLY' THEN event_count ELSE 0 END)                   AS Apply
`.trim();

const TRACKING_FIELDS = [
  "client_id",
  "publisher_id",
  "publisher_bid_type",
  "publisher_name",
  "campaign_id",
  "job_group_id",
  "job_ref_number",
  "job_id",
  "event_publisher_date",
  "VPSpend",
  "MOJOSpend",
  "CDSpend",
  "Clicks",
  "Apply_start",
  "Apply",
] as const;

function buildSql(entityLevel: string): string {
  const extra = EXTRA_COLUMNS[entityLevel];
  const selectCols = [...BASE_COLUMNS, ...extra];
  const groupCols = [...selectCols];
  const selectStr = selectCols.join(",\n    ");
  const groupStr = groupCols.join(",\n    ");
  return `
SELECT
    ${selectStr},
    ${AGG_COLUMNS}
FROM ${TRACKING_DATA}
WHERE client_id = %(client_id)s
  AND event_publisher_date BETWEEN %(start_date)s AND %(end_date)s
  AND is_valid = 1
  AND should_contribute_to_joveo_stats = 1
  AND (event_type = 'CLICK' OR conversion_type IN ('APPLY', 'APPLY_START'))
GROUP BY
    ${groupStr}
`.trim();
}

export async function getTrackingData(
  clientId: string,
  startDate: string,
  endDate: string,
  entityLevel: string,
): Promise<TrackingRow[]> {
  const level = entityLevel.toUpperCase();
  if (!VALID_LEVELS.has(level)) {
    throw new Error(`Invalid entity_level ${JSON.stringify(entityLevel)}; expected CLIENT/CAMPAIGN/JOBGROUP/JOB`);
  }

  const sql = buildSql(level);
  const rows = await executeQuery(sql, {
    client_id: clientId,
    start_date: startDate,
    end_date: endDate,
  });
  const normalized = normalizeRows<Partial<TrackingRow>>(rows, TRACKING_FIELDS as readonly (keyof TrackingRow)[]);
  const result: TrackingRow[] = normalized.map((r) => ({
    client_id: String(r.client_id ?? ""),
    publisher_id: String(r.publisher_id ?? ""),
    publisher_bid_type: r.publisher_bid_type ?? null,
    publisher_name: r.publisher_name ?? null,
    campaign_id: r.campaign_id ?? null,
    job_group_id: r.job_group_id ?? null,
    job_ref_number: r.job_ref_number ?? null,
    job_id: r.job_id ?? null,
    event_publisher_date: toYmd(r.event_publisher_date),
    VPSpend: Number(r.VPSpend ?? 0),
    MOJOSpend: Number(r.MOJOSpend ?? 0),
    CDSpend: Number(r.CDSpend ?? 0),
    Clicks: Number(r.Clicks ?? 0),
    Apply_start: Number(r.Apply_start ?? 0),
    Apply: Number(r.Apply ?? 0),
  }));
  console.log(`Q1 returned ${result.length} row(s) for ${clientId} / ${level}`);
  return result;
}
