import type { Cell, PreviewRow } from "@/lib/server/dm/models/cell";

const CONSTRAINT_FLAGS: [string, string][] = [
  ["JOBGROUP_BUDGET_CAPPED", "JOBGROUP_BUDGET"],
  ["BUDGET_CAPPED", "BUDGET"],
  ["METRIC_CAPPED", "METRIC"],
  ["PACING_CAPPED", "PACING"],
  ["INDEED_CAPPED", "INDEED"],
];

const BLOCKING_FLAGS = new Set([
  "ZERO_MOJO",
  "NO_CHANGE",
  "NOT_WRITEABLE",
  "ENTITY_SKIPPED_NO_DATA",
  "EXTREME_NEGATIVE_MARKUP",
  "INFEASIBLE_DISTRIBUTION",
  "BUDGET_EXHAUSTED",
  "VPSPEND_ZERO",
]);

function bindingConstraint(flags: string[]): string {
  for (const [flag, name] of CONSTRAINT_FLAGS) {
    if (flags.includes(flag)) return name;
  }
  return "UNCONSTRAINED";
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function spendDeltas(cell: Cell, writeable: boolean): { delta: number | null; pct: number | null } {
  if (!writeable || cell.CDSpend_NEW === null) return { delta: null, pct: null };
  const delta = cell.CDSpend_NEW - cell.CDSpend_current;
  let pct: number | null = null;
  if (cell.CDSpend_current !== 0) pct = (cell.CDSpend_NEW / cell.CDSpend_current - 1.0) * 100.0;
  return { delta: round2(delta), pct: pct === null ? null : round2(pct) };
}

function markupDelta(cell: Cell, writeable: boolean): number | null {
  if (!writeable) return null;
  if (cell.markup_new !== null && cell.markup_current !== null) return round2(cell.markup_new - cell.markup_current);
  if (cell.markdown_new !== null && cell.markdown_current !== null)
    return round2(cell.markdown_new - cell.markdown_current);
  return null;
}

export function buildPreview(
  cells: Cell[],
  writeableDates: readonly string[],
  entityNames: Record<string, string> = {},
  options: {
    jobToJg?: Record<string, string>;
    jgToCampaign?: Record<string, string>;
    jgBudgets?: Record<string, number>;
  } = {},
): PreviewRow[] {
  const writeableSet = new Set(writeableDates);
  const jobToJg = options.jobToJg ?? {};
  const jgToCampaign = options.jgToCampaign ?? {};
  const jgBudgets = options.jgBudgets ?? {};

  const rows: PreviewRow[] = cells.map((cell) => {
    const writeable = writeableSet.has(cell.event_publisher_date);
    const binding = bindingConstraint(cell.flags);
    const { delta: spendDelta, pct: spendDeltaPct } = spendDeltas(cell, writeable);
    const markup_delta = markupDelta(cell, writeable);
    const blocked =
      !writeable || (cell.flags.length > 0 && cell.flags.some((f) => BLOCKING_FLAGS.has(f))) || cell.curl_blocked;

    let jgId: string | null = null;
    let campaignId: string | null = null;
    if (cell.entity_level === "JOB") {
      jgId = jobToJg[cell.entity_id] ?? null;
      if (jgId) campaignId = jgToCampaign[jgId] ?? null;
    } else if (cell.entity_level === "JOBGROUP") {
      jgId = cell.entity_id;
      campaignId = jgToCampaign[jgId] ?? null;
    } else if (cell.entity_level === "CAMPAIGN") {
      campaignId = cell.entity_id;
    }

    const row: PreviewRow = {
      ...cell,
      entity_name: entityNames[cell.entity_id] ?? null,
      binding_constraint: binding,
      spend_delta: spendDelta,
      spend_delta_pct: spendDeltaPct,
      markup_delta,
      is_writeable: writeable,
      curl_blocked: blocked,
      job_group_id: jgId,
      job_group_name: jgId ? entityNames[jgId] ?? null : null,
      campaign_id: campaignId,
      campaign_name: campaignId ? entityNames[campaignId] ?? null : null,
      job_group_budget: jgId ? jgBudgets[jgId] ?? null : null,
    };
    return row;
  });

  rows.sort((a, b) => {
    if (a.entity_id !== b.entity_id) return a.entity_id < b.entity_id ? -1 : 1;
    if (a.publisher_id !== b.publisher_id) return a.publisher_id < b.publisher_id ? -1 : 1;
    return a.event_publisher_date < b.event_publisher_date ? -1 : 1;
  });
  return rows;
}
