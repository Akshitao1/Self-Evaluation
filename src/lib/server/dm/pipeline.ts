import "server-only";
import { runAllQueries } from "@/lib/server/snowflake/queries/query-engine";
import { resolveCurlType } from "@/lib/server/dm/engines/curl-type-resolver";
import { resolveWriteableDates } from "@/lib/server/dm/engines/writeable-dates";
import { computePacing } from "@/lib/server/dm/engines/pacing";
import { distributeSpend } from "@/lib/server/dm/engines/distribution";
import {
  computeIndeedCeilings,
  computeIndeedCeilingsByEntity,
  type IndeedCeilingResult,
} from "@/lib/server/dm/engines/indeed-mapper";
import { computeAllMarkups } from "@/lib/server/dm/engines/markup-calculator";
import { applyExclusions } from "@/lib/server/dm/engines/exclusions";
import type { DMConfig, GoalConfig } from "@/lib/server/dm/models/dm-config";
import type { Cell, CurlType, QueryResults } from "@/lib/server/dm/models/cell";
import type { EntityMetadata, JobGridRow, MarkupGridRow } from "@/lib/server/dm/models/tracking";

const LEVEL_RANK: Record<string, number> = { CLIENT: 0, CAMPAIGN: 1, JOBGROUP: 2, JOB: 3 };

function emptyCell(partial: Partial<Cell>): Cell {
  return {
    publisher_id: "",
    publisher_bid_type: null,
    event_publisher_date: "",
    entity_id: "",
    entity_level: "CLIENT",
    campaign_id: null,
    job_group_id: null,
    job_id: null,
    VPSpend: 0,
    MOJOSpend: 0,
    CDSpend_current: 0,
    CDSpend_NEW: null,
    budget_ceiling: null,
    metric_ceiling: null,
    pacing_ceiling: null,
    indeed_ceiling: null,
    indeed_spend: null,
    indeed_volume: null,
    margin_ceiling: null,
    CDSpend_ceiling: null,
    ideal_spend: null,
    markup_current: null,
    markup_new: null,
    markdown_current: null,
    markdown_new: null,
    curl_type: null,
    is_writeable: true,
    curl_blocked: false,
    flags: [],
    Clicks: 0,
    Apply_start: 0,
    Apply: 0,
    cell_weight: null,
    goal_targets: null,
    ...partial,
  };
}

function entityIdFromGrid(row: MarkupGridRow | JobGridRow, goal: GoalConfig): string {
  const level = goal.entity_level;
  if (level === "JOB" && "job_id" in row && row.job_id) return row.job_id;
  if (level === "JOBGROUP" && row.job_group_id) return row.job_group_id;
  if (level === "CAMPAIGN" && row.campaign_id) return row.campaign_id;
  return row.client_id;
}

function buildEntityMetaMap(metadata: EntityMetadata[]): Map<string, EntityMetadata> {
  const result = new Map<string, EntityMetadata>();
  for (const m of metadata) {
    const existing = result.get(m.entity_id);
    if (!existing) {
      result.set(m.entity_id, m);
      continue;
    }
    const merged: Record<string, unknown> = { ...existing };
    for (const [k, v] of Object.entries(m)) {
      if (k === "entity_id" || k === "entity_level") continue;
      if (v !== null && v !== undefined) merged[k] = v;
    }
    result.set(m.entity_id, merged as unknown as EntityMetadata);
  }
  return result;
}

function resolveGoalValue(goal: GoalConfig, entityId: string, meta: EntityMetadata | undefined): number | null {
  if (goal.per_entity_values && entityId in goal.per_entity_values) return goal.per_entity_values[entityId];
  if (goal.value !== null && goal.value !== undefined) return goal.value;
  if (!meta) return null;
  if (goal.goal_type === "CPA") return meta.cpa_goal;
  if (goal.goal_type === "CPC") return meta.cpc_goal;
  if (goal.goal_type === "CPAS") return meta.cpas_goal;
  if (goal.goal_type === "BUDGET" || goal.goal_type === "JOB_BUDGET") return meta.effective_budget;
  return null;
}

