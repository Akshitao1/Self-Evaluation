import { promises as fs } from 'fs';
import path from 'path';
import type { Candidate, Cat, Competency, DashboardState } from './types';
import { seedState } from './seed';

/* Server-side persistence for the standalone Self-Eval app.

   Google Sheets backend (durable on Vercel's ephemeral filesystem):
     - GOOGLE_SERVICE_ACCOUNT_JSON  full service-account JSON (stringified)
     - SELF_EVAL_SHEET_ID           the spreadsheet id (share it with the SA email)

   Layout in the sheet:
     - "Data" tab, cell A1  → the JSON DashboardState (SOURCE OF TRUTH; don't edit)
     - "Accomplishments" tab → human-readable rows (one per pending/approved item)
     - "Level Up" tab        → human-readable rows (one per competency)
   The readable tabs are rewritten on every change — they mirror the data, they
   don't feed it, so hand-edits there are overwritten. Edit via the dashboard UI.

   Fallback (no creds): a local JSON file, so `npm run dev` works without a sheet.
   All exported action names match the file-store version, so the API routes are
   identical. Writes are serialized through one in-process promise chain. */

const DATA_TAB = 'Data';
const ACC_TAB = 'Accomplishments';
const LEVEL_TAB = 'Level Up';
const CAT_LABEL: Record<string, string> = {
  margin: 'Margin',
  cust: 'Customer',
  sys: 'Systems',
  lev: 'Leverage',
};

const DATA_DIR =
  process.env.SELF_EVAL_DATA_DIR || path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'self-eval.json');

let writeChain: Promise<unknown> = Promise.resolve();
let layoutReady = false;

function sheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.SELF_EVAL_SHEET_ID,
  );
}

function sheetId(): string {
  return process.env.SELF_EVAL_SHEET_ID!;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

// ── Google Sheets backend ──

type SheetsClient = Awaited<ReturnType<typeof getSheetsClient>>;

async function getSheetsClient() {
  const { google } = await import('googleapis');
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/** Make sure the Data / Accomplishments / Level Up tabs exist (once per instance).
    Repurposes the default first tab as "Accomplishments" so it opens first. */
async function ensureLayout(sheets: SheetsClient): Promise<void> {
  if (layoutReady) return;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId() });
  const tabs = (meta.data.sheets || []).map((s) => ({
    id: s.properties?.sheetId as number,
    title: s.properties?.title as string,
    index: s.properties?.index as number,
  }));
  const titles = new Set(tabs.map((t) => t.title));
  const requests: object[] = [];

  if (!titles.has(ACC_TAB)) {
    const first = tabs.find((t) => t.index === 0);
    if (first && first.title !== DATA_TAB && first.title !== LEVEL_TAB) {
      // rename the default sheet (holds the legacy A1 blob) into Accomplishments
      requests.push({
        updateSheetProperties: {
          properties: { sheetId: first.id, title: ACC_TAB },
          fields: 'title',
        },
      });
    } else {
      requests.push({ addSheet: { properties: { title: ACC_TAB, index: 0 } } });
    }
  }
  if (!titles.has(DATA_TAB))
    requests.push({ addSheet: { properties: { title: DATA_TAB } } });
  if (!titles.has(LEVEL_TAB))
    requests.push({ addSheet: { properties: { title: LEVEL_TAB } } });

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId(),
      requestBody: { requests },
    });
  }
  layoutReady = true;
}

