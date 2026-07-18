import type {
  EntityMetadata,
  IndeedEntityStats,
  IndeedRow,
  JobGridRow,
  MarkupGridRow,
  PublisherMetadata,
  TrackingRow,
} from "./tracking";

export type CurlType = "MARKUP" | "MARKDOWN";

export interface Cell {
  publisher_id: string;
  publisher_bid_type: string | null;
  event_publisher_date: string;
  entity_id: string;
  entity_level: string;
  campaign_id: string | null;
  job_group_id: string | null;
  job_id: string | null;
  VPSpend: number;
  MOJOSpend: number;
  CDSpend_current: number;
  CDSpend_NEW: number | null;
  budget_ceiling: number | null;
  metric_ceiling: number | null;
  pacing_ceiling: number | null;
  indeed_ceiling: number | null;
  indeed_spend: number | null;
  indeed_volume: number | null;
  margin_ceiling: number | null;
  CDSpend_ceiling: number | null;
  ideal_spend: number | null;
  markup_current: number | null;
  markup_new: number | null;
  markdown_current: number | null;
  markdown_new: number | null;
  curl_type: CurlType | null;
  is_writeable: boolean;
  curl_blocked: boolean;
  flags: string[];
  Clicks: number;
  Apply_start: number;
  Apply: number;
  cell_weight: number | null;
  goal_targets: Record<string, number> | null;
}

export interface PreviewRow extends Cell {
  entity_name: string | null;
  binding_constraint: string | null;
  spend_delta: number | null;
  spend_delta_pct: number | null;
  markup_delta: number | null;
  job_group_name: string | null;
  campaign_name: string | null;
  job_group_budget: number | null;
}

export interface CurlPayload {
  entityId: string;
  entityLevel: string;
  publisherId: string;
  startDate: string;
  endDate: string;
  reason: string;
  creator: string;
  markup: number | null;
}

export interface ExecutionResult {
  cell_id: string;
  curl_payload: CurlPayload;
  http_status: number | null;
  response_body: string | null;
  success: boolean;
  retry_count: number;
  error_message: string | null;
  timestamp: string;
}

export interface ExecutionSummary {
  total_cells: number;
  cells_written: number;
  cells_failed: number;
  cells_skipped: number;
  results: ExecutionResult[];
  run_timestamp: string;
}

export interface QueryResults {
  current_date: string;
  tracking_data: TrackingRow[];
  entity_metadata: EntityMetadata[];
  publisher_metadata: PublisherMetadata[];
  markup_grid: MarkupGridRow[];
  job_grid: JobGridRow[] | null;
  indeed_stats: IndeedRow[] | null;
  job_ref_mapping_ours: Record<string, string> | null;
  job_ref_mapping_theirs: Record<string, string> | null;
  indeed_entity_stats: IndeedEntityStats[] | null;
  indeed_entity_name_mapping: Record<string, string[]> | null;
  job_lifetime_spend: Record<string, number> | null;
  main_client_id: string | null;
  main_client_budgets: EntityMetadata[] | null;
  main_job_ref_mapping: Record<string, string> | null;
  non_jax_spend: Record<string, number> | null;
}

export function makeCellId(cell: Pick<Cell, "publisher_id" | "event_publisher_date" | "entity_id">): string {
  return `${cell.publisher_id}|${cell.event_publisher_date}|${cell.entity_id}`;
}