function metricCeilingForGoal(
  goal: GoalConfig,
  cell: Cell,
  meta: EntityMetadata | undefined,
  targetEntityId?: string,
): number | null {
  const eid = targetEntityId ?? cell.entity_id;
  const target = resolveGoalValue(goal, eid, meta);
  if (target === null) return null;
  if (goal.goal_type === "CPA") return target * cell.Apply;
  if (goal.goal_type === "CPC") return target * cell.Clicks;
  if (goal.goal_type === "CPAS") return target * cell.Apply_start;
  return null;
}

function entityMetricCeiling(
  goal: GoalConfig,
  entityId: string,
  cellIdxs: number[],
  cells: Cell[],
  meta: EntityMetadata | undefined,
): number | null {
  const target = resolveGoalValue(goal, entityId, meta);
  if (target === null) return null;
  if (goal.goal_type === "CPA") return target * cellIdxs.reduce((s, i) => s + cells[i].Apply, 0);
  if (goal.goal_type === "CPC") return target * cellIdxs.reduce((s, i) => s + cells[i].Clicks, 0);
  if (goal.goal_type === "CPAS") return target * cellIdxs.reduce((s, i) => s + cells[i].Apply_start, 0);
  return null;
}

function entityIndeedCeiling(
  goal: GoalConfig,
  indeedTarget: number | null | undefined,
  cellIdxs: number[],
  cells: Cell[],
): number | null {
  if (indeedTarget === null || indeedTarget === undefined) return null;
  let vol: number;
  if (goal.indeed_metric === "CPA") vol = cellIdxs.reduce((s, i) => s + cells[i].Apply, 0);
  else if (goal.indeed_metric === "CPC") vol = cellIdxs.reduce((s, i) => s + cells[i].Clicks, 0);
  else return null;
  if (vol <= 0) return null;
  return indeedTarget * vol;
}

function resolveManualBudget(
  goal: GoalConfig,
  jgId: string,
  jgToCampaign: Record<string, string>,
): number | null {
  const level = goal.manual_budget_level;
  const vals = goal.manual_budget_values ?? {};
  if (!level) return goal.value ?? null;
  if (level === "JOBGROUP") return jgId in vals ? vals[jgId] : goal.value ?? null;
  if (level === "CAMPAIGN") {
    const camp = jgToCampaign[jgId];
    return camp && camp in vals ? vals[camp] : goal.value ?? null;
  }
  return goal.value ?? null;
}

interface BudgetCeilingOptions {
  lifetimeSpend?: Record<string, number> | null;
  mainClientBudgetsMap?: Map<string, EntityMetadata> | null;
  nonJaxSpend?: Record<string, number> | null;
  jgToCampaign?: Record<string, string>;
  jobBudgetDbMap?: Map<string, EntityMetadata> | null;
}

function budgetCeilingForGoal(
  goal: GoalConfig,
  entityId: string,
  meta: EntityMetadata | undefined,
  opts: BudgetCeilingOptions = {},
): number | null {
  if (goal.goal_type !== "BUDGET" && goal.goal_type !== "JOB_BUDGET") return null;
  if (goal.goal_type !== "JOB_BUDGET") return resolveGoalValue(goal, entityId, meta);

  let raw: number | null = null;
  if (goal.per_entity_values && entityId in goal.per_entity_values) raw = goal.per_entity_values[entityId];

  const jobMeta = opts.jobBudgetDbMap?.get(entityId);
  if (raw === null && jobMeta?.effective_budget !== null && jobMeta?.effective_budget !== undefined) {
    raw = jobMeta.effective_budget;
  }
  if (raw === null) raw = resolveManualBudget(goal, entityId, opts.jgToCampaign ?? {});

  if (goal.budget_level === "MAIN" && opts.mainClientBudgetsMap) {
    const mainMeta = opts.mainClientBudgetsMap.get(entityId);
    if (mainMeta?.effective_budget !== null && mainMeta?.effective_budget !== undefined) {
      raw = mainMeta.effective_budget - (opts.nonJaxSpend?.[entityId] ?? 0);
    }
  }

  if (raw === null) return null;

  const freqSource = jobMeta ?? meta;
  const freq = freqSource?.budget_cap_frequency?.toUpperCase() ?? "MONTHLY";
  if (freq === "LIFETIME") {
    const lt = opts.lifetimeSpend?.[entityId] ?? 0;
    return Math.max(raw - lt, 0);
  }
  return raw;
}

