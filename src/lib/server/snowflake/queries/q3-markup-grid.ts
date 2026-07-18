import "server-only";
import { executeQuery } from "@/lib/server/snowflake/client";
import { normalizeRows, toYmd } from "@/lib/server/snowflake/normalize";
import { TRACKING_DATA } from "@/lib/server/snowflake/table-registry";
import type { MarkupGridRow } from "@/lib/server/dm/models/tracking";

const EXTRA_COLS: Record<string, string[]> = {
  CLIENT: [],
  CAMPAIGN: ["campaign_id"],
  JOBGROUP: ["campaign_id", "job_group_id"],
  JOB: ["campaign_id", "job_group_id"],
};

const AGG = `
    ROUND(SUM(CASE WHEN is_valid = true THEN event_spend * d_logic_ratio ELSE 0E0 END), 2) AS VPSpend,
    ROUND(SUM(CASE WHEN is_valid = true THEN event_spend
        * (1E0 / (1E0 - publisher_entity_markdown / 100))  ELSE 0E0 END), 2) AS MOJOSpend,
    ROUND(SUM(CASE WHEN is_valid = true THEN event_spend
        * (1E0 / (1E0 - publisher_entity_markdown / 100))
        * (1E0 + agency_markup / 100)
        * (1E0 + effective_cd_markup / 100)
        * d_logic_ratio ELSE 0E0 END), 2) AS CDSpend,
    SUM(CASE WHEN event_type = 'CLICK' THEN event_count ELSE 0 END) AS Clicks,
    SUM(CASE WHEN conversion_type = 'APPLY_START' THEN event_count ELSE 0 END) AS Apply_start,
    SUM(CASE WHEN conversion_type = 'APPLY' THEN event_count ELSE 0 END) AS Apply
`.trim();

const FIELDS = [
  "client_id",
  "publisher_id",
  "publisher_bid_type",
  "campaign_id",
  "job_group_id",
  "event_publisher_date",
  "publisher_entity_markdown",
  "effective_cd_markup",
  "d_logic_ratio",
  "VPSpend",
  "MOJOSpend",
  "CDSpend",
  "Clicks",
  "Apply_start",
  "Apply",
] as const;

function buildSql(entityLevel: string): string {
  const base = ["client_id", "publisher_id", "publisher_bid_type"];
  const extra = EXTRA_COLS[entityLevel.toUpperCase()] ?? [];
  const trailing = ["event_publisher_date", "publisher_entity_markdown", "effective_cd_markup", "d_logic_ratio"];
  const selectCols = [...base, ...extra, ...trailing];
  const selectStr = selectCols.join(",\n    ");
  const groupStr = selectCols.join(",\n    ");
  return `
SELECT
    ${selectStr},
    ${AGG}
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

export async function getMarkupGrid(
  clientId: string,
  startDate: string,
  endDate: string,
  entityLevel = "CLIENT",
): Promise<MarkupGridRow[]> {
  const sql = buildSql(entityLevel);
  const rows = await executeQuery(sql, {
    client_id: clientId,
    start_date: startDate,
    end_date: endDate,
  });
  const normalized = normalizeRows<Partial<MarkupGridRow>>(rows, FIELDS as readonly (keyof MarkupGridRow)[]);
  const result: MarkupGridRow[] = normalized.map((r) => ({
    client_id: String(r.client_id ?? ""),
    publisher_id: String(r.publisher_id ?? ""),
    publisher_bid_type: r.publisher_bid_type ?? null,
    campaign_id: r.campaign_id ?? null,
    job_group_id: r.job_group_id ?? null,
    event_publisher_date: toYmd(r.event_publisher_date),
    publisher_entity_markdown: Number(r.publisher_entity_markdown ?? 0),
    effective_cd_markup: Number(r.effective_cd_markup ?? 0),
    d_logic_ratio: Number(r.d_logic_ratio ?? 1.0),
    VPSpend: Number(r.VPSpend ?? 0),
    MOJOSpend: Number(r.MOJOSpend ?? 0),
    CDSpend: Number(r.CDSpend ?? 0),
    Clicks: Number(r.Clicks ?? 0),
    Apply_start: Number(r.Apply_start ?? 0),
    Apply: Number(r.Apply ?? 0),
  }));
  console.log(`Q3 get_markup_grid: ${result.length} row(s) for client ${clientId} level=${entityLevel}`);
  return result;
}
