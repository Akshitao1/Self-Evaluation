import { promises as fs } from 'fs';
import path from 'path';
import type { Candidate, Cat, Competency, DashboardState } from './types';
import { seedState } from './seed';

/* Server-side persistence for the standalone Self-Eval app.

   Primary backend: a single Google Sheet cell (state!A1) holding the JSON
   DashboardState. Durable on Vercel's ephemeral filesystem, and the raw record
   is viewable/editable in the sheet.
     - GOOGLE_SERVICE_ACCOUNT_JSON  full service-account JSON (stringified)
     - SELF_EVAL_SHEET_ID           the spreadsheet id (share it with the SA email)

   Fallback (no creds): a local JSON file, so `npm run dev` works without a sheet.
   All exported action names match the file-store version, so the API routes are
   identical. Writes are serialized through one in-process promise chain. */

const CELL = 'A1';
const DATA_DIR =
  process.env.SELF_EVAL_DATA_DIR || path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'self-eval.json');

let writeChain: Promise<unknown> = Promise.resolve();

function sheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.SELF_EVAL_SHEET_ID,
  );
}

// ── Google Sheets backend ──

async function getSheetsClient() {
  const { google } = await import('googleapis');
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function sheetRead(): Promise<DashboardState | null> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SELF_EVAL_SHEET_ID!,
    range: CELL,
  });
  const raw = res.data.values?.[0]?.[0];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DashboardState;
    return parsed?.version ? parsed : null;
  } catch {
    return null;
  }
}

async function sheetWrite(state: DashboardState): Promise<void> {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SELF_EVAL_SHEET_ID!,
    range: CELL,
    valueInputOption: 'RAW',
    requestBody: { values: [[JSON.stringify(state)]] },
  });
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
