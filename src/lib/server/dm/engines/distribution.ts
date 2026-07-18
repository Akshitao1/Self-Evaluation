import type { Cell } from "@/lib/server/dm/models/cell";

const MAX_RENORM_ITERATIONS = 3;

export function distributeSpend(
  cells: Cell[],
  entityCdspendNew: number,
  writeableDates: readonly string[],
): Cell[] {
  const writeableSet = new Set(writeableDates);
  const out: Cell[] = cells.map((c) => ({ ...c }));

  const writeableIdx: number[] = [];
  for (let i = 0; i < out.length; i += 1) {
    const c = out[i];
    if (writeableSet.has(c.event_publisher_date)) {
      writeableIdx.push(i);
    } else {
      out[i] = { ...c, is_writeable: false, CDSpend_NEW: c.CDSpend_current };
    }
  }

  if (writeableIdx.length === 0) {
    for (let i = 0; i < out.length; i += 1) {
      const flags = [...out[i].flags];
      if (!flags.includes("NO_WRITEABLE_CELLS")) flags.push("NO_WRITEABLE_CELLS");
      out[i] = { ...out[i], flags };
    }
    console.warn("distribute_spend: no writeable cells");
    return out;
  }

  // Step 1: weights
  let totalCdspend = 0;
  for (const i of writeableIdx) totalCdspend += out[i].CDSpend_current;

  if (totalCdspend === 0) {
    const equalW = 1.0 / writeableIdx.length;
    for (const i of writeableIdx) {
      const flags = [...out[i].flags];
      if (!flags.includes("ZERO_SPEND_EQUAL_WEIGHT")) flags.push("ZERO_SPEND_EQUAL_WEIGHT");
      out[i] = { ...out[i], cell_weight: equalW, flags };
    }
  } else {
    for (const i of writeableIdx) {
      out[i] = { ...out[i], cell_weight: out[i].CDSpend_current / totalCdspend };
    }
  }

  // Step 2: initial allocation
  for (const i of writeableIdx) {
    out[i] = { ...out[i], CDSpend_NEW: entityCdspendNew * (out[i].cell_weight ?? 0) };
  }

  // Step 3: re-normalization
  let converged = false;
  const capped = new Set<number>();

  for (let iteration = 0; iteration < MAX_RENORM_ITERATIONS; iteration += 1) {
    let excess = 0.0;
    let newlyCapped = false;

    for (const i of writeableIdx) {
      if (capped.has(i)) continue;
      const c = out[i];
      const ceil = c.CDSpend_ceiling;
      if (ceil !== null && c.CDSpend_NEW !== null && c.CDSpend_NEW > ceil) {
        excess += c.CDSpend_NEW - ceil;
        out[i] = { ...c, CDSpend_NEW: ceil };
        capped.add(i);
        newlyCapped = true;
      }
    }

    if (!newlyCapped) {
      converged = true;
      break;
    }

    const uncapped = writeableIdx.filter((i) => !capped.has(i));
    if (uncapped.length === 0) {
      converged = true;
      break;
    }

    let uncappedTotalW = 0;
    for (const i of uncapped) uncappedTotalW += out[i].cell_weight ?? 0;
    if (uncappedTotalW <= 0) {
      converged = true;
      break;
    }

    for (const i of uncapped) {
      const c = out[i];
      const share = (c.cell_weight ?? 0) / uncappedTotalW;
      out[i] = { ...c, CDSpend_NEW: (c.CDSpend_NEW ?? 0) + excess * share };
    }
  }

  if (!converged) {
    console.warn(`distribute_spend: did not converge after ${MAX_RENORM_ITERATIONS} iterations`);
    for (const i of writeableIdx) {
      const flags = [...out[i].flags];
      if (!flags.includes("INFEASIBLE_DISTRIBUTION")) flags.push("INFEASIBLE_DISTRIBUTION");
      out[i] = { ...out[i], curl_blocked: true, flags };
    }
  }

  return out;
}
