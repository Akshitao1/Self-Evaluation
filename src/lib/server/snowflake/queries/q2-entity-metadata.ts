import "server-only";
import { executeQuery } from "@/lib/server/snowflake/client";
import { normalizeRows } from "@/lib/server/snowflake/normalize";
import {
  CAMPAIGNS,
  CAMPAIGN_MANAGEMENT_JOBGROUP_CAPS,
  CAMPAIGN_MANAGEMENT_JOB_CAPS,
  CLIENTS,
  JOB_GROUPS,
  TRACKING_DATA,
} from "@/lib/server/snowflake/table-registry";
import type { EntityMetadata, PublisherMetadata } from "@/lib/server/dm/models/tracking";

const ENTITY_FIELDS = [
  "entity_id",
  "entity_level",
  "entity_name",
  "agency_id",
  "effective_budget",
  "budget_threshold_percent",
  "pacing_pct",
  "cpa_goal",
  "cpc_goal",
  "cpas_goal",
  "primary_goal_type",
  "primary_goal_value",
  "budget_cap_frequency",
  "status",
] as const;

const PUBLISHER_FIELDS = ["publisher_id", "publisher_name", "publisher_bid_type"] as const;

function emptyEntity(level: EntityMetadata["entity_level"], partial: Partial<EntityMetadata>): EntityMetadata {
  return {
    entity_id: "",
    entity_level: level,
    entity_name: null,
    agency_id: null,
    effective_budget: null,
    budget_threshold_percent: null,
    pacing_pct: null,
    cpa_goal: null,
    cpc_goal: null,
    cpas_goal: null,
    primary_goal_type: null,
    primary_goal_value: null,
    budget_cap_frequency: null,
    status: null,
    ...partial,
  };
}

function toEntityRows(rows: Record<string, unknown>[], level: EntityMetadata["entity_level"]): EntityMetadata[] {
  const normalized = normalizeRows<Partial<EntityMetadata>>(rows, ENTITY_FIELDS as readonly (keyof EntityMetadata)[]);
  return normalized.map((r) => emptyEntity(level, r));
}

export async function getClientMetadata(clientId: string): Promise<EntityMetadata[]> {
  const sql = `
SELECT
    id               AS entity_id,
    budget_value     AS effective_budget,
    budget_threshold_percent,
    status,
    cpa_target       AS cpa_goal,
    primary_goal_type,
    primary_goal_value
FROM ${CLIENTS}
WHERE id = %(client_id)s
`.trim();
  const rows = await executeQuery(sql, { client_id: clientId });
  const result = toEntityRows(rows, "CLIENT");
  console.log(`Q2a get_client_metadata: ${result.length} row(s) for client ${clientId}`);
  return result;
}

export async function getCampaignMetadata(
  clientId: string,
  startDate?: string,
  endDate?: string,
): Promise<EntityMetadata[]> {
  const params: Record<string, unknown> = { client_id: clientId };
  let dateSubquery = "";
  if (startDate && endDate) {
    dateSubquery = `
  AND id IN (
      SELECT DISTINCT campaign_id
      FROM ${TRACKING_DATA}
      WHERE client_id = %(client_id)s
        AND event_publisher_date BETWEEN %(start_date)s AND %(end_date)s
        AND campaign_id IS NOT NULL
        AND is_valid = 1
        AND should_contribute_to_joveo_stats = 1
  )`;
    params.start_date = startDate;
    params.end_date = endDate;
  }

  const sql = `
SELECT
    id               AS entity_id,
    name             AS entity_name,
    budget_value     AS effective_budget,
    budget_threshold_percent,
    status,
    cpa_target       AS cpa_goal
FROM ${CAMPAIGNS}
WHERE client_id = %(client_id)s${dateSubquery}
`.trim();
  const rows = await executeQuery(sql, params);
  const result = toEntityRows(rows, "CAMPAIGN");
  console.log(`Q2a get_campaign_metadata: ${result.length} row(s) for client ${clientId}`);
  return result;
}