function resolveJobgroupBudget(
  goal: GoalConfig | undefined,
  jgId: string,
  metaMap: Map<string, EntityMetadata>,
  jgToCampaign: Record<string, string>,
): number | null {
  const jgMeta = metaMap.get(jgId);
  if (goal && goal.manual_budget_level === "JOBGROUP") {
    const mbv = goal.manual_budget_values ?? {};
    if (jgId in mbv) return mbv[jgId];
  }
  if (jgMeta?.effective_budget !== null && jgMeta?.effective_budget !== undefined) return jgMeta.effective_budget;
  if (goal && goal.manual_budget_level === "CAMPAIGN") {
    const mbv = goal.manual_budget_values ?? {};
    const camp = jgToCampaign[jgId];
    if (camp && camp in mbv) return mbv[camp];
  }
  return null;
}

function marginCeilingForCell(goal: GoalConfig, cell: Cell, curlType: CurlType): number | null {
  if (goal.goal_type !== "FIXED_MARGIN" || goal.value === null || goal.value === undefined) return null;
  const pct = goal.value;
  if (curlType === "MARKUP") {
    return cell.VPSpend > 0 ? cell.VPSpend * (1.0 + pct / 100.0) : 0.0;
  }
  if (pct >= 100.0) return null;
  return cell.VPSpend > 0 ? cell.VPSpend / (1.0 - pct / 100.0) : 0.0;
}

function entityMarginCeiling(
  goal: GoalConfig | undefined,
  cellIdxs: number[],
  cells: Cell[],
  curlType: CurlType,
): number | null {
  if (!goal || goal.goal_type !== "FIXED_MARGIN" || goal.value === null || goal.value === undefined) return null;
  let total = 0;
  for (const i of cellIdxs) {
    const v = marginCeilingForCell(goal, cells[i], curlType);
    if (v !== null) total += v;
  }
  return total;
}

function resolveIndeedPctByEntity(indeedGoal: GoalConfig, qr: QueryResults): Record<string, number> {
  const overrides = indeedGoal.match_pct_overrides ?? {};
  if (Object.keys(overrides).length === 0) return {};
  const level = indeedGoal.entity_level;
  if (level === "JOBGROUP") return { ...overrides };

  if (level === "JOB") {
    const jobToJgs = new Map<string, Set<string>>();
    if (qr.job_grid) {
      for (const row of qr.job_grid) {
        if (row.job_id && row.job_group_id) {
          let s = jobToJgs.get(row.job_id);
          if (!s) {
            s = new Set();
            jobToJgs.set(row.job_id, s);
          }
          s.add(row.job_group_id);
        }
      }
    }
    for (const row of qr.tracking_data) {
      if (row.job_id && row.job_group_id) {
        let s = jobToJgs.get(row.job_id);
        if (!s) {
          s = new Set();
          jobToJgs.set(row.job_id, s);
        }
        s.add(row.job_group_id);
      }
    }
    const out: Record<string, number> = {};
    for (const [jobId, jgs] of jobToJgs) {
      const matched: number[] = [];
      for (const jg of jgs) if (jg in overrides) matched.push(overrides[jg]);
      if (matched.length === 0) continue;
      out[jobId] = Math.min(...matched);
    }
    return out;
  }
  console.warn(
    `INDEED match_pct_overrides provided but goal entity_level=${level} — overrides keyed by jobgroup cannot apply at this level; ignoring.`,
  );
  return {};
}

function buildCellsFromGrid(
  grid: (MarkupGridRow | JobGridRow)[],
  goal: GoalConfig,
  writeableDates: string[],
  curlType: CurlType,
): Cell[] {
  const writeableSet = new Set(writeableDates);
  return grid.map((row) =>
    emptyCell({
      publisher_id: row.publisher_id,
      publisher_bid_type: row.publisher_bid_type,
      event_publisher_date: row.event_publisher_date,
      entity_id: entityIdFromGrid(row, goal),
      entity_level: goal.entity_level,
      campaign_id: row.campaign_id,
      job_group_id: row.job_group_id,
      job_id: "job_id" in row ? row.job_id : null,
      VPSpend: row.VPSpend,
      MOJOSpend: row.MOJOSpend,
      CDSpend_current: row.CDSpend,
      Clicks: row.Clicks,
      Apply_start: row.Apply_start,
      Apply: row.Apply,
      markup_current: row.effective_cd_markup,
      markdown_current: row.publisher_entity_markdown,
      is_writeable: writeableSet.has(row.event_publisher_date),
      curl_type: curlType,
    }),
  );
}