async function clearAndWrite(
  sheets: SheetsClient,
  tab: string,
  rows: string[][],
): Promise<void> {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId(),
    range: `${tab}!A1:Z2000`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range: `${tab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
}

async function sheetRead(): Promise<DashboardState | null> {
  const sheets = await getSheetsClient();
  // primary: Data!A1
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId(),
      range: `${DATA_TAB}!A1`,
    });
    const raw = res.data.values?.[0]?.[0];
    if (raw) {
      const parsed = JSON.parse(raw) as DashboardState;
      if (parsed?.version) return parsed;
    }
  } catch {
    /* Data tab may not exist yet */
  }
  // legacy: JSON previously stored in the first sheet's A1
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId(),
      range: 'A1',
    });
    const raw = res.data.values?.[0]?.[0];
    if (raw) {
      const parsed = JSON.parse(raw) as DashboardState;
      if (parsed?.version) return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function sheetWrite(state: DashboardState): Promise<void> {
  const sheets = await getSheetsClient();
  await ensureLayout(sheets);

  // 1. source of truth
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range: `${DATA_TAB}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [[JSON.stringify(state)]] },
  });

  // 2. readable Accomplishments
  const accRows: string[][] = [
    ['Status', 'When', 'Source', 'Channel', 'Category', 'Title', 'Impact'],
  ];
  for (const p of state.pending) {
    accRows.push([
      'Pending',
      fmtDate(p.detectedAt),
      p.source,
      p.channel,
      CAT_LABEL[p.cat] || p.cat,
      p.title,
      p.impact,
    ]);
  }
  for (const a of state.approved) {
    accRows.push([
      'Approved',
      fmtDate(a.approvedAt || a.detectedAt),
      a.source,
      a.channel,
      CAT_LABEL[a.cat] || a.cat,
      a.title,
      a.impact,
    ]);
  }
  await clearAndWrite(sheets, ACC_TAB, accRows);

  // 3. readable Level Up
  const avg =
    state.levelup.reduce((s, c) => s + c.rating, 0) /
    (state.levelup.length || 1);
  const luRows: string[][] = [
    [
      `Overall readiness: ${Math.round((avg / 5) * 100)}% (${(Math.round(avg * 10) / 10).toString()}/5)`,
    ],
    ['#', 'Competency', 'Rating (/5)', 'Evidence count', 'Evidence'],
  ];
  state.levelup.forEach((c, i) => {
    luRows.push([
      String(i + 1),
      c.full,
      String(c.rating),
      String(c.evidences.length),
      c.evidences.map((e) => '• ' + e).join('\n'),
    ]);
  });
  await clearAndWrite(sheets, LEVEL_TAB, luRows);
}

// ── Local file fallback (dev only) ──

async function fileRead(): Promise<DashboardState | null> {
  try {
    const buf = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(buf) as DashboardState;
    return parsed?.version ? parsed : null;
  } catch {
    return null;
  }
}

async function fileWrite(state: DashboardState): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(tmp, DATA_FILE);
}

// ── Backend-agnostic read/write ──

async function backendRead(): Promise<DashboardState | null> {
  return sheetsConfigured() ? sheetRead() : fileRead();
}

async function backendWrite(state: DashboardState): Promise<void> {
  return sheetsConfigured() ? sheetWrite(state) : fileWrite(state);
}

async function readRaw(): Promise<DashboardState> {
  const existing = await backendRead();
  if (existing) return existing;
  const fresh = seedState(new Date().toISOString());
  await backendWrite(fresh);
  return fresh;
}

function mutate(
  fn: (s: DashboardState) => DashboardState | Promise<DashboardState>,
): Promise<DashboardState> {
  const next = writeChain.then(async () => {
    const current = await readRaw();
    const updated = await fn(structuredClone(current));
    updated.updatedAt = new Date().toISOString();
    await backendWrite(updated);
    return updated;
  });
  writeChain = next.catch(() => undefined);
  return next;
}

export function getState(): Promise<DashboardState> {
  return readRaw();
}

export function resetState(): Promise<DashboardState> {
  return mutate(() => seedState(new Date().toISOString()));
}

// ── Line-item (accomplishment) actions ──

export function approveItem(id: string): Promise<DashboardState> {
  return mutate((s) => {
    const it = s.pending.find((p) => p.id === id);
    if (it) {
      s.pending = s.pending.filter((p) => p.id !== id);
      s.approved = [
        { ...it, approvedAt: new Date().toISOString() },
        ...s.approved,
      ];
    }
    return s;
  });
}

export function dismissItem(id: string): Promise<DashboardState> {
  return mutate((s) => {
    s.pending = s.pending.filter((p) => p.id !== id);
    return s;
  });
}

