---
description: Monthly Self-Eval sync — scan Slack + Meet notes and feed the dashboard's approval queue
argument-hint: "[base-url, e.g. http://localhost:8080]"
---

You are running the **monthly Self-Eval sync** for Akshita's dashboard at `/self-eval`.

Goal: scan Slack (and Google Meet / Gemini meeting notes) for the last ~5 weeks,
extract her Product-Manager accomplishments + Senior-PM competency evidence, and
POST them to the pipeline's sync endpoint. Everything you post lands as **pending
/ suggested** — she approves the final line items herself in the UI. Do NOT mark
anything final.

## 0. Base URL & server

- Base URL = `$ARGUMENTS` if provided, else `http://localhost:8080` (prod `npm start`)
  or `http://localhost:3000` (dev). If nothing is running, tell her to start it
  (`npm run dev`) and stop.
- Sanity check: `GET {base}/api/self-eval/state` should return JSON. If it 404s,
  the server isn't running or the path is wrong — stop and say so.

## 1. Pull sources (use her connectors — read only, never post to Slack/Gmail)

- **Slack**: read the last ~5 weeks of these channels: `#margin`, `#cs-team`,
  `#product`, `#bidding`, plus `#supply-eng`, `#cs-amazon` if present. Keep only
  messages that describe a real accomplishment **by Akshita** (kudos, shipped,
  closed, led, unblocked, delivered, approved). Ignore chatter.
- **Meet notes**: check Gmail for Gemini meeting-summary emails from the period;
  pull accomplishments/decisions credited to her.
- If a connector isn't authorized, note it and continue with what you have.

## 2. Map each item to a Candidate

Category (`cat`): `margin` · `cust` (customer) · `sys` (systems/data) · `lev` (leverage/team).

Senior-PM competencies (`competencyId`):
- c1 Handle features autonomously; oversee 1–2
- c2 Manage multiple initiatives; best practices; team productivity
- c3 Independently define & deliver outcomes
- c4 Analyze complex issues; long-term solutions; right calls autonomously
- c5 Influence design thinking; integrate user feedback
- c6 Product strategy; vision, market & customer alignment
- c7 Market insights & competition → shape strategy
- c8 Lead customer calls & research; advocate for customer
- c9 Own area roadmap; prioritise with stakeholders
- c10 Seek feedback; mentor; continuously learn
- c11 Drive motivation & alignment; recognised as leader
- c12 Comprehensive documents aligned to strategy
- c13 Cross-functional collaboration; trusted by stakeholders
- c14 Communicate concisely & confidently; argue persuasively

Each Candidate:
```json
{
  "channel": "#margin"  // or "gmeet:<meeting name>",
  "source": "slack"     // or "gmeet",
  "text": "<the raw snippet it came from>",
  "cat": "margin",
  "title": "<=8 words",
  "impact": "one-sentence outcome",
  "competencyId": "c4",              // best match, or omit
  "competencyEvidence": "short proof line"  // or omit
}
```

## 3. POST to the pipeline

```
POST {base}/api/self-eval/sync
Content-Type: application/json
{ "candidates": [ ...all candidates... ] }
```

The endpoint dedupes against existing items, so re-running is safe.

## 4. Report

Summarize: how many line items + competency suggestions were added, grouped by
category/competency, and remind her to open `{base}/self-eval` → **Jul–Dec** tab
to approve line items and **Level Up** to "Log it" on suggestions.
