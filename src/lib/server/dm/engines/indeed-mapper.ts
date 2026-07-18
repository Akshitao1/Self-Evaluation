import type { IndeedEntityStats, IndeedRow, TrackingRow } from "@/lib/server/dm/models/tracking";

interface EntityAgg {
  clicks: number;
  apply: number;
  jobRefs: Set<string>;
}

function entityIdFor(row: TrackingRow, entityLevel: string): string | null {
  if (entityLevel === "JOB") return row.job_id;
  if (entityLevel === "JOBGROUP") return row.job_group_id;
  if (entityLevel === "CAMPAIGN") return row.campaign_id;
  return row.client_id;
}

function jobRefsFor(row: TrackingRow, mapping: Record<string, string>): Set<string> {
  const refs = new Set<string>();
  if (row.job_ref_number) refs.add(row.job_ref_number);
  if (row.job_id) {
    const reverse: Record<string, string> = {};
    for (const [k, v] of Object.entries(mapping)) reverse[v] = k;
    const ref = reverse[row.job_id];
    if (ref) refs.add(ref);
  }
  return refs;
}

function findIndeedMatches(ourRefs: Set<string>, indeedWithRef: [string, IndeedRow][]): IndeedRow[] {
  const prefixes = [...ourRefs].filter((r) => r);
  if (prefixes.length === 0) return [];
  const matched: IndeedRow[] = [];
  const seen = new Set<IndeedRow>();
  for (const [ref, row] of indeedWithRef) {
    if (prefixes.some((p) => ref.startsWith(p)) && !seen.has(row)) {
      matched.push(row);
      seen.add(row);
    }
  }
  return matched;
}

function aggregateIndeedMetric(rows: IndeedRow[], metric: string): number | null {
  let totalSpend = 0;
  for (const r of rows) totalSpend += r.Spend;
  if (metric === "CPA") {
    let totalApply = 0;
    for (const r of rows) totalApply += r.Apply;
    return totalApply > 0 ? totalSpend / totalApply : null;
  }
  let totalClicks = 0;
  for (const r of rows) totalClicks += r.Clicks;
  return totalClicks > 0 ? totalSpend / totalClicks : null;
}

export interface IndeedCeilingResult {
  ceilings: Record<string, number | null>;
  targets: Record<string, number | null>;
  indeedSpend: Record<string, number>;
  indeedVolume: Record<string, number>;
  flags: string[];
}

export function computeIndeedCeilings(
  ourTracking: TrackingRow[],
  indeedStats: IndeedRow[],
  jobRefMappingOurs: Record<string, string>,
  jobRefMappingTheirs: Record<string, string>,
  matchPct: number,
  indeedMetric: string,
  entityLevel: string,
  matchPctByEntity?: Record<string, number>,
): IndeedCeilingResult {
  const theirsIdToRef: Record<string, string> = {};
  for (const [k, v] of Object.entries(jobRefMappingTheirs)) theirsIdToRef[v] = k;

  const indeedWithRef: [string, IndeedRow][] = [];
  for (const row of indeedStats) {
    let ref = row.job_ref_number;
    if (ref === null && row.job_id !== null) ref = theirsIdToRef[row.job_id] ?? null;
    if (ref !== null) indeedWithRef.push([ref, row]);
  }

  const ourByEntity = new Map<string, EntityAgg>();
  for (const row of ourTracking) {
    const eid = entityIdFor(row, entityLevel);
    if (eid === null) continue;
    let agg = ourByEntity.get(eid);
    if (!agg) {
      agg = { clicks: 0, apply: 0, jobRefs: new Set() };
      ourByEntity.set(eid, agg);
    }
    agg.clicks += row.Clicks;
    agg.apply += row.Apply;
    const refs = jobRefsFor(row, jobRefMappingOurs);
    for (const r of refs) agg.jobRefs.add(r);
  }

  const ceilings: Record<string, number | null> = {};
  const targets: Record<string, number | null> = {};
  const indeedSpendOut: Record<string, number> = {};
  const indeedVolumeOut: Record<string, number> = {};
  const flags: string[] = [];
  const overrides = matchPctByEntity ?? {};

  for (const [eid, agg] of ourByEntity) {
    const effectivePct = overrides[eid] ?? matchPct;
    const matched = findIndeedMatches(agg.jobRefs, indeedWithRef);

    let theirSpend = 0;
    let theirVol = 0;
    for (const r of matched) {
      theirSpend += r.Spend;
      theirVol += indeedMetric === "CPA" ? r.Apply : r.Clicks;
    }
    indeedSpendOut[eid] = theirSpend;
    indeedVolumeOut[eid] = theirVol;

    if (matched.length === 0) {
      ceilings[eid] = null;
      targets[eid] = null;
      flags.push(`NO_INDEED_MATCH:${eid}`);
      continue;
    }

    const indeedMetricValue = aggregateIndeedMetric(matched, indeedMetric);
    if (indeedMetricValue === null) {
      ceilings[eid] = null;
      targets[eid] = null;
      flags.push(`NO_INDEED_MATCH:${eid}`);
      continue;
    }

    const targetMetric = indeedMetricValue * (effectivePct / 100.0);
    const ourVolume = indeedMetric === "CPA" ? agg.apply : agg.clicks;
    targets[eid] = targetMetric;

    if (ourVolume === 0) {
      ceilings[eid] = null;
      flags.push(`ZERO_OUR_VOLUME:${eid}`);
      continue;
    }

    ceilings[eid] = targetMetric * ourVolume;
  }

  console.log(
    `Indeed mapper: ${ourByEntity.size} entities, ` +
      `${Object.values(ceilings).filter((v) => v !== null).length} matched, ` +
      `${Object.values(ceilings).filter((v) => v === null).length} unmatched`,
  );

  return { ceilings, targets, indeedSpend: indeedSpendOut, indeedVolume: indeedVolumeOut, flags };
}

