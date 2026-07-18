import { NextRequest, NextResponse } from 'next/server';
import { ingestCandidates, getState } from '@/lib/self-eval/store';
import {
  fetchSlackCandidates,
  isSlackConfigured,
  simulatedCandidate,
} from '@/lib/self-eval/sources';

export const dynamic = 'force-dynamic';

/**
 * Scheduled entry point for the auto-sync pipeline.
 * Protect with CRON_SECRET (sent as `Authorization: Bearer <secret>` or `?secret=`).
 * Wire to a scheduler — PM2 cron, system crontab, Vercel Cron, or a Claude routine:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/self-eval/cron
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const qp = req.nextUrl.searchParams.get('secret') || '';
    const supplied = auth.replace(/^Bearer\s+/i, '') || qp;
    if (supplied !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  try {
    let candidates;
    if (isSlackConfigured()) {
      candidates = await fetchSlackCandidates();
    } else {
      const state = await getState();
      candidates = simulatedCandidate(state.pending.length + state.approved.length);
    }
    const result = await ingestCandidates(candidates);
    return NextResponse.json({
      ok: true,
      added: result.added,
      suggestions: result.suggestions,
      lastSyncAt: result.lastSyncAt,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
