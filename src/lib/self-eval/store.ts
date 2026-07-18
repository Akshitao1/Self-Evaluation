import { promises as fs } from 'fs';
import path from 'path';
import type {
  Candidate,
  Cat,
  Competency,
  DashboardState,
  LineItem,
} from './types';
import { seedState } from './seed';

/* Server-side persistence for the Self-Eval pipeline.

   Uses a JSON file on the (persistent, PM2-hosted) filesystem — durable across
   requests and restarts, and easy to inspect. All writes go through a single
   in-process promise chain so concurrent requests can't clobber each other.
   Swap `read`/`write` for a Google Sheet / DB later without touching callers. */

const DATA_DIR =
  process.env.SELF_EVAL_DATA_DIR || path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'self-eval.json');

let writeChain: Promise<unknown> = Promise.resolve();

async function readRaw(): Promise<DashboardState> {
  try {
    const buf = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(buf) as DashboardState;
    if (parsed && parsed.version) return parsed;
  } catch {
    /* missing / corrupt → fall through to seed */
  }
  const fresh = seedState(new Date().toISOString());
  await writeRaw(fresh);
  return fresh;
}

async function writeRaw(state: DashboardState): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(tmp, DATA_FILE); // atomic replace
}

/** Serialize a read-modify-write so concurrent mutations don't race. */
function mutate(
  fn: (s: DashboardState) => DashboardState | Promise<DashboardState>,
): Promise<DashboardState> {
  const next = writeChain.then(async () => {
    const current = await readRaw();
    const updated = await fn(structuredClone(current));
    updated.updatedAt = new Date().toISOString();
    await writeRaw(updated);
    return updated;
  });
  // keep the chain alive even if this mutation rejects
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
      s.approved = [{ ...it, approvedAt: new Date().toISOString() }, ...s.approved];
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

/** Approve a pipeline-suggested evidence: append it and nudge the rating up. */
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

/**
 * Ingest freshly-detected candidates from any source. Dedupes against existing
 * pending + approved items (by title/text) so re-syncs don't create duplicates.
 * Line-item candidates land in `pending`; competency evidence lands in the
 * matching competency's `suggested` list. Nothing becomes final without approval.
 */
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
      // Line item
      if (c.title && c.impact) {
        const key = (c.title + '|' + c.text).toLowerCase();
        if (!seenItem.has(key)) {
          seenItem.add(key);
          const item: LineItem = {
            id: `${slug(c.title)}-${added}-${now.slice(11, 19).replace(/:/g, '')}`,
            channel: c.channel || c.source,
            source: c.source,
            text: c.text,
            cat: c.cat,
            title: c.title,
            impact: c.impact,
            detectedAt: now,
          };
          s.pending = [item, ...s.pending];
          added++;
        }
      }
      // Competency evidence suggestion
      if (c.competencyId && c.competencyEvidence) {
        const comp = s.levelup.find((x) => x.id === c.competencyId);
        if (comp) {
          const exists =
            comp.evidences.some(
              (e) => e.toLowerCase() === c.competencyEvidence!.toLowerCase(),
            ) ||
            comp.suggested.some(
              (e) => e.text.toLowerCase() === c.competencyEvidence!.toLowerCase(),
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
