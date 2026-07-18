import type { PacingConfig } from "@/lib/server/dm/models/dm-config";

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function isoWeekKey(s: string): string {
  const d = parseYmd(s);
  // ISO week per RFC 3339
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${target.getUTCFullYear()}-${weekNo}`;
}

function biweekKey(d: string, first: string): string {
  const ms = parseYmd(d).getTime() - parseYmd(first).getTime();
  return String(Math.floor(ms / 86_400_000 / 14));
}

function windowPacing(
  dates: string[],
  remainingBudget: number,
  keyFn: (d: string) => string,
): Record<string, number> {
  const groups = new Map<string, string[]>();
  for (const d of dates) {
    const k = keyFn(d);
    const existing = groups.get(k);
    if (existing) existing.push(d);
    else groups.set(k, [d]);
  }
  const totalDays = dates.length;
  const result: Record<string, number> = {};
  for (const [, windowDates] of groups) {
    const daysInWindow = windowDates.length;
    const windowBudget = remainingBudget * (daysInWindow / totalDays);
    const daily = windowBudget / daysInWindow;
    for (const d of windowDates) result[d] = daily;
  }
  return result;
}

export function computePacing(
  entityBudget: number,
  cdspendAllDates: number,
  writeableDates: string[],
  pacingConfig: PacingConfig,
): Record<string, number> {
  if (writeableDates.length === 0) return {};

  if (!pacingConfig.strict) {
    const out: Record<string, number> = {};
    for (const d of writeableDates) out[d] = Number.POSITIVE_INFINITY;
    return out;
  }

  const remainingBudget = entityBudget - cdspendAllDates;
  const remainingDays = Math.max(1, writeableDates.length);

  if (pacingConfig.window === "DAILY") {
    const daily = remainingBudget / remainingDays;
    const out: Record<string, number> = {};
    for (const d of writeableDates) out[d] = daily;
    return out;
  }
  if (pacingConfig.window === "WEEKLY") {
    return windowPacing(writeableDates, remainingBudget, isoWeekKey);
  }
  if (pacingConfig.window === "BIWEEKLY") {
    const first = writeableDates[0];
    return windowPacing(writeableDates, remainingBudget, (d) => biweekKey(d, first));
  }
  throw new Error(`Unsupported pacing window: ${pacingConfig.window}`);
}