function applyJobgroupAggregateCap(
  cells: Cell[],
  budgetGoal: GoalConfig | undefined,
  jobToJg: Record<string, string>,
  metaMap: Map<string, EntityMetadata>,
  writeableDates: string[],
  primaryEntityLevel: string,
  jgToCampaign: Record<string, string>,
): Cell[] {
  if (primaryEntityLevel !== "JOB" || Object.keys(jobToJg).length === 0) return cells;
  const writeableSet = new Set(writeableDates);

  // Group by jobgroup -> by job
  const jgToJobs = new Map<string, Map<string, Cell[]>>();
  for (const c of cells) {
    const jgId = jobToJg[c.entity_id] ?? c.entity_id;
    let perJob = jgToJobs.get(jgId);
    if (!perJob) {
      perJob = new Map();
      jgToJobs.set(jgId, perJob);
    }
    let arr = perJob.get(c.entity_id);
    if (!arr) {
      arr = [];
      perJob.set(c.entity_id, arr);
    }
    arr.push(c);
  }

  const output: Cell[] = [];
  for (const [jgId, perJob] of jgToJobs) {
    const jgBudget = resolveJobgroupBudget(budgetGoal, jgId, metaMap, jgToCampaign);
    if (jgBudget === null) {
      for (const ec of perJob.values()) output.push(...ec);
      continue;
    }

    let nonWriteableSum = 0;
    let writeableNewSum = 0;
    for (const ec of perJob.values()) {
      for (const c of ec) {
        if (writeableSet.has(c.event_publisher_date)) writeableNewSum += c.CDSpend_NEW ?? 0;
        else nonWriteableSum += c.CDSpend_current;
      }
    }
    const totalPeriodNew = nonWriteableSum + writeableNewSum;
    if (totalPeriodNew <= jgBudget + 1e-6) {
      for (const ec of perJob.values()) output.push(...ec);
      continue;
    }

    const allowedWriteableTotal = Math.max(jgBudget - nonWriteableSum, 0);

    const jobWeights = new Map<string, number>();
    for (const [jobId, ec] of perJob) {
      let w = 0;
      for (const c of ec) if (writeableSet.has(c.event_publisher_date)) w += c.CDSpend_current;
      jobWeights.set(jobId, w);
    }
    let totalWeight = 0;
    for (const w of jobWeights.values()) totalWeight += w;
    const nJobs = perJob.size;

    for (const [jobId, ec] of perJob) {
      const preScaleWriteableNew = ec
        .filter((c) => writeableSet.has(c.event_publisher_date))
        .reduce((s, c) => s + (c.CDSpend_NEW ?? 0), 0);

      let jobWriteableTarget: number;
      if (totalWeight > 0) {
        jobWriteableTarget = allowedWriteableTotal * ((jobWeights.get(jobId) ?? 0) / totalWeight);
      } else {
        jobWriteableTarget = allowedWriteableTotal / nJobs;
      }
      jobWriteableTarget = Math.min(jobWriteableTarget, preScaleWriteableNew);

      const redistributed = distributeSpend(ec, jobWriteableTarget, writeableDates);
      for (const c of redistributed) {
        if (!c.flags.includes("JOBGROUP_BUDGET_CAPPED")) c.flags.push("JOBGROUP_BUDGET_CAPPED");
      }
      output.push(...redistributed);
    }
  }
  return output;
}

export interface PipelineContext {
  job_to_jg: Record<string, string>;
  jg_to_campaign: Record<string, string>;
  jg_budgets: Record<string, number>;
}

export interface PipelineResult {
  cells: Cell[];
  writeableDates: string[];
  entityNameMap: Record<string, string>;
  context: PipelineContext;
}

function resolveEntityForLevel(
  cellEid: string,
  cellLevel: string,
  targetLevel: string,
  jobToJg: Record<string, string>,
  jgToCampaign: Record<string, string>,
  clientId: string,
): string {
  if (cellLevel === targetLevel) return cellEid;
  let curId = cellEid;
  let curLvl = cellLevel;
  if (curLvl === "JOB" && (LEVEL_RANK[targetLevel] ?? 0) < 3) {
    curId = jobToJg[curId] ?? curId;
    curLvl = "JOBGROUP";
  }
  if (curLvl === "JOBGROUP" && (LEVEL_RANK[targetLevel] ?? 0) < 2) {
    curId = jgToCampaign[curId] ?? curId;
    curLvl = "CAMPAIGN";
  }
  if (curLvl === "CAMPAIGN" && targetLevel === "CLIENT") curId = clientId;
  return curId;
}

