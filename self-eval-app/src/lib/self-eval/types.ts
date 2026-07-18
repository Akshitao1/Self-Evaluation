/* Shared types for the Self-Eval dashboard pipeline.
   Used by both the server (API routes / store / sources) and the client page. */

export type Cat = 'margin' | 'cust' | 'sys' | 'lev';
export type Quarter = 'q1' | 'q2';

/** A detected accomplishment moving through detect → approve → final line item. */
export interface LineItem {
  id: string;
  channel: string; // e.g. "#margin" or "gmeet:Amazon QBR"
  source: 'slack' | 'gmeet' | 'manual' | 'simulated' | 'external';
  text: string; // the raw evidence snippet it was detected from
  cat: Cat;
  title: string;
  impact: string;
  detectedAt?: string; // ISO
  approvedAt?: string; // ISO
}

/** A single Senior-PM competency, its evidence log, live rating, and pipeline suggestions. */
export interface Competency {
  id: string;
  full: string;
  rating: number; // 0..5, rises as proof is added
  evidences: string[];
  /** Pipeline-suggested evidence awaiting the user's approval (one-click accept). */
  suggested: SuggestedEvidence[];
}

export interface SuggestedEvidence {
  id: string;
  text: string;
  source: 'slack' | 'gmeet' | 'external';
  detectedAt?: string;
}

/** The full server-persisted state that the pipeline writes and the dashboard reads. */
export interface DashboardState {
  version: number;
  slackWs: string;
  lastSyncAt: string | null; // ISO of last successful sync
  pending: LineItem[];
  approved: LineItem[];
  levelup: Competency[];
  updatedAt: string; // ISO
}

/** A candidate produced by a source (Slack/gmeet/external), before it becomes a LineItem. */
export interface Candidate {
  channel: string;
  source: LineItem['source'];
  text: string;
  cat: Cat;
  title: string;
  impact: string;
  /** Optional competency evidence this candidate also proves. */
  competencyId?: string;
  competencyEvidence?: string;
}