export async function getJobgroupMetadata(
  clientId: string,
  startDate?: string,
  endDate?: string,
): Promise<EntityMetadata[]> {
  const params: Record<string, unknown> = { client_id: clientId };
  let dateSubquery = "";
  if (startDate && endDate) {
    dateSubquery = `
  AND id IN (
      SELECT DISTINCT job_group_id
      FROM ${TRACKING_DATA}
      WHERE client_id = %(client_id)s
        AND event_publisher_date BETWEEN %(start_date)s AND %(end_date)s
        AND job_group_id IS NOT NULL
        AND is_valid = 1
        AND should_contribute_to_joveo_stats = 1
  )`;
    params.start_date = startDate;
    params.end_date = endDate;
  }

  const sql = `
SELECT
    id               AS entity_id,
    name             AS entity_name,
    cpa_target       AS cpa_goal,
    cpc_target       AS cpc_goal,
    primary_goal_type,
    primary_goal_value
FROM ${JOB_GROUPS}
WHERE client_id = %(client_id)s${dateSubquery}
`.trim();
  const rows = await executeQuery(sql, params);
  const result = toEntityRows(rows, "JOBGROUP");
  console.log(`Q2a get_jobgroup_metadata: ${result.length} row(s) for client ${clientId}`);
  return result;
}

export async function getJobgroupBudget(
  clientId: string,
  startDate?: string,
  endDate?: string,
): Promise<EntityMetadata[]> {
  const params: Record<string, unknown> = { client_id: clientId };
  let dateSubquery = "";
  if (startDate && endDate) {
    dateSubquery = `
  AND jobgroup_id IN (
      SELECT DISTINCT job_group_id
      FROM ${TRACKING_DATA}
      WHERE client_id = %(client_id)s
        AND event_publisher_date BETWEEN %(start_date)s AND %(end_date)s
        AND job_group_id IS NOT NULL
        AND is_valid = 1
        AND should_contribute_to_joveo_stats = 1
  )`;
    params.start_date = startDate;
    params.end_date = endDate;
  }

  const sql = `
SELECT
    jobgroup_id      AS entity_id,
    value            AS effective_budget,
    threshold_percent AS budget_threshold_percent,
    cap_frequency    AS budget_cap_frequency
FROM ${CAMPAIGN_MANAGEMENT_JOBGROUP_CAPS}
WHERE client_id = %(client_id)s
  AND cap_type = 'BUDGET'
  AND entity_type = 'JOBGROUPS'${dateSubquery}
`.trim();
  const rows = await executeQuery(sql, params);
  const result = toEntityRows(rows, "JOBGROUP");
  console.log(`Q2a get_jobgroup_budget: ${result.length} row(s) for client ${clientId}`);
  return result;
}

export async function getJobBudget(
  clientId: string,
  startDate?: string,
  endDate?: string,
): Promise<EntityMetadata[]> {
  const params: Record<string, unknown> = { client_id: clientId };
  let dateSubquery = "";
  if (startDate && endDate) {
    dateSubquery = `
  AND jobgroup_id IN (
      SELECT DISTINCT job_group_id
      FROM ${TRACKING_DATA}
      WHERE client_id = %(client_id)s
        AND event_publisher_date BETWEEN %(start_date)s AND %(end_date)s
        AND job_group_id IS NOT NULL
        AND is_valid = 1
        AND should_contribute_to_joveo_stats = 1
  )`;
    params.start_date = startDate;
    params.end_date = endDate;
  }

  const sql = `
SELECT
    jobgroup_id      AS entity_id,
    value            AS effective_budget,
    threshold_percent AS budget_threshold_percent,
    cap_frequency    AS budget_cap_frequency
FROM ${CAMPAIGN_MANAGEMENT_JOB_CAPS}
WHERE client_id = %(client_id)s
  AND cap_type = 'BUDGET'
  AND entity_type = 'JOBS'${dateSubquery}
`.trim();
  const rows = await executeQuery(sql, params);
  const result = toEntityRows(rows, "JOB");
  console.log(`Q2a get_job_budget: ${result.length} row(s) for client ${clientId}`);
  return result;
}

