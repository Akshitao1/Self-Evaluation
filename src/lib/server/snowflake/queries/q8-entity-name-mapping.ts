import "server-only";
import { executeQuery } from "@/lib/server/snowflake/client";
import { CAMPAIGNS, JOB_GROUPS } from "@/lib/server/snowflake/table-registry";

export type EntityLevel = "JOBGROUP" | "CAMPAIGN";

const TABLE_BY_LEVEL: Record<EntityLevel, string> = {
  JOBGROUP: JOB_GROUPS,
  CAMPAIGN: CAMPAIGNS,
};

export function inClause(prefix: string, values: readonly string[]): { clause: string; params: Record<string, string> } {
  if (values.length === 0) return { clause: "(NULL)", params: {} };
  const placeholders = values.map((_, i) => `%(${prefix}_${i})s`).join(", ");
  const params: Record<string, string> = {};
  values.forEach((v, i) => {
    params[`${prefix}_${i}`] = v;
  });
  return { clause: `(${placeholders})`, params };
}

async function fetchIdName(
  clientId: string,
  entityLevel: EntityLevel,
  filter: { ids?: readonly string[]; names?: readonly string[] },
): Promise<Record<string, string>> {
  const table = TABLE_BY_LEVEL[entityLevel];
  let whereExtra = "";
  const params: Record<string, string> = { client_id: clientId };

  if (filter.ids && !filter.names) {
    const { clause, params: idParams } = inClause("eid", filter.ids);
    whereExtra = `AND id IN ${clause}`;
    Object.assign(params, idParams);
  } else if (filter.names && !filter.ids) {
    const { clause, params: nameParams } = inClause("name", filter.names);
    whereExtra = `AND name IN ${clause}`;
    Object.assign(params, nameParams);
  } else {
    throw new Error("Exactly one of ids or names must be provided");
  }

  const sql = `
SELECT id, name
FROM ${table}
WHERE client_id = %(client_id)s
  ${whereExtra}
`.trim();

  const rows = await executeQuery<{ id: string | null; name: string | null }>(sql, params);
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.id && r.name) out[r.id] = r.name;
  }
  return out;
}

export async function resolveEntityNameMapping(
  ourClientId: string,
  comparisonClientId: string,
  entityLevel: EntityLevel,
  ourEntityIds: Iterable<string>,
): Promise<Record<string, Set<string>>> {
  const ours = [...ourEntityIds].filter(Boolean);
  if (ours.length === 0) {
    console.log(`resolve_entity_name_mapping(${entityLevel}): no our entity ids — skipping`);
    return {};
  }
  const uniqueOurs = [...new Set(ours)].sort();

  const ourIdToName = await fetchIdName(ourClientId, entityLevel, { ids: uniqueOurs });
  if (Object.keys(ourIdToName).length === 0) {
    console.warn(
      `resolve_entity_name_mapping(${entityLevel}): no names resolved for ${uniqueOurs.length} ${entityLevel.toLowerCase()} id(s) under client ${ourClientId}`,
    );
    return {};
  }

  const uniqueNames = [...new Set(Object.values(ourIdToName))].sort();
  const comparisonIdToName = await fetchIdName(comparisonClientId, entityLevel, { names: uniqueNames });
  if (Object.keys(comparisonIdToName).length === 0) {
    console.warn(
      `resolve_entity_name_mapping(${entityLevel}): comparison client ${comparisonClientId} has no ${entityLevel.toLowerCase()} matching names`,
    );
    return {};
  }

  const nameToComparisonIds = new Map<string, Set<string>>();
  for (const [cid, name] of Object.entries(comparisonIdToName)) {
    let set = nameToComparisonIds.get(name);
    if (!set) {
      set = new Set();
      nameToComparisonIds.set(name, set);
    }
    set.add(cid);
  }

  const mapping: Record<string, Set<string>> = {};
  let unmatched = 0;
  for (const [oid, name] of Object.entries(ourIdToName)) {
    const hits = nameToComparisonIds.get(name);
    if (hits) mapping[oid] = new Set(hits);
    else unmatched += 1;
  }

  console.log(
    `resolve_entity_name_mapping(${entityLevel}): ${Object.keys(mapping).length} matched / ${unmatched} unmatched of ${Object.keys(ourIdToName).length} our ids`,
  );
  return mapping;
}
