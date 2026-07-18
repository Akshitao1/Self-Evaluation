import type { Candidate } from './types';
import { COMPETENCY_INDEX } from './seed';

/* Sources that feed the pipeline.

   Live mode (when env is configured):
     - SLACK_BOT_TOKEN            Slack bot token (xoxb-…) with channels:history + channels:read
     - SELF_EVAL_SLACK_CHANNELS   comma-separated channel names to watch, e.g. "margin,cs-team,product,bidding"
     - SELF_EVAL_PERSON           the person to detect accomplishments for, e.g. "Akshita"
     - ANTHROPIC_API_KEY          used to turn raw messages into structured line items + competency evidence
     - SELF_EVAL_MODEL            optional model id (default claude-sonnet-5)

   Meet notes: gmeet transcripts/summaries usually arrive via Gmail/Drive, which
   need per-user OAuth not available to a server bot. So gmeet candidates are
   expected to be POSTed in by an external job (e.g. a scheduled Claude agent
   using your Gmail connector) via the sync endpoint's `candidates` body.

   Demo mode (no SLACK_BOT_TOKEN): returns a rotating simulated candidate so the
   "Sync now" button works end-to-end for demos. Clearly tagged source:'simulated'. */

export function isSlackConfigured(): boolean {
  return Boolean(process.env.SLACK_BOT_TOKEN);
}

export function isExtractorConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SIMULATED_POOL: Candidate[] = [
  {
    channel: '#bidding',
    source: 'simulated',
    text: 'Bid Rec Engine v3.4 shipped with confidence scoring live in production.',
    cat: 'sys',
    title: 'Bidding Engine v3.4',
    impact: 'Confidence scoring now live in production.',
    competencyId: 'c3',
    competencyEvidence: 'Shipped Bidding Engine v3.4 independently, with confidence scoring in production',
  },
  {
    channel: '#cs-team',
    source: 'simulated',
    text: 'Client renewal this week credited partly to Akshita’s QBR insights.',
    cat: 'cust',
    title: 'Influenced a client renewal',
    impact: 'QBR insights contributed to a client renewal.',
    competencyId: 'c8',
    competencyEvidence: 'QBR insights contributed to a client renewal',
  },
  {
    channel: '#margin',
    source: 'simulated',
    text: 'Social margin issue fully closed after the Event Ingestion rollout.',
    cat: 'margin',
    title: 'Social margin gap fully closed',
    impact: 'Closed the long-standing social margin gap.',
    competencyId: 'c4',
    competencyEvidence: 'Closed the long-standing social margin gap via Event Ingestion',
  },
  {
    channel: '#product',
    source: 'simulated',
    text: 'Akshita’s Supply Repo demo got sign-off to move to a full product build.',
    cat: 'lev',
    title: 'Supply Repo product build approved',
    impact: 'Secured go-ahead to build Supply Repo as a product.',
    competencyId: 'c6',
    competencyEvidence: 'Secured sign-off to build Supply Repo as a full product',
  },
];

/** Deterministic-ish rotation without Date.now dependence issues. */
export function simulatedCandidate(seed: number): Candidate[] {
  return [SIMULATED_POOL[seed % SIMULATED_POOL.length]];
}

interface SlackMessage {
  text: string;
  channel: string;
  ts: string;
}

async function slackApi<T>(
  method: string,
  params: Record<string, string>,
): Promise<T> {
  const token = process.env.SLACK_BOT_TOKEN!;
  const url = new URL(`https://slack.com/api/${method}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json()) as { ok: boolean; error?: string } & T;
  if (!json.ok) throw new Error(`Slack ${method} failed: ${json.error}`);
  return json;
}

/** Pull recent messages from the watched channels that mention the person. */
async function fetchSlackMessages(): Promise<SlackMessage[]> {
  const person = (process.env.SELF_EVAL_PERSON || 'Akshita').toLowerCase();
  const watch = (process.env.SELF_EVAL_SLACK_CHANNELS || 'margin,cs-team,product,bidding')
    .split(',')
    .map((c) => c.trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean);

  const list = await slackApi<{
    channels: { id: string; name: string }[];
  }>('conversations.list', { limit: '1000', types: 'public_channel' });

  const targets = list.channels.filter((c) => watch.includes(c.name.toLowerCase()));
  const out: SlackMessage[] = [];
  const oldest = String(Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30); // last 30 days

  for (const ch of targets) {
    try {
      const hist = await slackApi<{ messages: { text?: string; ts: string }[] }>(
        'conversations.history',
        { channel: ch.id, limit: '80', oldest },
      );
      for (const m of hist.messages) {
        const t = (m.text || '').trim();
        if (t && t.toLowerCase().includes(person)) {
          out.push({ text: t, channel: `#${ch.name}`, ts: m.ts });
        }
      }
    } catch {
      /* skip channels the bot can't read */
    }
  }
  return out;
}

/** Turn raw messages into structured candidates via Claude (JSON out). */
async function extractCandidates(messages: SlackMessage[]): Promise<Candidate[]> {
  if (!messages.length) return [];
  const model = process.env.SELF_EVAL_MODEL || 'claude-sonnet-5';
  const person = process.env.SELF_EVAL_PERSON || 'Akshita';
  const comps = COMPETENCY_INDEX.map((c) => `${c.id}: ${c.full}`).join('\n');

  const prompt = `You extract Product-Manager accomplishments for ${person} from Slack messages.
Categories (cat): margin, cust (customer), sys (systems), lev (leverage/team).
Senior-PM competencies:
${comps}

For each message that describes a real accomplishment by ${person}, output an object:
{ "channel", "text" (the source snippet), "cat", "title" (<=8 words), "impact" (one sentence outcome),
  "competencyId" (best-matching competency id or null), "competencyEvidence" (short evidence line or null) }
Ignore messages that are not accomplishments. Return STRICT JSON: {"candidates":[...]}. No prose.

Messages:
${messages.map((m, i) => `${i + 1}. [${m.channel}] ${m.text}`).join('\n')}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = (await res.json()) as { content: { text?: string }[] };
  const raw = data.content?.map((c) => c.text || '').join('') || '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { candidates?: Candidate[] };
    return (parsed.candidates || []).map((c) => ({
      ...c,
      source: 'slack' as const,
      competencyEvidence: c.competencyEvidence || undefined,
      competencyId: c.competencyId || undefined,
    }));
  } catch {
    return [];
  }
}

/** Run the live Slack source. Throws if not configured. */
export async function fetchSlackCandidates(): Promise<Candidate[]> {
  if (!isSlackConfigured()) throw new Error('SLACK_BOT_TOKEN not set');
  const messages = await fetchSlackMessages();
  if (!isExtractorConfigured()) {
    // No LLM: surface raw messages as untriaged candidates for manual editing.
    return messages.slice(0, 10).map((m) => ({
      channel: m.channel,
      source: 'slack' as const,
      text: m.text,
      cat: 'sys' as const,
      title: m.text.split(/[.!?\n]/)[0].slice(0, 60),
      impact: 'Review and edit this auto-detected item.',
    }));
  }
  return extractCandidates(messages);
}
