# Self-Eval pipeline

Auto-detects accomplishments from Slack + Meet notes into an **approval queue**,
and maintains the **Level Up** Senior-PM evidence log. Nothing becomes a final
line item without your approval.

## Pieces

- `types.ts` — shared types (client + server).
- `seed.ts` — initial pending queue + the 14 Senior-PM competencies.
- `store.ts` — durable JSON store at `.data/self-eval.json` (override dir with `SELF_EVAL_DATA_DIR`). All writes are serialized; swap for a Sheet/DB later without touching callers.
- `sources.ts` — live Slack fetch + Claude extraction, with a demo fallback.
- API: `GET/POST /api/self-eval/state` (read + actions), `POST /api/self-eval/sync` (run a sync), `GET|POST /api/self-eval/cron` (scheduled trigger).

## Flow

```
Slack / Meet ──► sync ──► pending (auto-detected) ──► you approve ──► final line item
                    └────► competency "suggested" evidence ──► you "Log it" ──► Level Up log + rating up
```

## Modes (auto-selected by /api/self-eval/sync)

1. **External candidates** — POST `{ "candidates": [ … ] }`. Use this from a
   scheduled Claude agent that scans Slack/Gmail/Meet with *your* connectors and
   posts structured candidates. No server secrets needed.
2. **Live Slack** — set `SLACK_BOT_TOKEN` and the server pulls Slack + extracts
   with Claude on every sync.
3. **Demo** — no config: one rotating simulated item per sync, so the UI is
   fully demoable.

## Enable live Slack (mode 2)

Set on the server (e.g. via Secrets Manager / env):

| var | purpose |
|-----|---------|
| `SLACK_BOT_TOKEN` | Slack bot token (`xoxb-…`) with `channels:history`, `channels:read` |
| `SELF_EVAL_SLACK_CHANNELS` | channels to watch, e.g. `margin,cs-team,product,bidding` |
| `SELF_EVAL_PERSON` | whose accomplishments to detect (default `Akshita`) |
| `ANTHROPIC_API_KEY` | turns raw messages into titled line items + competency evidence |
| `SELF_EVAL_MODEL` | optional model id (default `claude-sonnet-5`) |

Invite the bot to each watched channel. Meet notes usually need per-user Google
OAuth, so feed them via mode 1 (a scheduled agent using your Gmail connector).

## Schedule the auto-sync

Protect the cron route with `CRON_SECRET`, then hit it on an interval:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/self-eval/cron
```

Wire that to PM2 cron, system crontab, Vercel Cron, or a Claude Code routine
(the `schedule` skill). Each run appends new pending items / suggestions — it
never marks anything final.

## Reset

`POST /api/self-eval/state {"action":"reset"}` restores the seed.
