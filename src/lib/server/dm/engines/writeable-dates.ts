import type { PastEditConfig } from "@/lib/server/dm/models/dm-config";

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmtYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtYmd(d);
}

function diffDays(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86_400_000);
}

export function resolveWriteableDates(
  pastEditConfig: PastEditConfig,
  currentDate: string,
  startDate: string,
  endDate: string,
): string[] {
  if (startDate > endDate) return [];

  let writeableStart: string;
  if (!pastEditConfig.allow_past_edits) {
    writeableStart = currentDate;
  } else if (pastEditConfig.lookback_days === null || pastEditConfig.lookback_days === undefined) {
    writeableStart = startDate;
  } else {
    const earliest = addDays(currentDate, -pastEditConfig.lookback_days);
    writeableStart = startDate > earliest ? startDate : earliest;
  }

  if (writeableStart > endDate) return [];

  const days = diffDays(writeableStart, endDate) + 1;
  const out: string[] = [];
  for (let i = 0; i < days; i += 1) out.push(addDays(writeableStart, i));
  return out;
}

export function isWriteable(checkDate: string, writeableDates: readonly string[]): boolean {
  return writeableDates.includes(checkDate);
}
