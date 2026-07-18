import { NextRequest, NextResponse } from 'next/server';
import { getState, ingestCandidates } from '@/lib/self-eval/store';
import {
  fetchSlackCandidates,
  isSlackConfigured,
  simulatedCandidate,
} from '@/lib/self-eval/sources';
import type { Candidate } from '@/lib/self-eval/types';

export const dynamic = 'force-dynamic';

/**
 * Run a sync. Source resolution, in order:
 *   1. `candidates` in the POST body  → ingest as-is (e.g. from a scheduled
 *      Claude agent that scanned Slack/Gmail/Meet with your connectors).
 *   2. SLACK_BOT_TOKEN configured      → pull Slack + extract via Claude.
 *   3. otherwise (demo)                → one rotating simulated candidate.
 * Everything ingested lands as PENDING / suggested — never final without approval.
 */
export async function POST(req: NextRequest) {
  try {
    let candidates: Candidate[] = [];
    let mode: 'external' | 'slack' | 'demo' = 'demo';

    // 1. externally-supplied candidates
    let body: { candidates?: Candidate[] } = {};
    try {
      body = await req.json();
    } catch {
      /* empty body is fine */
    }
    if (Array.isArray(body.candidates) && body.candidates.length) {
      candidates = body.candidates.map((c) => ({ ...c, source: c.source || 'external' }));
      mode = 'external';
    } else if (isSlackConfigured()) {
      // 2. live Slack
      candidates = await fetchSlackCandidates();
      mode = 'slack';
    } else {
      // 3. demo
      const state = await getState();
      const seed = state.pending.length + state.approved.length;
      candidates = simulatedCandidate(seed);
      mode = 'demo';
    }

    const result = await ingestCandidates(candidates);
    return NextResponse.json({
      mode,
      added: result.added,
      suggestions: result.suggestions,
      state: result,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
