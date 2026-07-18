import "server-only";
import type { DMConfig, GoalConfig } from "@/lib/server/dm/models/dm-config";
import type { QueryResults } from "@/lib/server/dm/models/cell";
import type { EntityMetadata } from "@/lib/server/dm/models/tracking";
import { getTrackingData } from "./q1-tracking";
import {
  getCampaignMetadata,
  getClientMetadata,
  getJobBudget,
  getJobLifetimeSpend,
  getJobgroupBudget,
  getJobgroupMetadata,
  getMainClientId,
  getNonJaxSpend,
} from "./q2-entity-metadata";
import { getMarkupGrid } from "./q3-markup-grid";
import { getJobGrid } from "./q4-job-grid";
import { getIndeedStats } from "./q5-indeed";
import { getIndeedStatsByEntity } from "./q5-indeed-by-entity";
import { getCurrentDate } from "./q6-current-date";
import { getJobRefMapping } from "./q7-job-ref";
import { resolveEntityNameMapping } from "./q8-entity-name-mapping";

const LEVEL_RANK: Record<string, number> = { CLIENT: 0, CAMPAIGN: 1, JOBGROUP: 2, JOB: 3 };

function mostGranularLevel(goals: GoalConfig[]): string {
  return goals.reduce((acc, g) => {
    const accRank = LEVEL_RANK[acc] ?? 0;
    const gRank = LEVEL_RANK[g.entity_level] ?? 0;
    return gRank > accRank ? g.entity_level : acc;
  }, goals[0]?.entity_level ?? "CLIENT");
}

function goalLevels(goals: GoalConfig[]): Set<string> {
  return new Set(goals.map((g) => g.entity_level));
}

function indeedGoal(goals: GoalConfig[]): GoalConfig | undefined {
  return goals.find((g) => g.goal_type === "INDEED");
}