export async function getJobLifetimeSpend(clientId: string): Promise<Record<string, number>> {
  const sql = `
SELECT
    job_group_id                       AS entity_id,
    ROUND(SUM(CASE WHEN is_valid = true THEN event_spend
        * (1E0 / (1E0 - publisher_entity_markdown / 100))
        * (1E0 + agency_markup / 100)
        * (1E0 + effective_cd_markup / 100)
        * d_logic_ratio ELSE 0E0 END), 2) AS total_cdspend
FROM ${TRACKING_DATA}
WHERE client_id = %(client_id)s
  AND YEAR(event_publisher_date) >= YEAR(CURRENT_DATE) - 1
  AND is_valid = 1
  AND should_contribute_to_joveo_stats = 1
GROUP BY job_group_id
`.trim();
  const rows = await executeQuery<{ entity_id: string; total_cdspend: number | null }>(sql, { client_id: clientId });
  const result: Record<string, number> = {};
  for (const r of rows) result[r.entity_id] = Number(r.total_cdspend ?? 0);
  console.log(`get_job_lifetime_spend: ${Object.keys(result).length} group(s) for client ${clientId}`);
  return result;
}

export async function getMainClientId(jaxClientId: string, startDate: string): Promise<string | null> {
  const sql = `
SELECT client_id
FROM ${JOB_GROUPS}
WHERE id IN (
    SELECT DISTINCT dbg_self_serve_job_group_id
    FROM ${TRACKING_DATA}
    WHERE client_id = %(jax_client_id)s
      AND event_publisher_date >= %(start_date)s
)
GROUP BY client_id
`.trim();
  const rows = await executeQuery<{ client_id: string }>(sql, {
    jax_client_id: jaxClientId,
    start_date: startDate,
  });
  if (rows.length === 0) {
    console.warn(`get_main_client_id: no parent found for JAX client ${jaxClientId}`);
    return null;
  }
  const mainId = rows[0].client_id;
  console.log(`get_main_client_id: JAX ${jaxClientId} → main ${mainId} (${rows.length} row(s))`);
  return mainId;
}

export async function getNonJaxSpend(
  mainClientId: string,
  startDate: string,
  endDate: string,
): Promise<Record<string, number>> {
  const sql = `
SELECT
    job_group_id                       AS entity_id,
    ROUND(SUM(CASE WHEN is_valid = true THEN event_spend
        * (1E0 / (1E0 - publisher_entity_markdown / 100))
        * (1E0 + agency_markup / 100)
        * (1E0 + effective_cd_markup / 100)
        * d_logic_ratio ELSE 0E0 END), 2) AS non_jax_spend
FROM ${TRACKING_DATA}
WHERE client_id = %(main_client_id)s
  AND UPPER(publisher_name) NOT LIKE '%%JAX%%'
  AND event_publisher_date BETWEEN %(start_date)s AND %(end_date)s
  AND is_valid = 1
  AND should_contribute_to_joveo_stats = 1
GROUP BY job_group_id
`.trim();
  const rows = await executeQuery<{ entity_id: string; non_jax_spend: number | null }>(sql, {
    main_client_id: mainClientId,
    start_date: startDate,
    end_date: endDate,
  });
  const result: Record<string, number> = {};
  for (const r of rows) result[r.entity_id] = Number(r.non_jax_spend ?? 0);
  console.log(`get_non_jax_spend: ${Object.keys(result).length} group(s) for main client ${mainClientId}`);
  return result;
}

export async function getPublisherMetadata(
  clientId: string,
  startDate?: string,
  endDate?: string,
): Promise<PublisherMetadata[]> {
  const params: Record<string, unknown> = { client_id: clientId };
  let dateClause = "";
  if (startDate && endDate) {
    dateClause = "  AND event_publisher_date BETWEEN %(start_date)s AND %(end_date)s\n";
    params.start_date = startDate;
    params.end_date = endDate;
  }
  const sql = `
SELECT DISTINCT
    publisher_id,
    publisher_name,
    publisher_bid_type
FROM ${TRACKING_DATA}
WHERE client_id = %(client_id)s
${dateClause}  AND publisher_id IS NOT NULL
  AND is_valid = 1
  AND should_contribute_to_joveo_stats = 1
`.trim();
  const rows = await executeQuery(sql, params);
  const result = normalizeRows<PublisherMetadata>(rows, PUBLISHER_FIELDS as readonly (keyof PublisherMetadata)[]).map(
    (r) => ({
      publisher_id: r.publisher_id ?? "",
      publisher_name: r.publisher_name ?? null,
      publisher_bid_type: r.publisher_bid_type ?? null,
    }),
  );
  console.log(`Q2b get_publisher_metadata: ${result.length} row(s) for client ${clientId}`);
  return result;
}
