import "server-only";
import { executeQuery } from "@/lib/server/snowflake/client";
import { normalizeRows } from "@/lib/server/snowflake/normalize";
import { TRACKING_DATA } from "@/lib/server/snowflake/table-registry";
import { type EntityLevel, inClause } from "@/lib/server/snowflake/queries/q8-entity-name-mapping";
import type { IndeedEntityStats } from "@/lib/server/dm/models/tracking";

const COLUMN_BY_LEVEL: Record<EntityLevel, string> = {
  JOBGROUP: "job_group_id",
  CAMPAIGN: "campaign_id",
};

const FIELDS = [
  "publisher_name",
  "entity_id",
  "CDSpend",
  "Clicks",
  "Apply_start",
  "Apply",
  "client_id",
  "entity_level",
] as const;

export async function getIndeedStatsByEntity(
  comparisonClientId: string,
  indeedPublisherName: string,
  entityLevel: EntityLevel,
  comparisonEntityIds: Iterable<string>,
  startDate: string,
  endDate: string,
): Promise<IndeedEntityStats[]> {
  const ids = [...new Set([...comparisonEntityIds].filter(Boolean))].sort();
  if (ids.length === 0) {
    console.log(`Q5/by-entity: no comparison ${entityLevel.toLowerCase()} ids — skipping`);
    return [];
  }
  const column = COLUMN_BY_LEVEL[entityLevel];
  const { clause, params: idParams } = inClause("cid", ids);

  const sql = `
SELECT
    publisher_name,
    ${column} AS entity_id,
    ROUND(SUM(CASE WHEN is_valid = TRUE THEN event_spend
        * (1E0 / (1E0 - publisher_entity_markdown / 100))
        * (1E0 + agency_markup / 100)
        * (1E0 + effective_cd_markup / 100)
        * d_logic_ratio ELSE 0E0 END), 2) AS CDSpend,
    SUM(CASE WHEN event_type = 'CLICK' THEN event_count ELSE 0 END) AS Clicks,
    SUM(CASE WHEN conversion_type = 'APPLY_START' THEN event_count ELSE 0 END) AS Apply_start,
    SUM(CASE WHEN conversion_type = 'APPLY' THEN event_count ELSE 0 END) AS Apply
FROM ${TRACKING_DATA}
WHERE client_id = %(comparison_client_id)s
  AND ${column} IN ${clause}
  AND publisher_name = %(indeed_publisher_name)s
  AND event_publisher_date BETWEEN %(start_date)s AND %(end_date)s
  AND is_valid = 1
  AND should_contribute_to_joveo_stats = 1
  AND (event_type = 'CLICK' OR conversion_type IN ('APPLY', 'APPLY_START'))
GROUP BY publisher_name, ${column}
`.trim();

  const params: Record<string, unknown> = {
    comparison_client_id: comparisonClientId,
    indeed_publisher_name: indeedPublisherName,
    start_date: startDate,
    end_date: endDate,
    ...idParams,
  };

  const rows = await executeQuery(sql, params);
  const augmented = rows.map((r) => ({ ...r, client_id: comparisonClientId, entity_level: entityLevel }));
  const normalized = normalizeRows<Partial<IndeedEntityStats>>(
    augmented,
    FIELDS as readonly (keyof IndeedEntityStats)[],
  );
  const result: IndeedEntityStats[] = normalized.map((r) => ({
    client_id: String(r.client_id ?? comparisonClientId),
    publisher_name: String(r.publisher_name ?? ""),
    entity_level: (r.entity_level as IndeedEntityStats["entity_level"]) ?? entityLevel,
    entity_id: String(r.entity_id ?? ""),
    CDSpend: Number(r.CDSpend ?? 0),
    Clicks: Number(r.Clicks ?? 0),
    Apply_start: Number(r.Apply_start ?? 0),
    Apply: Number(r.Apply ?? 0),
  }));
  console.log(`Q5/by-entity: ${result.length} row(s) for comparison_client=${comparisonClientId} level=${entityLevel}`);
  return result;
}
