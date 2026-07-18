import type { Cell, CurlType } from "@/lib/server/dm/models/cell";

export const EXTREME_MARKUP_THRESHOLD = -500.0;

function clone(cell: Cell, updates: Partial<Cell>): Cell {
  return { ...cell, ...updates };
}

export function computeMarkup(cell: Cell, curlType: CurlType): Cell {
  const flags = [...cell.flags];
  const updates: Partial<Cell> = {};

  // GUARD 1: ZERO VPSPEND (markup is based on VPSpend / Net Spend)
  if (curlType === "MARKUP" && cell.VPSpend === 0) {
    flags.push("VPSPEND_ZERO");
    return clone(cell, { flags, curl_blocked: true });
  }

  // GUARD 2: NON-WRITEABLE
  if (!cell.is_writeable) {
    flags.push("NOT_WRITEABLE");
    return clone(cell, { flags, curl_blocked: true });
  }

  // GUARD 3: NEGATIVE CDSpend_NEW (flag but continue)
  if (cell.CDSpend_NEW !== null && cell.CDSpend_NEW < 0) {
    flags.push("NEGATIVE_CDSPEND");
  }

  // GUARD: VPSPEND_ZERO for MARKDOWN
  if (curlType === "MARKDOWN" && cell.VPSpend === 0) {
    flags.push("VPSPEND_ZERO");
    return clone(cell, { flags, curl_blocked: true });
  }

  // MAIN COMPUTATION
  let markupNew: number | null = null;
  let markdownNew: number | null = null;

  if (curlType === "MARKUP") {
    if (cell.CDSpend_NEW === null || cell.VPSpend === 0) {
      return clone(cell, { flags, curl_blocked: true });
    }
    markupNew = (cell.CDSpend_NEW / cell.VPSpend - 1.0) * 100.0;
  } else {
    if (cell.CDSpend_NEW === null || cell.CDSpend_NEW === 0) {
      flags.push("ZERO_CDSPEND_NEW");
      return clone(cell, { flags, curl_blocked: true });
    }
    markdownNew = (1.0 - cell.VPSpend / cell.CDSpend_NEW) * 100.0;
  }

  // GUARD 4: NO CHANGE
  if (curlType === "MARKUP") {
    if (cell.markup_current !== null && round2(markupNew!) === round2(cell.markup_current)) {
      flags.push("NO_CHANGE");
      return clone(cell, { flags, curl_blocked: true });
    }
  } else {
    if (cell.markdown_current !== null && round2(markdownNew!) === round2(cell.markdown_current)) {
      flags.push("NO_CHANGE");
      return clone(cell, { flags, curl_blocked: true });
    }
  }

  // GUARD 5: EXTREME MARKUP (raw value before clamp)
  if (curlType === "MARKUP" && markupNew !== null && markupNew < EXTREME_MARKUP_THRESHOLD) {
    flags.push("EXTREME_NEGATIVE_MARKUP");
    updates.curl_blocked = true;
  }

  // GUARD 6: CLAMP RANGE
  if (curlType === "MARKUP") {
    markupNew = Math.max(-100.0, markupNew!);
  } else {
    markdownNew = Math.max(0.0, Math.min(100.0, markdownNew!));
  }

  // GUARD 7: NEGATIVE MARKUP
  if (curlType === "MARKUP" && markupNew! < 0) {
    flags.push("NEGATIVE_MARKUP");
  }

  if (curlType === "MARKUP") updates.markup_new = round2(markupNew!);
  else updates.markdown_new = round2(markdownNew!);

  updates.curl_type = curlType;
  updates.flags = flags;

  return clone(cell, updates);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function computeAllMarkups(cells: Cell[], curlType: CurlType): Cell[] {
  return cells.map((c) => computeMarkup(c, curlType));
}
