'use client';

import React, {
  CSSProperties,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  Cat,
  Competency,
  DashboardState,
  LineItem,
  Quarter,
} from '@/lib/self-eval/types';

/* ============================================================================
   Akshita SelfEval Dashboard
   Faithful React reimplementation of "Akshita SelfEval Dashboard.dc.html".
   Standalone page — its own header, tab bar and footer; does not use the
   app shell (sidebar/header).

   The Q2 (Jul–Dec) accomplishments and the Level Up tab are backed by a
   server-side pipeline (/api/self-eval/*): Slack + Meet notes are auto-detected
   into a pending queue that the user approves into final line items, and the
   Level Up log accrues evidence + ratings over time. Q1 is curated static.
   ========================================================================== */

type SlackItem = LineItem;

// ── Palette ──
const PAPER = '#f3f1ea';
const INK = '#12140f';
const CARD = '#fbfaf6';
const BORDER = '#d9d5c8';
const MUTED = '#565448';
const SUBTLE = '#6b6a5f';
const GREEN = '#2f5d50';
const RUST = '#c65d3b';
const BLUE = '#4a6fa5';
const GOLD = '#b8892b';

// ── Fonts ──
const SERIF = "'Fraunces',serif";
const SANS = "'Space Grotesk',system-ui,sans-serif";
const MONO = "'IBM Plex Mono',monospace";

// ── Category metadata ──
const CAT_INFO: Record<Cat, { label: string; bg: string; color: string }> = {
  margin: { label: 'Margin', bg: '#e3ede9', color: GREEN },
  cust: { label: 'Customer', bg: '#f6e4dc', color: RUST },
  sys: { label: 'Systems', bg: '#e2e9f2', color: BLUE },
  lev: { label: 'Leverage', bg: '#f3ead2', color: GOLD },
};

function ratingMeta(r: number) {
  if (r < 2) return { label: 'Emerging', bg: '#eceae1', color: '#8a8779' };
  if (r < 3) return { label: 'Developing', bg: '#f6e4dc', color: RUST };
  if (r < 4) return { label: 'Proficient', bg: '#f3ead2', color: '#a67d26' };
  if (r < 4.5) return { label: 'Strong', bg: '#e2e9f2', color: BLUE };
  return { label: 'Leading', bg: '#e3ede9', color: GREEN };
}

/** Human-readable "last synced" from an ISO timestamp. */
function formatSync(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Types ──
type Tab = 'accomplishments' | 'strengths' | 'improvement' | 'levelup';


// ── Count-up number (used for Q1 metrics present at load) ──
function CountUp({
  target,
  decimals = 0,
  style,
}: {
  target: number;
  decimals?: number;
  style?: CSSProperties;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setVal(target);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const dur = 1200;
    const step = (now: number) => {
      if (start === null) start = now;
      const p = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(target * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <div style={style}>{val.toFixed(decimals)}</div>;
}

// ── Shared style fragments ──
const cardBase: CSSProperties = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: '22px 22px 20px',
  transition:
    'opacity .55s cubic-bezier(.23,1,.32,1),transform .3s cubic-bezier(.23,1,.32,1),box-shadow .3s cubic-bezier(.23,1,.32,1),filter .3s ease',
};

const tagStyle = (bg: string, color: string): CSSProperties => ({
  fontFamily: MONO,
  fontSize: 10.5,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  padding: '3px 9px',
  borderRadius: 20,
  display: 'inline-block',
  marginBottom: 14,
  background: bg,
  color,
});

const arrowRow = (dashed: string): CSSProperties => ({
  marginTop: 14,
  paddingTop: 13,
  borderTop: `1px dashed ${dashed}`,
  fontSize: 13.5,
  fontWeight: 500,
  display: 'flex',
  gap: 8,
  alignItems: 'flex-start',
});

function Divider({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        margin: '30px 0 14px',
      }}
    >
      <span
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          color,
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: '#e0dccf' }} />
    </div>
  );
}

// A "work" card (products / leverage / ownership sections)
interface WorkCard {
  cat: Cat;
  tag: { label: string; bg: string; color: string };
  title: string;
  titleSize?: number;
  fullWidth?: boolean;
  lines: ReactNode[]; // body lines (e.g. Built:/How:)
  arrow: ReactNode;
}

function WorkCardView({
  card,
  visible,
}: {
  card: WorkCard;
  visible: boolean;
}) {
  const dashed = card.fullWidth ? '#e2c6b8' : BORDER;
  const style: CSSProperties = {
    ...cardBase,
    ...(card.fullWidth
      ? {
          gridColumn: '1/-1',
          background: 'linear-gradient(180deg,#f9efe9,#fbf7f3)',
          border: '1px solid #e2c6b8',
        }
      : null),
    opacity: visible ? 1 : 0.22,
    filter: visible ? 'none' : 'grayscale(.5)',
  };
  return (
    <div data-anim="" data-hovercard="" data-cat={card.cat} style={style}>
      <span style={tagStyle(card.tag.bg, card.tag.color)}>{card.tag.label}</span>
      <h3
        style={{
          fontFamily: SERIF,
          fontWeight: 600,
          fontSize: card.titleSize ?? 21,
          lineHeight: 1.12,
          marginBottom: 12,
          letterSpacing: '-.01em',
        }}
      >
        {card.title}
      </h3>
      {card.lines.map((ln, i) => (
        <div
          key={i}
          style={{ fontSize: 13.5, color: MUTED, marginBottom: 5 }}
        >
          {ln}
        </div>
      ))}
      <div style={arrowRow(dashed)}>
        <span style={{ color: RUST, fontWeight: 700, flexShrink: 0 }}>→</span>
        <span>{card.arrow}</span>
      </div>
    </div>
  );
}

const bold = (t: string) => (
  <b style={{ color: INK, fontWeight: 600 }}>{t}</b>
);
const builtLine = (t: string) => (
  <>
    {bold('Built:')} {t}
  </>
);