export function computeIndeedCeilingsByEntity(
  ourTracking: TrackingRow[],
  indeedStats: IndeedEntityStats[],
  entityNameMapping: Record<string, readonly string[]>,
  matchPct: number,
  indeedMetric: string,
  entityLevel: string,
  matchPctByEntity?: Record<string, number>,
): IndeedCeilingResult {
  if (entityLevel !== "JOBGROUP" && entityLevel !== "CAMPAIGN") {
    throw new Error(
      `compute_indeed_ceilings_by_entity is only supported at JOBGROUP / CAMPAIGN (got ${JSON.stringify(entityLevel)})`,
    );
  }

  const indeedByCid = new Map<string, IndeedEntityStats>();
  for (const s of indeedStats) indeedByCid.set(s.entity_id, s);

  const ourByEntity = new Map<string, EntityAgg>();
  for (const row of ourTracking) {
    const eid = entityIdFor(row, entityLevel);
    if (eid === null) continue;
    let agg = ourByEntity.get(eid);
    if (!agg) {
      agg = { clicks: 0, apply: 0, jobRefs: new Set() };
      ourByEntity.set(eid, agg);
    }
    agg.clicks += row.Clicks;
    agg.apply += row.Apply;
  }

  const ceilings: Record<string, number | null> = {};
  const targets: Record<string, number | null> = {};
  const indeedSpendOut: Record<string, number> = {};
  const indeedVolumeOut: Record<string, number> = {};
  const flags: string[] = [];
  const overrides = matchPctByEntity ?? {};

  for (const [eid, agg] of ourByEntity) {
    const effectivePct = overrides[eid] ?? matchPct;
    const comparisonIds = entityNameMapping[eid] ?? [];
    const matched = comparisonIds.map((cid) => indeedByCid.get(cid)).filter((s): s is IndeedEntityStats => Boolean(s));

    let theirSpend = 0;
    let theirVol = 0;
    for (const r of matched) {
      theirSpend += r.CDSpend;
      theirVol += indeedMetric === "CPA" ? r.Apply : r.Clicks;
    }
    indeedSpendOut[eid] = theirSpend;
    indeedVolumeOut[eid] = theirVol;

    if (matched.length === 0) {
      ceilings[eid] = null;
      targets[eid] = null;
      flags.push(`NO_INDEED_MATCH:${eid}`);
      continue;
    }

    const indeedMetricValue = theirVol > 0 ? theirSpend / theirVol : null;
    if (indeedMetricValue === null) {
      ceilings[eid] = null;
      targets[eid] = null;
      flags.push(`NO_INDEED_MATCH:${eid}`);
      continue;
    }

    const targetMetric = indeedMetricValue * (effectivePct / 100.0);
    const ourVolume = indeedMetric === "CPA" ? agg.apply : agg.clicks;
    targets[eid] = targetMetric;

    if (ourVolume === 0) {
      ceilings[eid] = null;
      flags.push(`ZERO_OUR_VOLUME:${eid}`);
      continue;
    }

    ceilings[eid] = targetMetric * ourVolume;
  }

  console.log(
    `Indeed mapper (name-mapped): ${ourByEntity.size} entities, ` +
      `${Object.values(ceilings).filter((v) => v !== null).length} matched, ` +
      `${Object.values(ceilings).filter((v) => v === null).length} unmatched`,
  );

  return { ceilings, targets, indeedSpend: indeedSpendOut, indeedVolume: indeedVolumeOut, flags };
}
