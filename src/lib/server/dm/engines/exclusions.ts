import type { Cell } from "@/lib/server/dm/models/cell";
import type { ExclusionConfig } from "@/lib/server/dm/models/dm-config";

/**
 * Apply user-defined exclusions AFTER compute. Matched cells are reverted to
 * their current markup values, marked curl_blocked, and stamped with
 * EXCLUDED_BY_USER + a per-reason flag (EXCLUDED_PUBLISHER / _CAMPAIGN /
 * _JOBGROUP / _JOB). Preview still shows what *would have* happened.
 */
export function applyExclusions(cells: Cell[], exclusions: ExclusionConfig): Cell[] {
  const pubSet = new Set(exclusions.publisher_ids);
  const campSet = new Set(exclusions.campaign_ids);
  const jgSet = new Set(exclusions.jobgroup_ids);
  const jobSet = new Set(exclusions.job_ids);

  if (pubSet.size === 0 && campSet.size === 0 && jgSet.size === 0 && jobSet.size === 0) {
    return cells;
  }

  return cells.map((cell) => {
    const reasons: string[] = [];
    if (pubSet.has(cell.publisher_id)) reasons.push("EXCLUDED_PUBLISHER");
    if (cell.campaign_id && campSet.has(cell.campaign_id)) reasons.push("EXCLUDED_CAMPAIGN");
    if (cell.job_group_id && jgSet.has(cell.job_group_id)) reasons.push("EXCLUDED_JOBGROUP");
    if (cell.job_id && jobSet.has(cell.job_id)) reasons.push("EXCLUDED_JOB");

    if (reasons.length === 0) return cell;

    const flags = [...cell.flags];
    if (!flags.includes("EXCLUDED_BY_USER")) flags.push("EXCLUDED_BY_USER");
    for (const r of reasons) if (!flags.includes(r)) flags.push(r);

    return {
      ...cell,
      flags,
      curl_blocked: true,
      is_writeable: false,
      // Revert to current values so the preview reflects "no change" intent.
      markup_new: cell.markup_current,
      markdown_new: cell.markdown_current,
      CDSpend_NEW: cell.CDSpend_current,
    };
  });
}