// ── Q1 content data ──
const PRODUCTS: WorkCard[] = [
  {
    cat: 'margin',
    tag: { label: 'Margin · flagship', bg: '#e3ede9', color: GREEN },
    title: 'Dynamic Margin (DM) Tool',
    lines: [
      builtLine(
        'self-serve margin rules across 6 goal types, preview-before-commit, direct execution. Owned spec, formulas, QA, release, docs.',
      ),
    ],
    arrow: 'Team closes month-end numbers on time; CSEs save hours every cycle.',
  },
  {
    cat: 'margin',
    tag: { label: 'Margin · long-pending fix', bg: '#e3ede9', color: GREEN },
    title: 'Event Ingestion Tool',
    lines: [
      builtLine(
        'self-serve preview + direct curl execution with configurable lookback windows.',
      ),
      <>
        {bold('Live:')}{' '}
        <a
          href="https://event-ingestion.coder.prod.joveo.com/event-ingestion"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: BLUE, borderBottom: '1px solid #c3d0e3' }}
        >
          event-ingestion.coder.prod.joveo.com
        </a>
      </>,
    ],
    arrow: 'Resolved a long-standing social margin issue no one had closed.',
  },
  {
    cat: 'sys',
    tag: {
      label: 'Client-facing · strategic account',
      bg: '#e2e9f2',
      color: BLUE,
    },
    title: 'Amazon Dashboard',
    lines: [
      builtLine(
        'consolidated client performance dashboard for a top strategic account, with external-user access, domain & SSO config.',
      ),
    ],
    arrow: 'One client-usable surface shipped for Amazon.',
  },
  {
    cat: 'cust',
    tag: {
      label: 'Feature · inside Amazon Dashboard',
      bg: '#f6e4dc',
      color: RUST,
    },
    title: 'Job Scoring',
    lines: [
      builtLine(
        'a job-level scoring view that grades each job on performance and surfaces how to improve it — an actionable per-job diagnostic, not raw tables.',
      ),
    ],
    arrow: 'Gives the client a clear "what to fix" signal per job.',
  },
  {
    cat: 'sys',
    tag: { label: 'Bidding · data systems', bg: '#e2e9f2', color: BLUE },
    title: 'Bidding Recommendation Engine v3.3',
    lines: [
      builtLine(
        '18-CTE Snowflake pipeline — specificity waterfall (JG>campaign>client>agency), symmetric clamping, CPA-conflict diagnostics, confidence scoring.',
      ),
    ],
    arrow: 'Production-grade bid guidance with built-in guardrails.',
  },
];

const LEVERAGE: WorkCard[] = [
  {
    cat: 'lev',
    fullWidth: true,
    tag: {
      label: 'Org problem closed · resourceful reuse',
      bg: '#f3ead2',
      color: GOLD,
    },
    title: 'Supply Repo Brain',
    titleSize: 24,
    lines: [
      builtLine(
        'a structured, queryable supply-repository knowledge base — a long-pending, high-value Joveo problem.',
      ),
      <>
        {bold('How:')} took{' '}
        {bold("Harsh's earlier ACS (Application Complexity Score) work")}, built
        on it, and repurposed it to solve the Supply Repo problem — turning
        stalled work into the backbone of a delivered product.
      </>,
    ],
    arrow: 'Drove a long-open org item to delivery by reusing existing work.',
  },
  {
    cat: 'lev',
    tag: { label: 'Team leverage · adopted', bg: '#f3ead2', color: GOLD },
    title: 'Media-Plan Skill',
    lines: [builtLine('packaged my media-plan methodology into a reusable skill.')],
    arrow: 'Shared with Shabarish & Rochit — now the standard for external media plans.',
  },
  {
    cat: 'lev',
    tag: { label: 'Team enablement', bg: '#f3ead2', color: GOLD },
    title: 'CSE Enablement Skills',
    lines: [
      builtLine(
        'shared custom skills with the CSE team to use Claude effectively day-to-day.',
      ),
    ],
    arrow: "Raised the whole team's productivity baseline.",
  },
  {
    cat: 'margin',
    tag: { label: 'Automation · scaled adoption', bg: '#f3ead2', color: GOLD },
    title: 'DM Adoption Automation',
    lines: [
      builtLine(
        'moved margin onboarding from manual per-client sheets to a code-driven process with a CSE view.',
      ),
    ],
    arrow: 'Made margin adoption scalable instead of manual.',
  },
];

const OWNERSHIP: WorkCard[] = [
  {
    cat: 'cust',
    fullWidth: true,
    tag: { label: 'Customer save · weekend', bg: '#f6e4dc', color: RUST },
    title: '7–8 external-customer media plans, delivered on a Sunday',
    titleSize: 24,
    lines: [
      'When another owner missed the handoff and the customer needed the plans urgently, I turned around the full set over a weekend — protecting the relationships and the commitment.',
    ],
    arrow: 'Prevented a customer-facing miss across 7–8 external accounts.',
  },
  {
    cat: 'cust',
    tag: { label: 'Ownership under pressure', bg: '#f6e4dc', color: RUST },
    title: 'Held the line when the team was down to two',
    lines: [
      'During a stretch when everyone on our team except my manager (Adnan) and me was unavailable, I took up ownership across surfaces and kept delivery and stakeholder commitments moving.',
    ],
    arrow: "Delivery didn't stall despite the team being cut to two.",
  },
  {
    cat: 'sys',
    tag: { label: '5 PRDs completed', bg: '#e2e9f2', color: BLUE },
    title: 'PRDs authored this period',
    lines: [
      'Dynamic Margin · Supply Repo · Automated Media Plan · Initial Bid Recommendation — each taken from problem framing through structured spec and stakeholder review. Plus ACS, where I built on Harsh’s existing work and extended it.',
    ],
    arrow: 'A documented pipeline aligned to strategy, not one-offs.',
  },
  {
    cat: 'lev',
    tag: { label: 'Knowledge transfer · mentoring', bg: '#f3ead2', color: GOLD },
    title: 'KT with Bhavya & Kaushik',
    lines: [
      'Ran knowledge transfer and directed work for Bhavya (Product Analyst) and Kaushik (Intern) on our team — delegating, verifying outcomes, and unblocking them to contribute independently.',
    ],
    arrow: "Grew the team's capacity, not just my own output.",
  },
];

