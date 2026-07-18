/**
 * Snowflake returns UPPERCASE column names; the executeQuery helper lowercases them.
 * If the target row shape uses mixed-case keys (e.g., VPSpend, MOJOSpend), use this
 * to map lowercased keys back to the canonical names.
 */
export function normalizeRow<T extends object>(
  row: Record<string, unknown>,
  fieldNames: readonly (keyof T)[],
): T {
  const map = new Map<string, keyof T>();
  for (const f of fieldNames) map.set(String(f).toLowerCase(), f);
  const out = {} as T;
  for (const k of Object.keys(row)) {
    const target = map.get(k.toLowerCase());
    if (target) (out as Record<string, unknown>)[target as string] = row[k];
    else (out as Record<string, unknown>)[k] = row[k];
  }
  return out;
}

export function normalizeRows<T extends object>(
  rows: Record<string, unknown>[],
  fieldNames: readonly (keyof T)[],
): T[] {
  return rows.map((r) => normalizeRow<T>(r, fieldNames));
}

/**
 * Coerce a Snowflake DATE/TIMESTAMP value to a YYYY-MM-DD string.
 * The snowflake-sdk for Node returns DATE columns as JS Date objects; calling
 * String() on those produces "Wed Jan 15 2025 ..." which breaks any set/map
 * keyed on YYYY-MM-DD (e.g. writeableDates). Always run dates through this
 * before storing on a typed row.
 */
export function toYmd(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  // Already in YYYY-MM-DD form? keep it. Otherwise try to parse.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}
