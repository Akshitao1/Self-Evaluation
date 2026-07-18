import "server-only";
import { executeQuery } from "@/lib/server/snowflake/client";
import { normalizeRows, toYmd } from "@/lib/server/snowflake/normalize";
import { TRACKING_DATA } from "@/lib/server/snowflake/table-registry";
import type { IndeedRow } from "@/lib/server/dm/models/tracking";

const SQL = `
SELECT
    client_id,
    publisher_name,
    job_ref_number,
    job_id,
    event_publisher_date,
    SUM(CASE WHEN event_type = 'CLICK' THEN event_spend ELSE 0 END) AS Spend,
    SUM(CASE WHEN event_type = 'CLICK' THEN event_count ELSE 0 END) AS Clicks,
    SUM(CASE WHEN conversion_type = 'APPLY_START' THEN event_count ELSE 0 END) AS Apply_start,
    SUM(CASE WHEN conversion_type = 'APPLY' THEN event_count ELSE 0 END) AS Apply,
    SUM(CASE WHEN event_type = 'CLICK' THEN event_spend ELSE 0 END)
        / NULLIF(SUM(CASE WHEN conversion_type = 'APPLY' THEN event_count ELSE 0 END), 0) AS CPA,
    SUM(CASE WHEN event_type = 'CLICK' THEN event_spend ELSE 0 END)
        / NULLIF(SUM(CASE WHEN event_type = 'CLICK' THEN event_count ELSE 0 END), 0) AS CPC
FROM ${TRACKING_DATA}
WHERE client_id       = %(comparison_client_id)s
  AND publisher_name  = %(indeed_publisher_name)s
  AND event_publisher_date BETWEEN %(start_date)s AND %(end_date)s
  AND is_valid = 1
  AND should_contribute_to_joveo_stats = 1
GROUP BY
    client_id,
    publisher_name,
    job_ref_number,
    job_id,
    event_publisher_date
`.trim();

const FIELDS = [
  "client_id",
  "publisher_name",
  "job_ref_number",
  "job_id",
  "event_publisher_date",
  "Spend",
  "Clicks",
  "Apply_start",
  "Apply",
  "CPA",
  "CPC",
] as const;

export async function getIndeedStats(
  comparisonClientId: string,
  indeedPublisherName: string,
  startDate: string,
  endDate: string,
): Promise<IndeedRow[]> {
  const rows = await executeQuery(SQL, {
    comparison_client_id: comparisonClientId,
    indeed_publisher_name: indeedPublisherName,
    start_date: startDate,
    end_date: endDate,
  });
  const normalized = normalizeRows<Partial<IndeedRow>>(rows, FIELDS as readonly (keyof IndeedRow)[]);
  const result: IndeedRow[] = normalized.map((r) => ({
    client_id: String(r.client_id ?? ""),
    publisher_name: String(r.publisher_name ?? ""),
    job_ref_number: r.job_ref_number ?? null,
    job_id: r.job_id ?? null,
    event_publisher_date: toYmd(r.event_publisher_date),
    Spend: Number(r.Spend ?? 0),
    Clicks: Number(r.Clicks ?? 0),
    Apply_start: Number(r.Apply_start ?? 0),
    Apply: Number(r.Apply ?? 0),
    CPA: r.CPA == null ? null : Number(r.CPA),
    CPC: r.CPC == null ? null : Number(r.CPC),
  }));
  console.log(
    `Q5 get_indeed_stats: ${result.length} row(s) for comparison_client=${comparisonClientId} publisher=${indeedPublisherName}`,
  );
  return result;
}
