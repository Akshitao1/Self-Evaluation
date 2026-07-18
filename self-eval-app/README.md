# Self-Evaluation — standalone app (Vercel-ready)

A self-contained deploy of the self-eval dashboard + auto-sync pipeline. No Joveo
auth, proxy, or AWS secrets — just the dashboard, its API, and a Google Sheet
for storage. The main repo keeps the version wired into the DM-tool app.

- Dashboard: `/self-eval` (`/` redirects there)
- API: `/api/self-eval/{state,sync,cron}`
- Store: one cell of a Google Sheet (durable on Vercel). Falls back to a local
  `.data/self-eval.json` when no sheet is configured, so `npm run dev` just works.

## Deploy to Vercel

1. **Push this repo** (already done for the main repo). In the Vercel project,
   set **Root Directory = `self-eval-app`**.
2. **Create a Google Sheet** for the data. Copy its id from the URL
   (`docs.google.com/spreadsheets/d/<ID>/edit`).
3. **Service account**: you can reuse the existing one
   (`coder-536@jaas-282904.iam.gserviceaccount.com`) or make a new one with the
   Google Sheets API enabled. **Share the sheet with the service-account email**
   (Editor).
4. **Env vars** (Vercel → Project → Settings → Environment Variables):
   | var | value |
   |-----|-------|
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | the full service-account JSON, one line |
   | `SELF_EVAL_SHEET_ID` | the sheet id from step 2 |
   | `CRON_SECRET` | (optional) protects `/api/self-eval/cron` |
   | `SLACK_BOT_TOKEN`, `ANTHROPIC_API_KEY`, … | (optional) only for live in-app Slack pulls |
5. **Deploy.** First load seeds the sheet automatically.

> No `SLACK_BOT_TOKEN`? That's expected — you feed the pipeline monthly by running
> `/self-eval-sync` in Claude (it scans Slack/Meet with your connectors and POSTs
> candidates to `/api/self-eval/sync`). Point that command's base URL at your
> Vercel URL. Nothing becomes a final line item without your approval in the UI.

## Local dev

```bash
npm install
npm run dev          # http://localhost:3000/self-eval
```
Without Google env vars it uses a local `.data/self-eval.json` file so you can
test the full flow offline.

## Reset

`POST /api/self-eval/state {"action":"reset"}` restores the seed.