export async function runPipeline(config: DMConfig): Promise<PipelineResult> {
  // Step 1
  console.log(
    `Step 1: Running all queries for client=${config.client_id}, range=${config.start_date}..${config.end_date}, goals=${JSON.stringify(config.goals.map((g) => [g.goal_type, g.entity_level, g.value]))}`,
  );
  const qr = await runAllQueries(config);

  // Step 2
  const writeableDates = resolveWriteableDates(
    config.past_edit_config,
    qr.current_date,
    config.start_date,
    config.end_date,
  );
  console.log(`Step 2: ${writeableDates.length} writeable date(s)`);

  // Step 3
  const curlType = resolveCurlType(config.goals);
  console.log(`Step 3: curl_type=${curlType}`);

  // Step 4
  const primaryGoal = config.goals[0];
  const budgetGoal = config.goals.find((g) => g.goal_type === "BUDGET" || g.goal_type === "JOB_BUDGET");
  const metricGoal = config.goals.find((g) => g.goal_type === "CPA" || g.goal_type === "CPC" || g.goal_type === "CPAS");
  const indeedGoal = config.goals.find((g) => g.goal_type === "INDEED");
  const marginGoal = config.goals.find((g) => g.goal_type === "FIXED_MARGIN");

  const useJobGrid = curlType === "MARKDOWN" && qr.job_grid !== null;
  const grid = useJobGrid ? qr.job_grid! : qr.markup_grid;
  let cells = buildCellsFromGrid(grid, primaryGoal, writeableDates, curlType);
  console.log(`Step 4: ${cells.length} cells from ${useJobGrid ? "job_grid" : "markup_grid"}`);

  // Hierarchy mappings
  const jobToJg: Record<string, string> = {};
  const jgToCampaign: Record<string, string> = {};
  const isJobBudget = budgetGoal !== undefined && budgetGoal.goal_type === "JOB_BUDGET";
  if (useJobGrid && qr.job_grid) {
    for (const row of qr.job_grid) {
      if (row.job_group_id) jobToJg[row.job_id] = row.job_group_id;
      if (row.job_group_id && row.campaign_id) jgToCampaign[row.job_group_id] = row.campaign_id;
    }
  }
  if (Object.keys(jgToCampaign).length === 0) {
    for (const row of qr.markup_grid) {
      if (row.job_group_id && row.campaign_id) jgToCampaign[row.job_group_id] = row.campaign_id;
    }
  }

  if (cells.length === 0) {
    console.warn("No grid data returned — flagging ENTITY_SKIPPED_NO_DATA");
    const empty: Cell = emptyCell({
      publisher_id: "N/A",
      event_publisher_date: config.start_date,
      entity_id: config.client_id,
      entity_level: primaryGoal.entity_level,
      is_writeable: false,
      curl_blocked: true,
      flags: ["ENTITY_SKIPPED_NO_DATA"],
    });
    return {
      cells: [empty],
      writeableDates,
      entityNameMap: {},
      context: { job_to_jg: jobToJg, jg_to_campaign: jgToCampaign, jg_budgets: {} },
    };
  }

  const metaMap = buildEntityMetaMap(qr.entity_metadata);

  let mainBudgetsMap: Map<string, EntityMetadata> | null = null;
  if (isJobBudget && budgetGoal && budgetGoal.budget_level === "MAIN" && qr.main_client_budgets) {
    mainBudgetsMap = buildEntityMetaMap(qr.main_client_budgets);
  }
  let jobBudgetDbMap: Map<string, EntityMetadata> | null = null;
  if (isJobBudget) {
    jobBudgetDbMap = buildEntityMetaMap(qr.entity_metadata.filter((m) => m.entity_level === "JOB"));
  }
  const budgetOpts: BudgetCeilingOptions = isJobBudget
    ? {
        lifetimeSpend: qr.job_lifetime_spend,
        mainClientBudgetsMap: mainBudgetsMap,
        nonJaxSpend: qr.non_jax_spend,
        jgToCampaign,
        jobBudgetDbMap,
      }
    : {};

  const budgetEid = (eid: string): string => (isJobBudget ? jobToJg[eid] ?? eid : eid);

  // Step 5: pacing
  const entityCells = new Map<string, number[]>();
  cells.forEach((c, i) => {
    let arr = entityCells.get(c.entity_id);
    if (!arr) {
      arr = [];
      entityCells.set(c.entity_id, arr);
    }
    arr.push(i);
  });

  const pacingByDate = new Map<string, Record<string, number>>();
  if (isJobBudget && Object.keys(jobToJg).length > 0) {
    const jgCells = new Map<string, number[]>();
    cells.forEach((c, i) => {
      const jg = jobToJg[c.entity_id] ?? c.entity_id;
      let arr = jgCells.get(jg);
      if (!arr) {
        arr = [];
        jgCells.set(jg, arr);
      }
      arr.push(i);
    });
    const jgPacing = new Map<string, Record<string, number>>();
    for (const [jgId, idxs] of jgCells) {
      const jgMeta = metaMap.get(jgId);
      const jgBudget = budgetGoal ? budgetCeilingForGoal(budgetGoal, jgId, jgMeta, budgetOpts) ?? 0 : 0;
      const cdspendAll = idxs.reduce((s, i) => s + cells[i].CDSpend_current, 0);
      jgPacing.set(jgId, computePacing(jgBudget, cdspendAll, writeableDates, config.pacing_config));
    }
    for (const eid of entityCells.keys()) {
      pacingByDate.set(eid, jgPacing.get(jobToJg[eid] ?? eid) ?? {});
    }
  } else {
    for (const [eid, idxs] of entityCells) {
      const meta = metaMap.get(eid);
      const budget = budgetGoal ? budgetCeilingForGoal(budgetGoal, eid, meta, budgetOpts) ?? 0 : 0;
      const cdspendAll = idxs.reduce((s, i) => s + cells[i].CDSpend_current, 0);
      pacingByDate.set(eid, computePacing(budget, cdspendAll, writeableDates, config.pacing_config));
    }
  }

  // Step 6: indeed
  let indeedCeilingsMap: Record<string, number | null> = {};
  let indeedTargetsMap: Record<string, number | null> = {};
  let indeedSpendMap: Record<string, number> = {};
  let indeedVolumeMap: Record<string, number> = {};

  if (indeedGoal) {
    const pctByEntity = resolveIndeedPctByEntity(indeedGoal, qr);
    let result: IndeedCeilingResult | null = null;

    if (indeedGoal.entity_level === "JOBGROUP" || indeedGoal.entity_level === "CAMPAIGN") {
      const entityStats = qr.indeed_entity_stats ?? [];
      const nameMapping = qr.indeed_entity_name_mapping ?? {};
      if (entityStats.length === 0 || Object.keys(nameMapping).length === 0) {
        console.warn(
          `Step 6: INDEED @ ${indeedGoal.entity_level} — name-mapped inputs missing. Indeed ceiling will NOT be applied.`,
        );
      } else {
        result = computeIndeedCeilingsByEntity(
          qr.tracking_data,
          entityStats,
          nameMapping,
          indeedGoal.match_pct!,
          indeedGoal.indeed_metric!,
          indeedGoal.entity_level,
          Object.keys(pctByEntity).length > 0 ? pctByEntity : undefined,
        );
      }
    } else if (qr.indeed_stats) {
      result = computeIndeedCeilings(
        qr.tracking_data,
        qr.indeed_stats,
        qr.job_ref_mapping_ours ?? {},
        qr.job_ref_mapping_theirs ?? {},
        indeedGoal.match_pct!,
        indeedGoal.indeed_metric!,
        indeedGoal.entity_level,
        Object.keys(pctByEntity).length > 0 ? pctByEntity : undefined,
      );
    } else {
      console.warn(`Step 6: INDEED goal present but qr.indeed_stats is EMPTY — Indeed ceiling will NOT be applied.`);
    }
    if (result) {
      indeedCeilingsMap = result.ceilings;
      indeedTargetsMap = result.targets;
      indeedSpendMap = result.indeedSpend;
      indeedVolumeMap = result.indeedVolume;
    }
  }

  // Step 7: per-entity ceiling annotation + goal targets (mirrors Python)
  for (const [eid, idxs] of entityCells) {
    const meta = metaMap.get(eid);
    const bEid = budgetEid(eid);
    const bMeta = bEid !== eid ? metaMap.get(bEid) : meta;
    const entityBudgetCeil = budgetGoal ? budgetCeilingForGoal(budgetGoal, bEid, bMeta, budgetOpts) : null;

    let mEid = eid;
    let mMeta = meta;
    if (metricGoal) {
      mEid = resolveEntityForLevel(eid, primaryGoal.entity_level, metricGoal.entity_level, jobToJg, jgToCampaign, config.client_id);
      mMeta = metaMap.get(mEid);
    }
    const entityPacingDates = pacingByDate.get(eid) ?? {};

    let entityIndeedSpend: number | null = null;
    let entityIndeedVolume: number | null = null;
    let entityIndeedCeil: number | null = null;
    if (indeedGoal) {
      const iEid = resolveEntityForLevel(eid, primaryGoal.entity_level, indeedGoal.entity_level, jobToJg, jgToCampaign, config.client_id);
      entityIndeedSpend = indeedSpendMap[iEid] ?? null;
      entityIndeedVolume = indeedVolumeMap[iEid] ?? null;
      if (iEid === eid) {
        entityIndeedCeil = indeedCeilingsMap[iEid] ?? null;
      } else {
        entityIndeedCeil = entityIndeedCeiling(indeedGoal, indeedTargetsMap[iEid], idxs, cells);
      }
    }

    const goalTargets: Record<string, number> = {};
    for (const g of config.goals) {
      let val: number | null | undefined = null;
      if (g.goal_type === "JOB_BUDGET") {
        val = budgetCeilingForGoal(g, budgetEid(eid), bMeta, budgetOpts);
      } else if (g.goal_type === "BUDGET") {
        if (g.entity_level === primaryGoal.entity_level) val = resolveGoalValue(g, eid, meta);
      } else if (g.goal_type === "INDEED") {
        const resolvedEid = resolveEntityForLevel(eid, primaryGoal.entity_level, g.entity_level, jobToJg, jgToCampaign, config.client_id);
        val = indeedTargetsMap[resolvedEid];
      } else {
        const resolvedEid = resolveEntityForLevel(eid, primaryGoal.entity_level, g.entity_level, jobToJg, jgToCampaign, config.client_id);
        const resolvedMeta = metaMap.get(resolvedEid);
        val = resolveGoalValue(g, resolvedEid, resolvedMeta);
      }
      if (val !== null && val !== undefined) goalTargets[g.goal_type] = val;
    }

    for (const i of idxs) {
      const cell = cells[i];
      const perCellMetric = metricGoal ? metricCeilingForGoal(metricGoal, cell, mMeta, mEid) : null;
      const perCellPacing = entityPacingDates[cell.event_publisher_date] ?? Number.POSITIVE_INFINITY;
      const perCellMargin = marginGoal ? marginCeilingForCell(marginGoal, cell, curlType) : null;
      cells[i] = {
        ...cell,
        budget_ceiling: entityBudgetCeil,
        metric_ceiling: perCellMetric,
        pacing_ceiling: perCellPacing,
        indeed_ceiling: entityIndeedCeil,
        indeed_spend: entityIndeedSpend,
        indeed_volume: entityIndeedVolume,
        margin_ceiling: perCellMargin,
        goal_targets: Object.keys(goalTargets).length ? { ...goalTargets } : null,
      };
    }
  }

  // Step 8: distribution
  const writeableSet = new Set(writeableDates);
  const grouped = new Map<string, Cell[]>();
  for (const c of cells) {
    let arr = grouped.get(c.entity_id);
    if (!arr) {
      arr = [];
      grouped.set(c.entity_id, arr);
    }
    arr.push(c);
  }
  const distributed: Cell[] = [];
  for (const [eid, ecells] of grouped) {
    const meta = metaMap.get(eid);
    const allIdxs: number[] = [];
    cells.forEach((c, i) => {
      if (c.entity_id === eid) allIdxs.push(i);
    });

    const bEid = budgetEid(eid);
    const bMeta = bEid !== eid ? metaMap.get(bEid) : meta;
    const entityBudgetCeil = budgetGoal ? budgetCeilingForGoal(budgetGoal, bEid, bMeta, budgetOpts) : null;
    let entityMetricCeil: number | null = null;
    if (metricGoal) {
      const mEid = resolveEntityForLevel(eid, primaryGoal.entity_level, metricGoal.entity_level, jobToJg, jgToCampaign, config.client_id);
      const mMeta = metaMap.get(mEid);
      entityMetricCeil = entityMetricCeiling(metricGoal, mEid, allIdxs, cells, mMeta);
    }
    const entityPacingDates = pacingByDate.get(eid) ?? {};
    let entityPacingRaw = 0;
    let pacingHasInf = false;
    if (Object.keys(entityPacingDates).length === 0) {
      pacingHasInf = true;
    } else {
      for (const v of Object.values(entityPacingDates)) {
        if (!Number.isFinite(v)) {
          pacingHasInf = true;
          break;
        }
        entityPacingRaw += v;
      }
    }
    let entityIndeedCeil: number | null = null;
    if (indeedGoal) {
      const iEid = resolveEntityForLevel(eid, primaryGoal.entity_level, indeedGoal.entity_level, jobToJg, jgToCampaign, config.client_id);
      if (iEid === eid) entityIndeedCeil = indeedCeilingsMap[iEid] ?? null;
      else entityIndeedCeil = entityIndeedCeiling(indeedGoal, indeedTargetsMap[iEid], allIdxs, cells);
    }
    const entityMarginCeilVal = entityMarginCeiling(marginGoal, allIdxs, cells, curlType);

    let nonWriteableSpend = 0;
    let writeableCurrentSpend = 0;
    for (const c of ecells) {
      if (writeableSet.has(c.event_publisher_date)) writeableCurrentSpend += c.CDSpend_current;
      else nonWriteableSpend += c.CDSpend_current;
    }

    const ceilingsList: number[] = [];
    if (entityBudgetCeil !== null) ceilingsList.push(entityBudgetCeil - nonWriteableSpend);
    if (entityMetricCeil !== null) ceilingsList.push(entityMetricCeil - nonWriteableSpend);
    if (!pacingHasInf) ceilingsList.push(entityPacingRaw + writeableCurrentSpend);
    if (entityIndeedCeil !== null) ceilingsList.push(entityIndeedCeil - nonWriteableSpend);
    if (entityMarginCeilVal !== null) ceilingsList.push(entityMarginCeilVal - nonWriteableSpend);

    const entityCurrentSpend = ecells.reduce((s, c) => s + c.CDSpend_current, 0);
    let entityCdspendNew = ceilingsList.length > 0 ? Math.min(...ceilingsList) : entityCurrentSpend;

    if (isJobBudget && !metricGoal && !indeedGoal) {
      entityCdspendNew = Math.min(entityCdspendNew, writeableCurrentSpend);
    }

    const result = distributeSpend(ecells, entityCdspendNew, writeableDates);
    distributed.push(...result);
  }
  cells = distributed;

  // Step 8b: jobgroup aggregate cap
  cells = applyJobgroupAggregateCap(cells, budgetGoal, jobToJg, metaMap, writeableDates, primaryGoal.entity_level, jgToCampaign);

  // Step 9: markup calculator
  cells = computeAllMarkups(cells, curlType);

  // Step 9b: exclusions
  cells = applyExclusions(cells, config.exclusions);

  // Build entity name map
  const entityNameMap: Record<string, string> = {};
  for (const m of qr.entity_metadata) {
    if (m.entity_name && !(m.entity_id in entityNameMap)) entityNameMap[m.entity_id] = m.entity_name;
  }

  // Per-jobgroup budgets for rollup
  const jgBudgets: Record<string, number> = {};
  if (Object.keys(jobToJg).length > 0 && primaryGoal.entity_level === "JOB") {
    const jgIds = new Set(Object.values(jobToJg));
    for (const jgId of jgIds) {
      const v = resolveJobgroupBudget(budgetGoal, jgId, metaMap, jgToCampaign);
      if (v !== null) jgBudgets[jgId] = v;
    }
  }

  return {
    cells,
    writeableDates,
    entityNameMap,
    context: { job_to_jg: jobToJg, jg_to_campaign: jgToCampaign, jg_budgets: jgBudgets },
  };
}