function jobBudgetGoal(goals: GoalConfig[]): GoalConfig | undefined {
  return goals.find((g) => g.goal_type === "JOB_BUDGET");
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  console.log(`Running ${label} …`);
  const t0 = Date.now();
  try {
    const result = await fn();
    console.log(`${label} completed in ${Date.now() - t0} ms`);
    return result;
  } catch (err) {
    console.error(`${label} failed:`, err);
    throw new Error(`${label} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function runAllQueries(config: DMConfig): Promise<QueryResults> {
  const goals = config.goals;
  const levels = goalLevels(goals);
  const granular = mostGranularLevel(goals);

  const currentDate = await timed("Q6 current_date", () => getCurrentDate());
  const trackingData = await timed(`Q1 main_tracking (level=${granular})`, () =>
    getTrackingData(config.client_id, config.start_date, config.end_date, granular),
  );

  const entityMetadata: EntityMetadata[] = [];
  // Parent-entity names must be fetched whenever a more granular goal exists: a JOBGROUP/JOB
  // cell has a parent campaign, and a JOB cell has a parent jobgroup, whose names the preview
  // resolves from this metadata. Date-scope to entities active in the tracking window.
  const needCampaignMeta = levels.has("CAMPAIGN") || levels.has("JOBGROUP") || levels.has("JOB");
  const needJobgroupNames = levels.has("JOBGROUP") || levels.has("JOB");
  if (levels.has("CLIENT")) {
    entityMetadata.push(...(await timed("Q2a client_metadata", () => getClientMetadata(config.client_id))));
  }
  if (needCampaignMeta) {
    entityMetadata.push(
      ...(await timed("Q2a campaign_metadata", () =>
        getCampaignMetadata(config.client_id, config.start_date, config.end_date),
      )),
    );
  }
  if (needJobgroupNames) {
    entityMetadata.push(
      ...(await timed("Q2a jobgroup_metadata", () =>
        getJobgroupMetadata(config.client_id, config.start_date, config.end_date),
      )),
    );
  }
  if (levels.has("JOBGROUP")) {
    entityMetadata.push(...(await timed("Q2a jobgroup_budget", () => getJobgroupBudget(config.client_id))));
  }
  if (levels.has("JOB")) {
    entityMetadata.push(...(await timed("Q2a job_budget", () => getJobBudget(config.client_id))));
  }

  const primaryLevel = config.goals[0]?.entity_level ?? "CLIENT";
  const markupGrid = await timed(`Q3 markup_grid (level=${primaryLevel})`, () =>
    getMarkupGrid(config.client_id, config.start_date, config.end_date, primaryLevel),
  );

  const ig = indeedGoal(goals);
  const needQ4 = goals.some((g) => g.goal_type === "JOB_BUDGET") || (ig !== undefined && ig.entity_level === "JOB");
  const jobGrid = needQ4
    ? await timed("Q4 job_grid", () => getJobGrid(config.client_id, config.start_date, config.end_date))
    : null;
  if (!needQ4) console.log("Skipping Q4 (no JOB_BUDGET or INDEED-at-JOB goal)");

  let indeedStats: Awaited<ReturnType<typeof getIndeedStats>> | null = null;
  let jobRefMappingOurs: Record<string, string> | null = null;
  let jobRefMappingTheirs: Record<string, string> | null = null;
  let indeedEntityStats: Awaited<ReturnType<typeof getIndeedStatsByEntity>> | null = null;
  let indeedEntityNameMapping: Record<string, string[]> | null = null;

  if (!ig) {
    console.log("Skipping Q5/Q7/Q8 (no INDEED goal)");
  } else if (ig.entity_level === "JOBGROUP" || ig.entity_level === "CAMPAIGN") {
    console.log(`INDEED @ ${ig.entity_level}: using name-based matching (Q8 → entity-scoped Q5)`);
    const ourEntityIds = new Set<string>();
    if (ig.entity_level === "JOBGROUP") {
      for (const r of trackingData) if (r.job_group_id) ourEntityIds.add(r.job_group_id);
    } else {
      for (const r of trackingData) if (r.campaign_id) ourEntityIds.add(r.campaign_id);
    }

    const nameMap = await timed(`Q8 entity_name_mapping (${ig.entity_level})`, () =>
      resolveEntityNameMapping(config.client_id, ig.comparison_entity_id!, ig.entity_level as "JOBGROUP" | "CAMPAIGN", ourEntityIds),
    );
    indeedEntityNameMapping = {};
    for (const [oid, cids] of Object.entries(nameMap)) {
      indeedEntityNameMapping[oid] = [...cids].sort();
    }

    const allComparisonIds = [
      ...new Set(Object.values(nameMap).flatMap((s) => [...s])),
    ].sort();
    if (allComparisonIds.length > 0) {
      indeedEntityStats = await timed(`Q5/by-entity indeed_stats (${ig.entity_level})`, () =>
        getIndeedStatsByEntity(
          ig.comparison_entity_id!,
          ig.indeed_publisher_name!,
          ig.entity_level as "JOBGROUP" | "CAMPAIGN",
          allComparisonIds,
          config.start_date,
          config.end_date,
        ),
      );
    } else {
      console.warn(`INDEED @ ${ig.entity_level}: Q8 returned no comparison ids — Q5/by-entity skipped`);
      indeedEntityStats = [];
    }
  } else {
    console.log(`INDEED @ ${ig.entity_level}: using job_ref_number matching (Q5 + Q7)`);
    indeedStats = await timed("Q5 indeed_stats", () =>
      getIndeedStats(ig.comparison_entity_id!, ig.indeed_publisher_name!, config.start_date, config.end_date),
    );
    jobRefMappingOurs = await timed("Q7 job_ref_mapping (main client)", () => getJobRefMapping(config.client_id));
    jobRefMappingTheirs = await timed("Q7 job_ref_mapping (comparison client)", () =>
      getJobRefMapping(ig.comparison_entity_id!),
    );
    console.log(
      `Q7 mapping: ours=${Object.keys(jobRefMappingOurs).length} entries, theirs=${Object.keys(jobRefMappingTheirs).length} entries`,
    );
  }

  const jb = jobBudgetGoal(goals);
  let jobLifetimeSpend: Record<string, number> | null = null;
  let mainClientId: string | null = null;
  let mainClientBudgets: EntityMetadata[] | null = null;
  let mainJobRefMapping: Record<string, string> | null = null;
  let nonJaxSpend: Record<string, number> | null = null;

  if (jb) {
    jobLifetimeSpend = await timed("Q8a job_lifetime_spend", () => getJobLifetimeSpend(config.client_id));
    if (jb.budget_level === "MAIN") {
      mainClientId = await timed("Q8b get_main_client_id", () => getMainClientId(config.client_id, config.start_date));
      if (mainClientId) {
        mainClientBudgets = await timed("Q8c main_client_job_budget", () => getJobBudget(mainClientId!));
        mainJobRefMapping = await timed("Q8d main_job_ref_mapping", () => getJobRefMapping(mainClientId!));
        nonJaxSpend = await timed("Q8e non_jax_spend", () =>
          getNonJaxSpend(mainClientId!, config.start_date, config.end_date),
        );
      } else {
        console.warn("No main client found — falling back to JAX budget level");
      }
    }
  } else {
    console.log("Skipping Q8 (no JOB_BUDGET goal)");
  }

  return {
    current_date: currentDate,
    tracking_data: trackingData,
    entity_metadata: entityMetadata,
    publisher_metadata: [],
    markup_grid: markupGrid,
    job_grid: jobGrid,
    indeed_stats: indeedStats,
    job_ref_mapping_ours: jobRefMappingOurs,
    job_ref_mapping_theirs: jobRefMappingTheirs,
    indeed_entity_stats: indeedEntityStats,
    indeed_entity_name_mapping: indeedEntityNameMapping,
    job_lifetime_spend: jobLifetimeSpend,
    main_client_id: mainClientId,
    main_client_budgets: mainClientBudgets,
    main_job_ref_mapping: mainJobRefMapping,
    non_jax_spend: nonJaxSpend,
  };
}