const APPROACH: { title: string; body: ReactNode }[] = [
  {
    title: 'I solve the class of problem, not the instance',
    body: (
      <>
        A single-client Hoops HR ask became a {bold('reusable engine')} for
        every similar client. A margin request I could have done by hand became
        the {bold('DM Tool')} the whole team now uses. I default to asking "how
        does this stop happening for everyone?"
      </>
    ),
  },
  {
    title: 'I reuse before I rebuild',
    body: (
      <>
        When Supply Repo stalled for want of a scoring signal, I built on{' '}
        {bold("Harsh's existing ACS work")} and repurposed it as the backbone —
        extending stalled work into a delivered product instead of starting
        over.
      </>
    ),
  },
  {
    title: 'I take initiative on the unowned problems',
    body: (
      <>
        The long-pending social margin issue, the Supply Repo backlog, the 7–8
        media plans another owner dropped — I stepped into problems that were
        nobody's clear job, rather than waiting to be assigned.
      </>
    ),
  },
  {
    title: 'I ground decisions in data, then defend them',
    body: (
      <>
        Every call traces back to numbers — the {bold('DM RCA')} (margin lift
        derived and defended line-by-line), category-level CPA benchmarks on
        Staffmark, root-causing the UNION spend bug. I show the math and argue
        from evidence.
      </>
    ),
  },
  {
    title: 'I build for adoption, not just for ship',
    body: (
      <>
        Preview-before-commit flows, in-product tooltips so CSEs self-serve,
        user guides and a video walkthrough — I treat "will people actually use
        it correctly?" as part of the product, not an afterthought.
      </>
    ),
  },
  {
    title: "I turn my output into the team's capability",
    body: (
      <>
        The media-plan skill (now Shabarish & Rochit's standard), CSE skills,
        and KT with Bhavya & Kaushik — I'd rather teach a repeatable method than
        be the single point of delivery.
      </>
    ),
  },
];

const STRENGTHS: { title: string; body: string }[] = [
  {
    title: 'Autonomous end-to-end ownership',
    body: 'Take features from definition through spec, handoff, QA and release with minimal oversight — DM, Event Ingestion, Amazon Dashboard, Bidding Engine.',
  },
  {
    title: 'Turning work into team leverage',
    body: "Build assets others reuse — media-plan skill, CSE skills, Supply Repo Brain, DM automation — lifting the team's output, not just mine.",
  },
  {
    title: 'Technical depth + product judgment',
    body: 'Fluent in Snowflake SQL, formula design and RCA, paired with PRDs, phased rollouts and build gates — design the system and defend it with data.',
  },
  {
    title: 'Resourcefulness',
    body: "Reuse what exists rather than rebuild — built on Harsh's ACS work to power the Supply Repo Brain.",
  },
  {
    title: 'Ownership under pressure',
    body: 'The Sunday rescue and holding delivery together when the team was down to two reflect a default of stepping in rather than waiting.',
  },
  {
    title: 'Customer advocacy & communication',
    body: 'Translate data-heavy analysis into clear stakeholder messaging (DM RCA), build client objections into deliverables (Staffmark), argue from evidence without going defensive.',
  },
  {
    title: 'Cross-functional trust',
    body: 'High-stakes, ambiguous problems route to me across CS, eng and sales — and peers adopt what I build.',
  },
  {
    title: 'Enabling others',
    body: 'Mentor by teaching repeatable methods — KT with Bhavya & Kaushik, skills shared team-wide.',
  },
];

const IMPROVEMENTS: { title: string; body: string }[] = [
  {
    title: 'Lock requirements & written framing earlier',
    body: 'On a few initiatives, scope firmed up mid-execution and drove avoidable rework. Pushing alignment and written scope further upfront.',
  },
  {
    title: 'Scale through delegation, not absorption',
    body: "Stepping in under pressure is a strength, but as scope grows I need to lean more on delegation and enablement so delivery doesn't depend on my bandwidth.",
  },
  {
    title: 'Balance breadth with depth',
    body: 'Running many initiatives is a strength, but I want to be sharper about protecting focus on the highest-leverage one or two at a time.',
  },
];

const COMING_FOCUS: { title: string; body: string }[] = [
  {
    title: 'Supply Repo — Product UI',
    body: 'Take the Supply Repo Brain from a knowledge base to a proper product with a usable UI.',
  },
  {
    title: 'External Media Plan — UI',
    body: 'Productize the media-plan methodology (already a shared skill) into a UI for external customers.',
  },
  {
    title: 'Take up SS ownership',
    body: 'Step into ownership of the Self-Serve (SS) area.',
  },
];

// ── Filter chip ──
type Filter = 'all' | Cat;
const FILTERS: { key: Filter; label: string; dot?: string }[] = [
  { key: 'all', label: 'All work' },
  { key: 'margin', label: 'Margin', dot: GREEN },
  { key: 'cust', label: 'Customer', dot: RUST },
  { key: 'sys', label: 'Systems', dot: BLUE },
  { key: 'lev', label: 'Leverage', dot: GOLD },
];

// ============================================================================
export default function SelfEvalDashboard() {
  const [tab, setTab] = useState<Tab>('accomplishments');
  const [quarter, setQuarter] = useState<Quarter>('q1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const progressRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Server-backed pipeline state (Q2 approval queue + Level Up evidence log).
  // A background sync (Slack/Meet → /api/self-eval/sync) writes here, so the
  // dashboard reflects auto-detected work on load, not just this browser.
  const { data: state } = useQuery<DashboardState>({
    queryKey: ['self-eval'],
    queryFn: async () => {
      const r = await fetch('/api/self-eval/state');
      if (!r.ok) throw new Error('failed to load self-eval state');
      return r.json();
    },
    staleTime: 10_000,
  });

  const setServerState = (s: DashboardState) =>
    qc.setQueryData(['self-eval'], s);

  const action = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch('/api/self-eval/state', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('action failed');
      return r.json() as Promise<DashboardState>;
    },
    onSuccess: setServerState,
  });

  const sync = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/self-eval/sync', { method: 'POST' });
      if (!r.ok) throw new Error('sync failed');
      return r.json() as Promise<{
        state: DashboardState;
        added: number;
        suggestions: number;
        mode: string;
      }>;
    },
    onSuccess: (res) => setServerState(res.state),
  });

  const pending = state?.pending ?? [];
  const approved = state?.approved ?? [];
  const levelup = state?.levelup ?? [];
  const slackWs = state?.slackWs ?? 'Joveo HQ';
  const lastSync = formatSync(state?.lastSyncAt ?? null);
  const syncing = sync.isPending;

  // Reading progress bar
  useEffect(() => {
    const onScroll = () => {
      const de = document.documentElement;
      const sc = window.scrollY || de.scrollTop || 0;
      const max = de.scrollHeight - de.clientHeight;
      if (progressRef.current) {
        progressRef.current.style.width =
          (max > 0 ? (sc / max) * 100 : 0) + '%';
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Actions (all go through the server so the store stays the source of truth) ──
  const approve = (id: string) => action.mutate({ action: 'approve', id });
  const dismiss = (id: string) => action.mutate({ action: 'dismiss', id });
  const syncNow = () => sync.mutate();
  const saveEdit = (id: string, patch: Partial<SlackItem>) => {
    action.mutate({
      action: 'edit',
      id,
      title: patch.title,
      impact: patch.impact,
      cat: patch.cat,
    });
    setEditingId(null);
  };
  const setRating = (id: string, delta: number) =>
    action.mutate({ action: 'setRating', id, delta });
  const addEvidence = (id: string, text: string) => {
    if (text.trim()) action.mutate({ action: 'addEvidence', id, text });
  };
  const approveSuggestion = (competencyId: string, suggestionId: string) =>
    action.mutate({ action: 'approveSuggestion', competencyId, suggestionId });
  const dismissSuggestion = (competencyId: string, suggestionId: string) =>
    action.mutate({ action: 'dismissSuggestion', competencyId, suggestionId });

  const avg =
    levelup.reduce((a, c) => a + c.rating, 0) / (levelup.length || 1);
  const overallPct = Math.round((avg / 5) * 100);
  const overallRating = (Math.round(avg * 10) / 10).toString();

  const isVisible = (cat: Cat) => filter === 'all' || cat === filter;

  return (
    <div
      style={{
        background: PAPER,
        color: INK,
        minHeight: '100vh',
        fontFamily: SANS,
        lineHeight: 1.5,
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Fonts + effect styles (hoisted to <head> by React 19) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <style>{`
        [data-anim]{opacity:1;transform:none;transition:opacity .6s cubic-bezier(.23,1,.32,1),transform .6s cubic-bezier(.23,1,.32,1)}
        @starting-style{[data-anim]{opacity:0;transform:translateY(14px)}}
        [data-tab-btn],[data-filter],[data-seg],[data-btn]{transition:color .18s ease,background .18s ease,border-color .18s ease,transform .12s cubic-bezier(.23,1,.32,1)}
        [data-tab-btn]:active,[data-seg]:active{transform:scale(.97)}
        [data-filter]:active,[data-btn]:active{transform:scale(.96)}
        @media (hover:hover) and (pointer:fine){
          [data-hovercard]:hover{transform:translateY(-3px);box-shadow:0 16px 34px -20px rgba(18,20,15,.45)}
          [data-tab-btn]:hover{color:#12140f}
          [data-btn]:hover{filter:brightness(1.06)}
        }
        @media (prefers-reduced-motion: reduce){
          [data-anim]{transition:none}
          [data-hovercard]:hover{transform:none}
        }
        @media print{
          *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
          [data-anim]{opacity:1 !important;transform:none !important}
          [data-tabbar],[data-progresswrap],[data-noprint]{display:none !important}
          [data-hovercard]{break-inside:avoid}
        }
        .se-input:focus,.se-textarea:focus,.se-select:focus{border-color:#4a6fa5}
      `}</style>

      {/* Reading progress */}
      <div
        data-progresswrap=""
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'rgba(18,20,15,.05)',
          zIndex: 60,
        }}
      >
        <div
          ref={progressRef}
          style={{
            height: '100%',
            width: 0,
            background: 'linear-gradient(90deg,#2f5d50,#4a6fa5,#c65d3b)',
            transition: 'width .1s linear',
          }}
        />
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 28px 90px' }}>
        {/* ── Header ── */}
        <header style={{ padding: '64px 0 34px', borderBottom: `2px solid ${INK}` }}>
          <div
            data-anim=""
            style={{
              fontFamily: MONO,
              fontSize: 12,
              letterSpacing: '.22em',
              textTransform: 'uppercase',
              color: SUBTLE,
              marginBottom: 22,
            }}
          >
            Self-Evaluation · Performance · Joveo
          </div>
          <h1
            data-anim=""
            style={{
              fontFamily: SERIF,
              fontWeight: 600,
              fontSize: 'clamp(38px,6vw,72px)',
              lineHeight: 1.02,
              letterSpacing: '-.025em',
              marginBottom: 8,
              textWrap: 'balance',
            }}
          >
            Akshita Kharbanda
          </h1>
          <p
            data-anim=""
            style={{
              fontSize: 'clamp(15px,2vw,19px)',
              color: MUTED,
              maxWidth: 640,
              marginBottom: 28,
            }}
          >
            Product Manager — {bold('Joveo')}. Margin, bidding &amp; automation
            products across CS, Engineering &amp; Sales. {bold('Aspiring to Senior PM.')}
          </p>
          <p
            data-anim=""
            style={{
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontSize: 'clamp(20px,2.6vw,30px)',
              lineHeight: 1.25,
              maxWidth: 720,
              color: GREEN,
              textWrap: 'pretty',
            }}
          >
            This half I moved from shipping products
            <br />
            to{' '}
            <span style={{ color: RUST, fontStyle: 'normal', fontWeight: 600 }}>
              building leverage
            </span>{' '}
            — and stepped up on ownership when the team was down to two.
          </p>
        </header>

        {/* ── Tab bar ── */}
        <div
          data-tabbar=""
          style={{
            position: 'sticky',
            top: 2,
            zIndex: 40,
            background: PAPER,
            padding: '14px 0 0',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              borderBottom: '1px solid #d9d5c8',
            }}
          >
            {(
              [
                ['accomplishments', 'Accomplishments'],
                ['strengths', 'Strengths'],
                ['improvement', 'Areas for Improvement'],
                ['levelup', '↗ Level Up'],
              ] as [Tab, string][]
            ).map(([key, label]) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  data-tab-btn=""
                  onClick={() => setTab(key)}
                  style={{
                    appearance: 'none',
                    background: 'none',
                    border: 'none',
                    borderBottom: `2px solid ${active ? RUST : 'transparent'}`,
                    marginBottom: -1,
                    padding: '12px 18px',
                    fontFamily: MONO,
                    fontSize: 12,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    color: active ? INK : '#9a978c',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── ACCOMPLISHMENTS ── */}
        {tab === 'accomplishments' && (
          <section style={{ marginTop: 36 }}>
            <div
              data-anim=""
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                paddingBottom: 14,
                borderBottom: '1px solid #d9d5c8',
                marginBottom: 20,
              }}
            >
              <span
                style={{
                  fontFamily: SERIF,
                  fontWeight: 600,
                  fontSize: 'clamp(22px,3vw,30px)',
                  letterSpacing: '-.02em',
                }}
              >
                Accomplishments
              </span>
              <div
                style={{
                  display: 'inline-flex',
                  background: '#eceae1',
                  border: '1px solid #d9d5c8',
                  borderRadius: 22,
                  padding: 3,
                }}
              >
                {(
                  [
                    ['q1', 'Jan – Jul 2026'],
                    ['q2', 'Jul – Dec 2026'],
                  ] as [Quarter, string][]
                ).map(([q, label]) => {
                  const active = quarter === q;
                  return (
                    <button
                      key={q}
                      data-seg=""
                      onClick={() => setQuarter(q)}
                      style={{
                        appearance: 'none',
                        border: 'none',
                        borderRadius: 20,
                        padding: '7px 15px',
                        fontFamily: MONO,
                        fontSize: 11,
                        letterSpacing: '.06em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        background: active ? INK : 'transparent',
                        color: active ? PAPER : SUBTLE,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {quarter === 'q1' ? (
              <Q1
                filter={filter}
                setFilter={setFilter}
                isVisible={isVisible}
              />
            ) : (
              <Q2
                slackWs={slackWs}
                lastSync={lastSync}
                syncNow={syncNow}
                syncing={syncing}
                pending={pending}
                approved={approved}
                editingId={editingId}
                setEditingId={setEditingId}
                approve={approve}
                dismiss={dismiss}
                saveEdit={saveEdit}
              />
            )}
          </section>
        )}

        {/* ── STRENGTHS ── */}
        {tab === 'strengths' && (
          <section style={{ marginTop: 36 }}>
            <div
              data-anim=""
              style={{
                fontFamily: SERIF,
                fontWeight: 600,
                fontSize: 'clamp(22px,3vw,30px)',
                letterSpacing: '-.02em',
                paddingBottom: 14,
                borderBottom: '1px solid #d9d5c8',
                marginBottom: 22,
              }}
            >
              Strengths
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
                gap: 12,
              }}
            >
              {STRENGTHS.map((s) => (
                <div
                  key={s.title}
                  data-anim=""
                  data-hovercard=""
                  style={{
                    background: CARD,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 11,
                    padding: '15px 17px',
                    transition:
                      'opacity .55s cubic-bezier(.23,1,.32,1),transform .3s cubic-bezier(.23,1,.32,1),box-shadow .3s cubic-bezier(.23,1,.32,1)',
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 5 }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>
                    {s.body}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── AREAS FOR IMPROVEMENT ── */}
        {tab === 'improvement' && (
          <section style={{ marginTop: 36 }}>
            <div
              data-anim=""
              style={{
                fontFamily: SERIF,
                fontWeight: 600,
                fontSize: 'clamp(22px,3vw,30px)',
                letterSpacing: '-.02em',
                paddingBottom: 14,
                borderBottom: '1px solid #d9d5c8',
                marginBottom: 22,
              }}
            >
              Areas for Improvement
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {IMPROVEMENTS.map((it) => (
                <div
                  key={it.title}
                  data-anim=""
                  data-hovercard=""
                  style={{
                    background: CARD,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 12,
                    padding: '16px 18px',
                    display: 'flex',
                    gap: 14,
                    transition:
                      'opacity .55s cubic-bezier(.23,1,.32,1),transform .3s cubic-bezier(.23,1,.32,1),box-shadow .3s cubic-bezier(.23,1,.32,1)',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: BLUE,
                      marginTop: 6,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>
                      {it.title}
                    </div>
                    <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>
                      {it.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Divider label="Coming focus" color={GOLD} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
                gap: 14,
              }}
            >
              {COMING_FOCUS.map((c) => (
                <div
                  key={c.title}
                  data-anim=""
                  data-hovercard=""
                  style={{
                    background: '#faf6ea',
                    border: '1px solid #e6d9b8',
                    borderRadius: 12,
                    padding: '18px 18px',
                    transition:
                      'opacity .55s cubic-bezier(.23,1,.32,1),transform .3s cubic-bezier(.23,1,.32,1),box-shadow .3s cubic-bezier(.23,1,.32,1)',
                  }}
                >
                  <div
                    style={{
                      fontFamily: SERIF,
                      fontSize: 16,
                      fontWeight: 600,
                      marginBottom: 6,
                      color: '#a67d26',
                    }}
                  >
                    {c.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>
                    {c.body}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── LEVEL UP ── */}
        {tab === 'levelup' && (
          <LevelUp
            levelup={levelup}
            overallPct={overallPct}
            overallRating={overallRating}
            setRating={setRating}
            addEvidence={addEvidence}
            approveSuggestion={approveSuggestion}
            dismissSuggestion={dismissSuggestion}
          />
        )}

        {/* ── Footer ── */}
        <footer
          style={{
            marginTop: 48,
            paddingTop: 22,
            borderTop: '1px solid #d9d5c8',
            fontSize: 12,
            color: SUBTLE,
            fontFamily: MONO,
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <span>Akshita Kharbanda · Product Manager, Performance · Joveo</span>
          <span>Self-Evaluation · 2026</span>
        </footer>
      </div>
    </div>
  );
}

// ── Q1 subsection ──
function Q1({
  filter,
  setFilter,
  isVisible,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  isVisible: (c: Cat) => boolean;
}) {
  const metrics: {
    value?: string;
    count?: number;
    valueSize: string;
    color: string;
    label: string;
    labelMt?: number;
  }[] = [
    {
      count: 5,
      valueSize: 'clamp(30px,4vw,44px)',
      color: GREEN,
      label: 'Products / features shipped',
    },
    {
      value: '7–8',
      valueSize: 'clamp(30px,4vw,44px)',
      color: RUST,
      label: 'Client media plans rescued in a day',
    },
    {
      value: '4+1',
      valueSize: 'clamp(30px,4vw,44px)',
      color: BLUE,
      label: 'PRDs (4 new · 1 extended)',
    },
    {
      count: 3,
      valueSize: 'clamp(30px,4vw,44px)',
      color: GOLD,
      label: 'Reusable skills / brains shared',
    },
    {
      value: 'RCA',
      valueSize: 'clamp(26px,3.4vw,38px)',
      color: INK,
      label: 'Strong root-cause analysis & data-backed decisions',
      labelMt: 14,
    },
  ];

  const valStyle = (m: (typeof metrics)[number]): CSSProperties => ({
    fontFamily: SERIF,
    fontWeight: 600,
    fontSize: m.valueSize,
    lineHeight: 1,
    letterSpacing: m.value === 'RCA' ? '-.01em' : '-.02em',
    color: m.color,
  });

  return (
    <div>
      {/* Metric grid */}
      <div
        data-anim=""
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          overflow: 'hidden',
          margin: '0 0 26px',
          background: CARD,
        }}
      >
        {metrics.map((m, i) => (
          <div
            key={i}
            style={{
              padding: '22px 18px',
              borderRight:
                i < metrics.length - 1 ? `1px solid ${BORDER}` : undefined,
            }}
          >
            {m.count != null ? (
              <CountUp target={m.count} style={valStyle(m)} />
            ) : (
              <div style={valStyle(m)}>{m.value}</div>
            )}
            <div
              style={{ fontSize: 12, color: MUTED, marginTop: m.labelMt ?? 8 }}
            >
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, margin: '0 0 24px' }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              data-filter={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                padding: '7px 14px',
                borderRadius: 20,
                border: `1px solid ${active ? INK : BORDER}`,
                background: active ? INK : CARD,
                color: active ? PAPER : SUBTLE,
                cursor: 'pointer',
              }}
            >
              {f.dot && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: f.dot,
                  }}
                />
              )}
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Products shipped */}
      <Divider2 label="Products shipped" color={GREEN} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
          gap: 16,
        }}
      >
        {PRODUCTS.map((c) => (
          <WorkCardView key={c.title} card={c} visible={isVisible(c.cat)} />
        ))}
      </div>

      {/* Leverage */}
      <Divider label="Leverage built for the team" color={GOLD} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
          gap: 16,
        }}
      >
        {LEVERAGE.map((c) => (
          <WorkCardView key={c.title} card={c} visible={isVisible(c.cat)} />
        ))}
      </div>

      {/* Ownership & PRDs */}
      <Divider label="Ownership, delivery & PRDs" color={RUST} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
          gap: 16,
        }}
      >
        {OWNERSHIP.map((c) => (
          <WorkCardView key={c.title} card={c} visible={isVisible(c.cat)} />
        ))}
      </div>

      {/* Approach */}
      <Divider label="How I approach problems" color={BLUE} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
          gap: 14,
        }}
      >
        {APPROACH.map((a) => (
          <div
            key={a.title}
            data-anim=""
            data-hovercard=""
            style={{
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: '18px 19px',
              transition:
                'opacity .55s cubic-bezier(.23,1,.32,1),transform .3s cubic-bezier(.23,1,.32,1),box-shadow .3s cubic-bezier(.23,1,.32,1)',
            }}
          >
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 17,
                fontWeight: 600,
                marginBottom: 7,
                lineHeight: 1.15,
              }}
            >
              {a.title}
            </div>
            <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
              {a.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// First-section divider has smaller top margin in the original
function Divider2({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        margin: '6px 0 14px',
      }}
    >
      <span
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          color,
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: '#e0dccf' }} />
    </div>
  );
}

// ── Q2 subsection (Slack pipeline) ──
function Q2({
  slackWs,
  lastSync,
  syncNow,
  syncing,
  pending,
  approved,
  editingId,
  setEditingId,
  approve,
  dismiss,
  saveEdit,
}: {
  slackWs: string;
  lastSync: string;
  syncNow: () => void;
  syncing: boolean;
  pending: SlackItem[];
  approved: SlackItem[];
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  approve: (id: string) => void;
  dismiss: (id: string) => void;
  saveEdit: (id: string, patch: Partial<SlackItem>) => void;
}) {
  return (
    <div>
      {/* Connection banner */}
      <div
        data-anim=""
        data-noprint=""
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          background: '#101a17',
          color: '#e8efe9',
          borderRadius: 14,
          padding: '16px 18px',
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: '#57c98b',
              boxShadow: '0 0 0 4px rgba(87,201,139,.18)',
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: '#8fb3a3',
              }}
            >
              Slack pipeline · connected
            </div>
            <div style={{ fontSize: 13.5, marginTop: 2 }}>
              Workspace <b>{slackWs}</b> · watching #margin, #cs-team, #product,
              #bidding · last synced {lastSync}
            </div>
          </div>
        </div>
        <button
          data-btn=""
          onClick={syncNow}
          disabled={syncing}
          style={{
            appearance: 'none',
            border: '1px solid #2f4a40',
            background: '#16241f',
            color: '#e8efe9',
            borderRadius: 9,
            padding: '9px 15px',
            fontFamily: MONO,
            fontSize: 11.5,
            letterSpacing: '.04em',
            textTransform: 'uppercase',
            cursor: syncing ? 'wait' : 'pointer',
            opacity: syncing ? 0.7 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {syncing ? '⟳ Syncing…' : '⟳ Sync now'}
        </button>
      </div>

      {/* Stat row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          overflow: 'hidden',
          margin: '0 0 24px',
          background: CARD,
        }}
      >
        {(
          [
            [approved.length, GREEN, 'Approved line items', true],
            [pending.length, RUST, 'Awaiting your approval', true],
            [approved.length + pending.length, BLUE, 'Auto-detected from Slack', false],
          ] as [number, string, string, boolean][]
        ).map(([n, color, label, br], i) => (
          <div
            key={i}
            style={{
              padding: '20px 18px',
              borderRight: br ? `1px solid ${BORDER}` : undefined,
            }}
          >
            <div
              style={{
                fontFamily: SERIF,
                fontWeight: 600,
                fontSize: 'clamp(28px,4vw,42px)',
                lineHeight: 1,
                letterSpacing: '-.02em',
                color,
              }}
            >
              {n}
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Needs your approval */}
      <Divider2b label="Needs your approval" color={RUST} />
      {pending.map((it) => (
        <PendingCard
          key={it.id}
          it={it}
          editing={editingId === it.id}
          onEdit={() => setEditingId(it.id)}
          onCancel={() => setEditingId(null)}
          onApprove={() => approve(it.id)}
          onDismiss={() => dismiss(it.id)}
          onSave={(patch) => saveEdit(it.id, patch)}
        />
      ))}
      {pending.length === 0 && (
        <div
          style={{
            border: `1px dashed ${BORDER}`,
            borderRadius: 14,
            padding: 26,
            textAlign: 'center',
            color: '#8a8779',
            fontSize: 13.5,
            marginBottom: 8,
          }}
        >
          All caught up — no Slack items waiting. Hit <b>Sync now</b> to pull the
          latest.
        </div>
      )}

      {/* Approved this quarter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          margin: '28px 0 14px',
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            color: GREEN,
          }}
        >
          Approved this quarter
        </span>
        <span style={{ flex: 1, height: 1, background: '#e0dccf' }} />
      </div>
      {approved.map((it) => {
        const ci = CAT_INFO[it.cat];
        return (
          <div
            key={it.id}
            data-anim=""
            data-hovercard=""
            style={{
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 14,
              padding: '20px 22px',
              marginBottom: 12,
              transition:
                'opacity .55s cubic-bezier(.23,1,.32,1),transform .3s cubic-bezier(.23,1,.32,1),box-shadow .3s cubic-bezier(.23,1,.32,1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10.5,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  padding: '3px 9px',
                  borderRadius: 20,
                  background: ci.bg,
                  color: ci.color,
                }}
              >
                {ci.label}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: GREEN,
                }}
              >
                ✓ approved · via {it.channel}
              </span>
            </div>
            <h3
              style={{
                fontFamily: SERIF,
                fontWeight: 600,
                fontSize: 20,
                lineHeight: 1.14,
                marginBottom: 8,
              }}
            >
              {it.title}
            </h3>
            <div
              style={{
                fontSize: 13.5,
                color: MUTED,
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <span style={{ color: RUST, fontWeight: 700, flexShrink: 0 }}>→</span>
              <span>{it.impact}</span>
            </div>
          </div>
        );
      })}
      {approved.length === 0 && (
        <div
          style={{
            border: '1px solid #e0dccf',
            borderRadius: 14,
            padding: 26,
            textAlign: 'center',
            color: '#8a8779',
            fontSize: 13.5,
            background: CARD,
          }}
        >
          Nothing approved yet. Approve Slack-detected items above and they
          become permanent line items for Jul – Dec.
        </div>
      )}
    </div>
  );
}

function Divider2b({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        margin: '6px 0 14px',
      }}
    >
      <span
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          color,
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: '#e0dccf' }} />
    </div>
  );
}

const btnBase: CSSProperties = {
  appearance: 'none',
  borderRadius: 9,
  padding: '9px 16px',
  fontFamily: MONO,
  fontSize: 11,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: '#9a978c',
  marginBottom: 5,
};

function PendingCard({
  it,
  editing,
  onEdit,
  onCancel,
  onApprove,
  onDismiss,
  onSave,
}: {
  it: SlackItem;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onApprove: () => void;
  onDismiss: () => void;
  onSave: (patch: Partial<SlackItem>) => void;
}) {
  const ci = CAT_INFO[it.cat];
  const [title, setTitle] = useState(it.title);
  const [impact, setImpact] = useState(it.impact);
  const [cat, setCat] = useState<Cat>(it.cat);

  // Reset local edit fields whenever we (re)enter edit mode
  useEffect(() => {
    if (editing) {
      setTitle(it.title);
      setImpact(it.impact);
      setCat(it.cat);
    }
  }, [editing, it.title, it.impact, it.cat]);

  return (
    <div
      data-anim=""
      style={{
        background: '#fdfbf7',
        border: '1px dashed #cdc6b4',
        borderRadius: 14,
        padding: '18px 20px',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10.5,
            letterSpacing: '.06em',
            color: '#7a7768',
            background: '#efece2',
            borderRadius: 6,
            padding: '3px 8px',
          }}
        >
          {it.channel}
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: RUST,
          }}
        >
          ● auto-detected
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10.5,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            padding: '2px 9px',
            borderRadius: 20,
            background: ci.bg,
            color: ci.color,
          }}
        >
          {ci.label}
        </span>
      </div>
      <div
        style={{
          fontSize: 13,
          color: '#7a7768',
          fontStyle: 'italic',
          marginBottom: 12,
        }}
      >
        &quot;{it.text}&quot;
      </div>

      {editing ? (
        <>
          <div
            style={{
              borderTop: '1px solid #ece7d9',
              paddingTop: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div>
              <label style={labelStyle}>Title</label>
              <input
                className="se-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  border: `1px solid ${BORDER}`,
                  background: '#fff',
                  borderRadius: 8,
                  padding: '8px 11px',
                  fontSize: 14,
                  fontFamily: SERIF,
                  fontWeight: 600,
                  color: INK,
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>Impact</label>
              <textarea
                className="se-textarea"
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                rows={2}
                style={{
                  width: '100%',
                  border: `1px solid ${BORDER}`,
                  background: '#fff',
                  borderRadius: 8,
                  padding: '8px 11px',
                  fontSize: 13,
                  color: MUTED,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: SANS,
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select
                className="se-select"
                value={cat}
                onChange={(e) => setCat(e.target.value as Cat)}
                style={{
                  border: `1px solid ${BORDER}`,
                  background: '#fff',
                  borderRadius: 8,
                  padding: '8px 11px',
                  fontSize: 12.5,
                  color: INK,
                  outline: 'none',
                  fontFamily: MONO,
                }}
              >
                <option value="margin">Margin</option>
                <option value="cust">Customer</option>
                <option value="sys">Systems</option>
                <option value="lev">Leverage</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
            <button
              data-btn=""
              onClick={() =>
                onSave({
                  title: title.trim() || it.title,
                  impact: impact.trim() || it.impact,
                  cat,
                })
              }
              style={{ ...btnBase, border: 'none', background: INK, color: PAPER }}
            >
              Save changes
            </button>
            <button
              data-btn=""
              onClick={onCancel}
              style={{
                ...btnBase,
                border: `1px solid ${BORDER}`,
                background: CARD,
                color: '#8a8779',
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div>
          <div style={{ borderTop: '1px solid #ece7d9', paddingTop: 12 }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: '#9a978c',
                marginBottom: 5,
              }}
            >
              Suggested line item
            </div>
            <h3
              style={{
                fontFamily: SERIF,
                fontWeight: 600,
                fontSize: 18,
                lineHeight: 1.15,
                marginBottom: 6,
              }}
            >
              {it.title}
            </h3>
            <div
              style={{
                fontSize: 13,
                color: MUTED,
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <span style={{ color: RUST, fontWeight: 700, flexShrink: 0 }}>→</span>
              <span>{it.impact}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 14 }}>
            <button
              data-btn=""
              onClick={onApprove}
              style={{ ...btnBase, border: 'none', background: GREEN, color: PAPER }}
            >
              ✓ Approve as line item
            </button>
            <button
              data-btn=""
              onClick={onEdit}
              style={{
                ...btnBase,
                border: '1px solid #cbbf9e',
                background: '#faf6ea',
                color: '#a67d26',
              }}
            >
              ✎ Edit
            </button>
            <button
              data-btn=""
              onClick={onDismiss}
              style={{
                ...btnBase,
                border: `1px solid ${BORDER}`,
                background: CARD,
                color: '#8a8779',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Level Up subsection ──
function LevelUp({
  levelup,
  overallPct,
  overallRating,
  setRating,
  addEvidence,
  approveSuggestion,
  dismissSuggestion,
}: {
  levelup: Competency[];
  overallPct: number;
  overallRating: string;
  setRating: (id: string, delta: number) => void;
  addEvidence: (id: string, value: string) => void;
  approveSuggestion: (competencyId: string, suggestionId: string) => void;
  dismissSuggestion: (competencyId: string, suggestionId: string) => void;
}) {
  const totalSuggestions = levelup.reduce(
    (n, c) => n + (c.suggested?.length || 0),
    0,
  );
  return (
    <section style={{ marginTop: 36 }}>
      <div
        data-anim=""
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          paddingBottom: 14,
          borderBottom: '1px solid #d9d5c8',
          marginBottom: 8,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 600,
              fontSize: 'clamp(22px,3vw,30px)',
              letterSpacing: '-.02em',
            }}
          >
            Level Up — Path to Senior PM
          </div>
          <div
            style={{ fontSize: 13, color: MUTED, marginTop: 6, maxWidth: '60ch' }}
          >
            A living evidence log against the Senior PM competency bar. Each
            rating rises as I add proof — kept honest, kept current.
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 600,
              fontSize: 'clamp(30px,4vw,44px)',
              lineHeight: 1,
              color: GREEN,
            }}
          >
            {overallPct}%
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: '#8a8779',
              marginTop: 6,
            }}
          >
            Overall readiness · {overallRating}/5
          </div>
        </div>
      </div>

      <p
        data-anim=""
        data-noprint=""
        style={{
          fontSize: 12,
          color: '#8a8779',
          fontStyle: 'italic',
          margin: '0 0 20px',
        }}
      >
        Add an evidence line to any competency to log new proof and nudge its
        rating up.{' '}
        {totalSuggestions > 0
          ? `The pipeline has surfaced ${totalSuggestions} suggested ${
              totalSuggestions === 1 ? 'proof' : 'proofs'
            } from Slack / Meet — approve to log them.`
          : 'Everything you add is saved to this dashboard.'}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))',
          gap: 14,
        }}
      >
        {levelup.map((c) => (
          <CompetencyCard
            key={c.id}
            c={c}
            setRating={setRating}
            addEvidence={addEvidence}
            approveSuggestion={approveSuggestion}
            dismissSuggestion={dismissSuggestion}
          />
        ))}
      </div>
    </section>
  );
}

function CompetencyCard({
  c,
  setRating,
  addEvidence,
  approveSuggestion,
  dismissSuggestion,
}: {
  c: Competency;
  setRating: (id: string, delta: number) => void;
  addEvidence: (id: string, value: string) => void;
  approveSuggestion: (competencyId: string, suggestionId: string) => void;
  dismissSuggestion: (competencyId: string, suggestionId: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const rm = ratingMeta(c.rating);
  const ratingNum = (Math.round(c.rating * 10) / 10).toString();
  const suggested = c.suggested || [];

  const submit = () => {
    addEvidence(c.id, draft);
    setDraft('');
  };

  return (
    <div
      data-anim=""
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 13,
        padding: '18px 19px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, flex: 1 }}>
          {c.full}
        </div>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            padding: '3px 9px',
            borderRadius: 20,
            whiteSpace: 'nowrap',
            background: rm.bg,
            color: rm.color,
          }}
        >
          {rm.label}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div
          style={{
            flex: 1,
            height: 6,
            borderRadius: 4,
            background: '#e6e2d6',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: 4,
              background: 'linear-gradient(90deg,#2f5d50,#4a6fa5)',
              width: `${Math.round((c.rating / 5) * 100)}%`,
              transition: 'width .7s cubic-bezier(.23,1,.32,1)',
            }}
          />
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            data-btn=""
            onClick={() => setRating(c.id, -0.5)}
            aria-label="lower rating"
            style={{
              appearance: 'none',
              border: `1px solid ${BORDER}`,
              background: CARD,
              color: SUBTLE,
              borderRadius: 6,
              width: 22,
              height: 22,
              lineHeight: 1,
              fontSize: 15,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            −
          </button>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 12,
              color: GREEN,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              minWidth: 30,
              textAlign: 'center',
            }}
          >
            {ratingNum}/5
          </span>
          <button
            data-btn=""
            onClick={() => setRating(c.id, 0.5)}
            aria-label="raise rating"
            style={{
              appearance: 'none',
              border: `1px solid ${BORDER}`,
              background: CARD,
              color: SUBTLE,
              borderRadius: 6,
              width: 22,
              height: 22,
              lineHeight: 1,
              fontSize: 14,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +
          </button>
        </div>
      </div>

      <div
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: '#9a978c',
          marginBottom: 8,
        }}
      >
        Evidence · {c.evidences.length}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
        {c.evidences.map((ev, i) => (
          <div
            key={i}
            style={{
              fontSize: 12.5,
              color: MUTED,
              lineHeight: 1.4,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <span style={{ color: GREEN, fontWeight: 700, flexShrink: 0 }}>→</span>
            <span>{ev}</span>
          </div>
        ))}
      </div>

      {/* Pipeline-suggested evidence — one-click approve to log + nudge rating */}
      {suggested.length > 0 && (
        <div
          data-noprint=""
          style={{
            border: '1px dashed #cbbf9e',
            background: '#faf6ea',
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 9.5,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: '#a67d26',
            }}
          >
            ● Suggested from {suggested[0].source === 'gmeet' ? 'Meet notes' : 'Slack'} · {suggested.length}
          </div>
          {suggested.map((sug) => (
            <div key={sug.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  fontSize: 12.5,
                  color: MUTED,
                  lineHeight: 1.4,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ color: '#a67d26', fontWeight: 700, flexShrink: 0 }}>+</span>
                <span>{sug.text}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  data-btn=""
                  onClick={() => approveSuggestion(c.id, sug.id)}
                  style={{
                    appearance: 'none',
                    border: 'none',
                    background: GREEN,
                    color: PAPER,
                    borderRadius: 7,
                    padding: '5px 11px',
                    fontFamily: MONO,
                    fontSize: 10,
                    letterSpacing: '.05em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  ✓ Log it
                </button>
                <button
                  data-btn=""
                  onClick={() => dismissSuggestion(c.id, sug.id)}
                  style={{
                    appearance: 'none',
                    border: `1px solid ${BORDER}`,
                    background: CARD,
                    color: '#8a8779',
                    borderRadius: 7,
                    padding: '5px 11px',
                    fontFamily: MONO,
                    fontSize: 10,
                    letterSpacing: '.05em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div data-noprint="" style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <input
          className="se-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="Add evidence…"
          style={{
            flex: 1,
            minWidth: 0,
            border: `1px solid ${BORDER}`,
            background: '#fff',
            borderRadius: 8,
            padding: '8px 11px',
            fontSize: 12.5,
            color: INK,
            outline: 'none',
          }}
        />
        <button
          data-btn=""
          onClick={submit}
          style={{
            appearance: 'none',
            border: 'none',
            background: INK,
            color: PAPER,
            borderRadius: 8,
            padding: '8px 14px',
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: '.05em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
