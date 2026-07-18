import type { DashboardState, LineItem, Competency } from './types';

/* Initial content for the pipeline. Q1 (Jan–Jul) is curated static content that
   lives in the page; the store only owns the Q2 pipeline queue + Level Up log. */

const SEED_PENDING: LineItem[] = [
  {
    id: 'p1',
    channel: '#supply-eng',
    source: 'slack',
    text: 'Supply Repo UI v1 deployed to staging — first queryable screens are live for the team to test.',
    cat: 'sys',
    title: 'Supply Repo — Product UI (v1)',
    impact: 'Moved the Supply Repo Brain from a knowledge base toward a usable product.',
  },
  {
    id: 'p2',
    channel: '#cs-amazon',
    source: 'slack',
    text: 'Akshita led the Amazon QBR today and walked the client through the Job Scoring roadmap herself.',
    cat: 'cust',
    title: 'Led the Amazon QBR',
    impact: 'Owned a strategic-account customer call end-to-end.',
  },
  {
    id: 'p3',
    channel: '#margin',
    source: 'slack',
    text: 'DM auto-adoption crossed 40 clients this month with zero manual onboarding sheets.',
    cat: 'margin',
    title: 'DM Adoption at 40+ clients',
    impact: 'Scaled margin automation to 40+ clients with no manual sheets.',
  },
  {
    id: 'p4',
    channel: 'gmeet:Product Sync',
    source: 'gmeet',
    text: 'Kudos to Akshita for onboarding the new PM and running their first KT session.',
    cat: 'lev',
    title: 'Onboarded & KT’d the new PM',
    impact: 'Grew the team by ramping a new PM independently.',
  },
];

/* The 14 Senior-PM competencies, worded exactly as provided. */
const SEED_LEVELUP: Omit<Competency, 'suggested'>[] = [
  {
    id: 'c1',
    full: 'Handle product features autonomously; might oversee a team of 1–2',
    rating: 4,
    evidences: [
      'Owned end-to-end — DM Tool, Event Ingestion Tool, Amazon Dashboard & Initial Bid Recommendation: spec → formulas/QA → release → docs',
      'Directed work for Bhavya (Analyst) and Kaushik (Intern)',
    ],
  },
  {
    id: 'c2',
    full: 'Managing multiple initiatives with efficiency across teams; drives best practices; enables team productivity',
    rating: 4,
    evidences: [
      'Ran DM Tool, Event Ingestion, Amazon Dashboard, Bidding Engine, Supply Repo & DM Adoption in parallel across CS, Eng & Sales',
      'Ran 5 PRDs in parallel',
      'Media-plan skill is now the team standard',
    ],
  },
  {
    id: 'c3',
    full: 'Independently able to define and deliver outcomes',
    rating: 4,
    evidences: ['Event Ingestion & Amazon Dashboard shipped independently'],
  },
  {
    id: 'c4',
    full: 'Analyzes complex issues; develops innovative solutions with long-term impact; takes right decisions autonomously',
    rating: 4,
    evidences: [
      'Supply Repo initiative — reused Harsh’s ACS to unblock it',
      'Unblocked the Amazon WFS flow problem',
      'Hoops & RSR DM solution; Adecco DM solution; DM Tool',
      'Social Event Ingestion solution',
    ],
  },
  {
    id: 'c5',
    full: 'Influences design thinking; integrates user feedback into impactful experience improvements',
    rating: 3.5,
    evidences: [
      'Designed every product I’ve built end-to-end — DM Tool, Event Ingestion, Amazon Dashboard, Bidding Engine',
      'Preview-before-commit flows + in-product tooltips for CSE self-serve',
      'Job Scoring turned raw tables into per-job diagnostics',
    ],
  },
  {
    id: 'c6',
    full: 'Builds product strategy with clear vision, market & customer alignment',
    rating: 2.5,
    evidences: [
      'Amazon Dashboard: delivered exactly what the customer asked for',
      'Amazon WFS solution aligned to a real customer need',
      'Shaping the Supply Repo & external-user Media Plan productization roadmap',
    ],
  },
  {
    id: 'c7',
    full: 'Deeply understands market insights & competition; leverages insights to shape strategy',
    rating: 2.5,
    evidences: ['Built category-level CPA benchmarks vs market on Staffmark'],
  },
  {
    id: 'c8',
    full: 'Leads customer calls & research; advocates for the customer',
    rating: 3,
    evidences: [
      'Rescued 7–8 external media plans over a weekend',
      'Built Staffmark client objections into deliverables',
    ],
  },
  {
    id: 'c9',
    full: 'Owner of the area roadmap; creates strong prioritisation aligned with stakeholders & strategy',
    rating: 2.5,
    evidences: [
      'Own the DM Tool, Event Ingestion & Amazon Dashboard roadmaps',
      'Coming up: Supply Repo, External Media Plan & Self-Serve (SS) ownership',
    ],
  },
  {
    id: 'c10',
    full: 'Seeks feedback from stakeholders; mentors others while continuously learning',
    rating: 3.5,
    evidences: [
      'Ran KT with Bhavya & Kaushik; mentor while shipping',
      'In constant touch with CSEs and stakeholders — Rochit, Shabs & Adnan',
    ],
  },
  {
    id: 'c11',
    full: 'Drives motivation and alignment within teams; strives to be recognised as a leader',
    rating: 3,
    evidences: ['Held delivery together when the team was down to two'],
  },
  {
    id: 'c12',
    full: 'Develops comprehensive documents, aligning them with strategic goals',
    rating: 4,
    evidences: [
      'PRDs — Dynamic Margin, Supply Repo, Automated Media Plan & Initial Bid Recommendation, plus ACS (built on & extended)',
    ],
  },
  {
    id: 'c13',
    full: 'Fosters cross-functional collaboration; enables shared outcomes; is trusted by stakeholders',
    rating: 3.5,
    evidences: [
      'High-stakes, ambiguous problems route to me across CS, Eng & Sales',
      'Every tool I’ve built was built hand-in-hand with Engineering',
    ],
  },
  {
    id: 'c14',
    full: 'Concisely and confidently communicates with all stakeholders; develops opinions & argues persuasively without being defensive',
    rating: 3.5,
    evidences: [
      'Translated the DM RCA into clear stakeholder messaging; argued from evidence',
    ],
  },
];

export function seedState(nowIso: string): DashboardState {
  return {
    version: 1,
    slackWs: 'Joveo HQ',
    lastSyncAt: null,
    pending: SEED_PENDING.map((p) => ({ ...p })),
    approved: [],
    levelup: SEED_LEVELUP.map((c) => ({
      ...c,
      evidences: [...c.evidences],
      suggested: [],
    })),
    updatedAt: nowIso,
  };
}

/** Competency ids/labels, exposed so sources can map evidence to the right bar. */
export const COMPETENCY_INDEX = SEED_LEVELUP.map((c) => ({
  id: c.id,
  full: c.full,
}));
