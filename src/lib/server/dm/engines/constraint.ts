type BindingName = "BUDGET" | "METRIC" | "PACING" | "INDEED";

const PRIORITY: Record<BindingName, number> = { BUDGET: 0, METRIC: 1, PACING: 2, INDEED: 3 };

const FLAG_MAP: Record<BindingName, string> = {
  BUDGET: "BUDGET_CAPPED",
  METRIC: "METRIC_CAPPED",
  PACING: "PACING_CAPPED",
  INDEED: "INDEED_CAPPED",
};

export function computeCellSpend(
  budgetCeiling: number | null,
  metricCeiling: number | null,
  pacingCeiling: number,
  indeedCeiling: number | null,
  actualMetric: number,
  volume: number,
): { cdspendNew: number; cdspendCeiling: number; bindingConstraint: BindingName; flags: string[] } {
  const ceilings: [BindingName, number][] = [];
  if (budgetCeiling !== null) ceilings.push(["BUDGET", budgetCeiling]);
  if (metricCeiling !== null) ceilings.push(["METRIC", metricCeiling]);
  ceilings.push(["PACING", pacingCeiling]);
  if (indeedCeiling !== null) ceilings.push(["INDEED", indeedCeiling]);

  // Tie-break by priority order: BUDGET > METRIC > PACING > INDEED
  ceilings.sort((a, b) => {
    if (a[1] !== b[1]) return a[1] - b[1];
    return PRIORITY[a[0]] - PRIORITY[b[0]];
  });
  const [bindingName, cdspendCeiling] = ceilings[0];

  const idealSpend = actualMetric * volume;
  const cdspendNew = Math.min(idealSpend, cdspendCeiling);

  const flags: string[] = [];
  if (idealSpend >= cdspendCeiling) flags.push(FLAG_MAP[bindingName]);
  if (cdspendNew < 0) flags.push("NEGATIVE_CDSPEND");
  if (cdspendCeiling <= 0 && budgetCeiling !== null && budgetCeiling <= 0) flags.push("BUDGET_EXHAUSTED");
  if (volume === 0) flags.push("ZERO_VOLUME_CELL");

  return { cdspendNew, cdspendCeiling, bindingConstraint: bindingName, flags };
}
