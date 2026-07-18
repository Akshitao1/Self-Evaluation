export interface GoalConfig {
    goal_type: "BUDGET" | "CPA" | "CPC" | "CPAS" | "JOB_BUDGET" | "INDEED" | "FIXED_MARGIN";
    entity_level: "CLIENT" | "CAMPAIGN" | "JOBGROUP" | "JOB";
    entity_id: string;
    value?: number | null;
    per_entity_values?: Record<string, number> | null;
    budget_level?: "JAX" | "MAIN" | null;
    manual_budget_level?: "CLIENT" | "CAMPAIGN" | "JOBGROUP" | null;
    manual_budget_values?: Record<string, number> | null;
    match_pct?: number | null;
    match_pct_overrides?: Record<string, number> | null;
    indeed_metric?: "CPA" | "CPC" | null;
    comparison_entity_id?: string | null;
    indeed_publisher_name?: string | null;
  }
  
  export interface PacingConfig {
    strict: boolean;
    window?: "DAILY" | "WEEKLY" | "BIWEEKLY" | null;
  }
  
  export interface PastEditConfig {
    allow_past_edits: boolean;
    lookback_days?: number | null;
  }
  
  export interface ExclusionConfig {
    campaign_ids: string[];
    jobgroup_ids: string[];
    job_ids: string[];
    publisher_ids: string[];
  }
  
  export const EMPTY_EXCLUSIONS: ExclusionConfig = {
    campaign_ids: [],
    jobgroup_ids: [],
    job_ids: [],
    publisher_ids: [],
  };
  
  export function exclusionCount(e: ExclusionConfig | null | undefined): number {
    if (!e) return 0;
    return (
      e.campaign_ids.length +
      e.jobgroup_ids.length +
      e.job_ids.length +
      e.publisher_ids.length
    );
  }
  
  export interface DMConfig {
    client_id: string;
    start_date: string;
    end_date: string;
    goals: GoalConfig[];
    pacing_config: PacingConfig;
    past_edit_config: PastEditConfig;
    exclusions: ExclusionConfig;
  }
  
  export interface PublisherEntry {
    publisher_id: string;
    publisher_name: string | null;
    publisher_bid_type: string | null;
  }
  
  export interface PreviewRow {
    publisher_id: string;
    publisher_bid_type: string | null;
    event_publisher_date: string;
    entity_id: string;
    entity_name: string | null;
    entity_level: string;
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
    curl_type: "MARKUP" | "MARKDOWN" | null;
    is_writeable: boolean;
    curl_blocked: boolean;
    flags: string[];
    Clicks: number;
    Apply_start: number;
    Apply: number;
    binding_constraint: string | null;
    spend_delta: number | null;
    spend_delta_pct: number | null;
    markup_delta: number | null;
    goal_targets: Record<string, number> | null;
    job_group_id: string | null;
    job_group_name: string | null;
    job_id: string | null;
    campaign_id: string | null;
    campaign_name: string | null;
    job_group_budget: number | null;
  }
  
  export interface ExecutionResult {
    cell_id: string;
    http_status: number | null;
    success: boolean;
    retry_count: number;
    error_message: string | null;
  }
  
  export interface ExecutionSummary {
    total_cells: number;
    cells_written: number;
    cells_failed: number;
    cells_skipped: number;
    results: ExecutionResult[];
    run_timestamp: string;
  }
  
  export interface EntityInfo {
    entity_id: string;
    entity_name: string | null;
    budget: number | null;
    budget_cap_frequency: string | null;
    cpa: number | null;
    cpc: number | null;
  }
  
  export interface ExecuteRequest extends DMConfig {
    confirm_extreme_markup: boolean;
    client_name?: string | null;
    agency_id?: string | null;
    agency_name?: string | null;
    client_status?: string | null;
    saved_config_id?: string | null;
    executed_by_email?: string | null;
    executed_by_name?: string | null;
  }
  
  export interface ClientCatalogEntry {
    client_id: string;
    client_name: string;
    agency_id: string | null;
    agency_name: string | null;
    status: string | null;
  }
  
  export interface ClientMeta {
    client_id: string;
    client_name: string;
    agency_id: string | null;
    agency_name: string | null;
    status: string | null;
  }
  
  export interface SavedConfigListItem {
    id: string;
    label: string;
    client_id: string;
    client_name: string;
    agency_id: string | null;
    agency_name: string | null;
    status: string | null;
    created_at: string;
    updated_at: string;
  }
  
  export interface SavedConfig extends SavedConfigListItem {
    config: DMConfig;
  }
  
  export interface ExecutionHistoryListItem {
    id: string;
    saved_config_id: string | null;
    client_id: string;
    client_name: string;
    agency_id: string | null;
    agency_name: string | null;
    status: string | null;
    summary: Record<string, number | string | null>;
    executed_by_email: string | null;
    executed_by_name: string | null;
    executed_at: string;
  }

  export interface ExecutionPayloadRecord {
    cell_id: string;
    curl_type: "MARKUP" | "MARKDOWN" | null;
    http_status: number | null;
    success: boolean;
    body: Record<string, unknown>;
  }

  export interface ExecutionHistoryItem extends ExecutionHistoryListItem {
    config: DMConfig;
    payloads?: ExecutionPayloadRecord[];
  }
  