export function editItem(
  id: string,
  patch: { title?: string; impact?: string; cat?: Cat },
): Promise<DashboardState> {
  return mutate((s) => {
    s.pending = s.pending.map((p) =>
      p.id === id
        ? {
            ...p,
            title: patch.title?.trim() || p.title,
            impact: patch.impact?.trim() || p.impact,
            cat: patch.cat || p.cat,
          }
        : p,
    );
    return s;
  });
}

// ── Level Up actions ──

export function setRating(id: string, delta: number): Promise<DashboardState> {
  return mutate((s) => {
    s.levelup = s.levelup.map((c) =>
      c.id === id
        ? { ...c, rating: Math.max(0, Math.min(5, c.rating + delta)) }
        : c,
    );
    return s;
  });
}

export function addEvidence(id: string, text: string): Promise<DashboardState> {
  const v = text.trim();
  return mutate((s) => {
    if (!v) return s;
    s.levelup = s.levelup.map((c) =>
      c.id === id
        ? {
            ...c,
            rating: Math.min(5, c.rating + 0.5),
            evidences: [...c.evidences, v],
          }
        : c,
    );
    return s;
  });
}

export function approveSuggestion(
  competencyId: string,
  suggestionId: string,
): Promise<DashboardState> {
  return mutate((s) => {
    s.levelup = s.levelup.map((c) => {
      if (c.id !== competencyId) return c;
      const sug = c.suggested.find((x) => x.id === suggestionId);
      if (!sug) return c;
      return {
        ...c,
        rating: Math.min(5, c.rating + 0.5),
        evidences: [...c.evidences, sug.text],
        suggested: c.suggested.filter((x) => x.id !== suggestionId),
      };
    });
    return s;
  });
}

export function dismissSuggestion(
  competencyId: string,
  suggestionId: string,
): Promise<DashboardState> {
  return mutate((s) => {
    s.levelup = s.levelup.map((c) =>
      c.id === competencyId
        ? { ...c, suggested: c.suggested.filter((x) => x.id !== suggestionId) }
        : c,
    );
    return s;
  });
}

// ── Pipeline ingest ──

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

export async function ingestCandidates(
  candidates: Candidate[],
): Promise<DashboardState & { added: number; suggestions: number }> {
  let added = 0;
  let suggestions = 0;

  const state = await mutate((s) => {
    const now = new Date().toISOString();
    const seenItem = new Set(
      [...s.pending, ...s.approved].map((i) =>
        (i.title + '|' + i.text).toLowerCase(),
      ),
    );

    for (const c of candidates) {
      if (c.title && c.impact) {
        const key = (c.title + '|' + c.text).toLowerCase();
        if (!seenItem.has(key)) {
          seenItem.add(key);
          s.pending = [
            {
              id: `${slug(c.title)}-${added}-${now.slice(11, 19).replace(/:/g, '')}`,
              channel: c.channel || c.source,
              source: c.source,
              text: c.text,
              cat: c.cat,
              title: c.title,
              impact: c.impact,
              detectedAt: now,
            },
            ...s.pending,
          ];
          added++;
        }
      }
      if (c.competencyId && c.competencyEvidence) {
        const comp = s.levelup.find((x) => x.id === c.competencyId);
        if (comp) {
          const exists =
            comp.evidences.some(
              (e) => e.toLowerCase() === c.competencyEvidence!.toLowerCase(),
            ) ||
            comp.suggested.some(
              (e) =>
                e.text.toLowerCase() === c.competencyEvidence!.toLowerCase(),
            );
          if (!exists) {
            comp.suggested = [
              {
                id: `${comp.id}-s${suggestions}-${now.slice(11, 19).replace(/:/g, '')}`,
                text: c.competencyEvidence,
                source:
                  c.source === 'slack' || c.source === 'gmeet'
                    ? c.source
                    : 'external',
                detectedAt: now,
              },
              ...comp.suggested,
            ];
            suggestions++;
          }
        }
      }
    }

    s.lastSyncAt = now;
    return s;
  });

  return Object.assign(state, { added, suggestions });
}

export type { Competency };
