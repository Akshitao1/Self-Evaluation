import type { GoalConfig } from "@/lib/server/dm/models/dm-config";
import type { CurlType } from "@/lib/server/dm/models/cell";

export function resolveCurlType(goals: GoalConfig[]): CurlType {
  for (const g of goals) {
    if (g.goal_type === "JOB_BUDGET") {
      console.log("curl_type=MARKDOWN (triggered by JOB_BUDGET goal)");
      return "MARKDOWN";
    }
  }
  for (const g of goals) {
    if (g.goal_type === "INDEED" && g.entity_level === "JOB") {
      console.log("curl_type=MARKDOWN (triggered by INDEED goal at JOB level)");
      return "MARKDOWN";
    }
  }
  console.log("curl_type=MARKUP (default — no JOB_BUDGET or INDEED-at-JOB goal)");
  return "MARKUP";
}
