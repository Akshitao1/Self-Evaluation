export interface TrackingRow {
  client_id: string;
  publisher_id: string;
  publisher_bid_type: string | null;
  publisher_name: string | null;
  campaign_id: string | null;
  job_group_id: string | null;
  job_ref_number: string | null;
  job_id: string | null;
  event_publisher_date: string;
  VPSpend: number;
  MOJOSpend: number;
  CDSpend: number;
  Clicks: number;
  Apply_start: number;
  Apply: number;
}

export type EntityLevel = "CLIENT" | "CAMPAIGN" | "JOBGROUP" | "JOB";

export interface EntityMetadata {
  entity_id: string;
  entity_level: EntityLevel;
  entity_name: string | null;
  agency_id: string | null;
  effective_budget: number | null;
  budget_threshold_percent: number | null;
  pacing_pct: number | null;
  cpa_goal: number | null;
  cpc_goal: number | null;
  cpas_goal: number | null;
  primary_goal_type: string | null;
  primary_goal_value: number | null;
  budget_cap_frequency: string | null;
  status: string | null;
}

export interface PublisherMetadata {
  publisher_id: string;
  publisher_name: string | null;
  publisher_bid_type: string | null;
}

export interface MarkupGridRow {
  client_id: string;
  publisher_id: string;
  publisher_bid_type: string | null;
  campaign_id: string | null;
  job_group_id: string | null;
  event_publisher_date: string;
  publisher_entity_markdown: number;
  effective_cd_markup: number;
  d_logic_ratio: number;
  VPSpend: number;
  MOJOSpend: number;
  CDSpend: number;
  Clicks: number;
  Apply_start: number;
  Apply: number;
}

export interface JobGridRow {
  client_id: string;
  publisher_id: string;
  publisher_bid_type: string | null;
  campaign_id: string | null;
  job_group_id: string | null;
  job_id: string;
  job_ref_number: string | null;
  event_publisher_date: string;
  effective_cd_markup: number;
  publisher_entity_markdown: number;
  d_logic_ratio: number;
  VPSpend: number;
  MOJOSpend: number;
  CDSpend: number;
  Clicks: number;
  Apply_start: number;
  Apply: number;
}

export interface IndeedRow {
  client_id: string;
  publisher_name: string;
  job_ref_number: string | null;
  job_id: string | null;
  event_publisher_date: string;
  Spend: number;
  Clicks: number;
  Apply_start: number;
  Apply: number;
  CPA: number | null;
  CPC: number | null;
}

export interface JobRefMapping {
  job_ref_number: string;
  job_id: string;
  client_id: string;
}

export interface IndeedEntityStats {
  client_id: string;
  publisher_name: string;
  entity_level: "JOBGROUP" | "CAMPAIGN";
  entity_id: string;
  CDSpend: number;
  Clicks: number;
  Apply_start: number;
  Apply: number;
}
