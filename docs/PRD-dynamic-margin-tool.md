# PRD: Dynamic Margin (DM) Tool

**Status:** Draft — Solution Review
**Owner:** Akshita Kharbanda (Product, Performance)
**Last Updated:** 2026-07-08
**Target Release:** Live (internal tool, `release` branch)
**Availability:** Internal — Joveo Performance / Account Management teams
**Rationale:** Operational tooling for the team that manages client spend and margin day-to-day.

---

## 1. TL;DR (the one-paragraph version)

Joveo runs job ads for clients across dozens of publishers (Indeed, LinkedIn, job
boards, etc.). For every publisher we pay a **cost**, and we bill the client a
**price** on top — the gap between them is **Joveo's margin**. Today, someone has to
log in and hand-tune that margin (the "markup") publisher by publisher, campaign by
campaign, and re-check it constantly. It's slow, easy to get wrong, and money leaks
in both directions — we overspend past budgets, miss CPA targets, give away margin,
or lose ground to competitors.

**The Dynamic Margin tool automates this.** You tell it your goals in plain terms —
"don't spend more than $10k," "keep CPA under $20," "hold our margin at 30%," "match
Indeed's pricing," "give each job its own budget" — and it calculates the exact spend
and markup for *every publisher, on every day*, respecting **all** your goals at
once. It shows you a full preview first, and only writes the changes to the
publishers when you approve.

---

## 2. Background & the problem we're solving

### How margin works today (plain English)

For any slice of a campaign there are three money numbers:

| Term | Plain meaning |
|------|---------------|
| **Cost (VP Spend)** | What Joveo actually pays the publisher. |
| **Billed (CD Spend)** | What the client is charged. |
| **Markup / margin** | How much we bill *above* cost: `(Billed ÷ Cost − 1) × 100%`. If cost is $800 and we bill $1,000, the markup is **25%**. |

A "markdown" is the same idea expressed as a discount off the billed price — used for
a few goal types (per-job budgets and matching Indeed at the job level).

### The pain

- **Manual and static.** Margins are set by hand and rarely revisited. A campaign
  that was tuned last month may be badly mispriced today.
- **Money leaks 4 ways:** overspending past budget, missing CPA/CPC efficiency
  targets, giving away margin below what a contract allows, and overpaying relative
  to competitors like Indeed.
- **Doesn't scale.** A client can have hundreds of jobs across many publishers over a
  month. Tuning that by hand for every publisher × day is not feasible, so most cells
  never get optimized.
- **Risky.** A fat-fingered markup can misprice a client instantly with no preview,
  no guardrail, and no audit trail.

> ⚠️ **Assumed (needs validation with the team):** the specific frequency/impact of
> each leak above. The tool clearly *addresses* all four, but I don't have baseline
> numbers (e.g. "$X/month overspend") in front of me — see Success Criteria.

---

## 3. Who it's for

- **Performance / Account managers** — the primary users. They own client budgets,
  efficiency targets, and margin, and today do this tuning manually.
- **Product / Ops (you)** — configure runs, review previews, and audit what was
  pushed.

**Job to be done:** *"When a client's spend is drifting off-target, I want to reset
the right markup across every publisher and day in minutes — safely and provably —
so that I hit budget, efficiency, and margin goals without babysitting each cell."*

---

## 4. Key concepts (glossary in plain terms)

| Concept | What it means |
|---------|---------------|
| **Cell** | The smallest unit the tool works on: one **(entity × publisher × date)** combination. E.g. "Job Group A, on Indeed, on July 3rd." |
| **Entity level** | How broad a goal is: **Client → Campaign → Job Group → Job** (widest to narrowest). |
| **Goal** | A target or limit you set (budget, CPA, margin, etc.). You can stack **up to 4** at once. |
| **Ceiling** | A computed spending limit for a goal. When you have several goals, the **tightest (smallest) ceiling wins** — that's the "binding constraint." |
| **Writeable date** | A day the tool is allowed to change. Past days are locked unless you explicitly allow editing them. |
| **Pacing** | Spreading a budget evenly over time so it isn't blown on day one. |
| **Curl** | The write request that pushes a new markup/markdown to the publisher. |
| **Preview vs Execute** | Preview = a full "what would happen" report with zero side effects. Execute = actually pushes the changes and logs them. |

---

## 5. Goals & success criteria

### Product goals
1. Let a user express budget, efficiency, margin, and competitive goals **without
   touching a spreadsheet or a raw markup number.**
2. Compute a **safe, correct** new spend/markup for every cell that respects **all**
   active goals simultaneously.
3. Make every change **previewable and reversible-by-review** before it goes live,
   with a full audit trail after.

### Success Criteria

#### Lagging indicators (post-launch outcomes)
| Metric | Current | Target | Timeframe |
|--------|---------|--------|-----------|
| Time to re-tune a client's margins | `[PLACEHOLDER — hours, manual]` | Minutes | 1 quarter post-adoption |
| Clients breaching monthly budget | `[PLACEHOLDER — need baseline]` | ↓ significantly | 1 quarter |
| Campaigns hitting CPA/CPC target | `[PLACEHOLDER]` | ↑ | 1 quarter |
| Margin below contracted floor incidents | `[PLACEHOLDER]` | ~0 | Ongoing |

#### Leading indicators (pre-launch / early signals)
| Metric | Target | What it predicts |
|--------|--------|------------------|
| # of runs previewed by the team weekly | Growing | Adoption |
| Preview→Execute conversion rate | Healthy (not previewing then abandoning) | Trust in the output |
| Execute failure / retry rate | Low | Reliability of the write path |

> ⚠️ Metrics above are placeholders — I don't have baselines in hand. **Recommend
> pulling these from execution history (Postgres) before sign-off.**

---

## 6. How it works — three steps

```
  ①  CONFIGURE            ②  PREVIEW                 ③  EXECUTE
  Pick a client,      →   See a full "what would  →  Approve → tool writes the
  dates, and up to        happen" report, sliced      markups to the publisher
  4 goals + guardrails    4 ways. Nothing changes.    APIs and logs every one.
```

1. **Configure Run** — choose the client, a date range, and up to four goals, plus
   guardrails (pacing, exclusions, past-edit rules).
2. **Preview** — the server pulls live data (spend, clicks, applies, budgets,
   competitor stats), computes the new spend/markup per cell, and returns a report
   with four views: Entity summary, Entity × Publisher, cell-level Detail, and a Job
   Group / Campaign rollup. **No changes are made.**
3. **Execute** — re-runs the exact same math and pushes each allowed change to the
   publisher, with retries, a 400-block on anything dangerous (see guardrails), and a
   full audit + run-history record.

**The math is deterministic and runs on the server** — the same config always
produces the same result, and the UI never invents numbers.

---

## 7. The goal "levers" (what each one does)

| Goal | Plain-English purpose | The limit it computes |
|------|-----------------------|-----------------------|
| **BUDGET** | "Don't spend more than X in total." | The budget for that entity (minus spend already locked in). |
| **CPA** | "Keep cost per hire/apply at or under $X." | `target CPA × number of applies`. |
| **CPC** | "Keep cost per click at or under $X." | `target CPC × number of clicks`. |
| **CPAS** | "Keep cost per apply-start at or under $X." | `target CPAS × number of apply-starts`. |
| **FIXED_MARGIN** | "Hold our margin at the contracted %." | Caps billed spend so markup can't exceed that %. |
| **JOB_BUDGET** | "Give each job its own budget." | Per-job budget (from the client system or a manual fallback), with an overall job-group cap. |
| **INDEED** | "Stay competitive vs Indeed / a comparison client." | `competitor's metric × match% × our volume`. |

**Stacking goals:** set up to 4. The tool computes each ceiling and then applies the
**tightest one** — so you're always inside every limit at once.

**Guardrails (not goals, but safety rails):** pacing, writeable-date window,
exclusions, and extreme-markup confirmation — described in §9.

---

## 8. Worked examples & test cases (how the tool actually helps)

*These are the scenarios the tool is designed to handle. Numbers are illustrative but
follow the tool's real formulas.*

### Quick reference

| # | Scenario | What the tool does | Why it helps |
|---|----------|--------------------|--------------|
| 1 | Budget overspend | Caps spend at budget, spreads it across remaining days | No more blown budgets |
| 2 | Missing CPA target | Trims spend so CPA lands on target | Hits efficiency goals |
| 3 | Margin above contract | Caps billed spend to hold contracted margin | Honors client contracts |
| 4 | Multiple goals at once | Picks the tightest ceiling | Safe under every limit |
| 5 | Losing to Indeed | Prices to a % of the competitor | Stays competitive |
| 6 | Hundreds of jobs, own budgets | Per-job budgets + job-group cap | Scales beyond manual |
| 7 | Front-loaded spend | Paces budget across dates | Smooth delivery |
| 8 | Don't touch the past | Locks past dates | No accidental history edits |
| 9 | Protect a publisher | Excludes it from changes | Honors fixed deals |
| 10 | Bad-data / extreme markup | Blocks it, requires confirmation | Prevents mispricing disasters |
| 11 | No real change / no data | Skips the cell | No wasted writes |

---

### Example 1 — Stop a client from blowing the monthly budget

**Setup:** Client budget = **$10,000/month**. It's the 20th; current pace projects
**$13,000** by month-end. 10 editable days remain.

**What the tool does:** It sets the budget ceiling at $10,000, subtracts what's
already locked in on past (non-editable) days, and redistributes the remaining
allowance across the 10 open days *proportional to how each publisher/day has been
performing*. It then converts each new spend into a markup and previews it.

**Result:** Projected spend lands at **$10,000, not $13,000** — automatically, across
every publisher and day, in one run.

---

### Example 2 — Hit a CPA target that's drifting

**Setup:** A Job Group has a **target CPA of $20**. So far it generated **100
applies** while spending **$2,600** → actual CPA is **$26** (over target).

**Math:** Allowed spend = `$20 × 100 applies = $2,000`.

**What the tool does:** Caps the group's spend at $2,000 (down from $2,600) and
distributes the cut across its publishers/days.

**Result:** CPA returns to **$20**. The user never computed a markup — they just
typed "20."

---

### Example 3 — Never exceed a contracted margin

**Setup:** The client contract fixes Joveo's margin at **30%**. For a given cell the
publisher **cost is $800**.

**Math:** Max billed = `$800 × (1 + 30/100) = $1,040`, i.e. markup capped at 30%.

**What the tool does:** Even if a budget or CPA goal *would* allow billing more, the
FIXED_MARGIN ceiling caps billed spend so the markup can't climb above 30%.

**Result:** Margin stays exactly on contract — no manual policing, no awkward
over-charge conversations.

---

### Example 4 — Several goals at once (the "tightest wins" case)

**Setup:** One run with three goals on the same entity:
- Budget ceiling → **$10,000**
- CPA ceiling → **$8,500**
- Margin ceiling → **$9,200**

**What the tool does:** Computes all three, then uses the **smallest = $8,500**. The
preview labels the cell **CPA-constrained** so you can see *which* goal is binding.

**Result:** You're safely inside all three limits, and you can see *why* the number is
what it is.

---

### Example 5 — Stay competitive with Indeed

**Setup:** You want to match a competitor (comparison client) on Indeed at **90%** of
their efficiency. Their **Indeed CPA = $30**; our volume = **200 applies**.

**Math:** Target CPA = `$30 × 90% = $27`. Ceiling = `$27 × 200 = $5,400`.

**What the tool does:** Matches Indeed's pricing to within 90% at the job-group (or
job) level — with optional per-job-group override percentages if some groups need to
be more or less aggressive.

**Result:** We stay competitive where it matters without blindly overpaying.

---

### Example 6 — Hundreds of jobs, each with its own budget

**Setup:** A client has **50 jobs** in a job group. Most have their own budget in the
client system; a few have none → manual fallback of **$100 each**. The job group has
an overall cap of **$3,000**.

**What the tool does:** Applies each job's individual budget, *then* enforces the
group cap: even if the 50 jobs individually fit, if their **sum exceeds $3,000** the
tool scales them down proportionally so the group total lands at $3,000. Capped jobs
are flagged `JOBGROUP_BUDGET_CAPPED`.

**Result:** Both levels of budget are respected at once — impossible to manage by
hand at this scale.

---

### Example 7 — Don't front-load the budget (pacing)

**Setup:** **$7,000** left, **7 editable days**, strict **DAILY** pacing.

**What the tool does:** Sets a per-day ceiling of **$1,000/day** so the budget isn't
consumed in the first two days. (WEEKLY / BIWEEKLY options spread proportionally
across those windows instead.)

**Result:** Smooth, predictable delivery instead of a spend spike.

---

### Example 8 — Protect the past

**Setup:** Run covers **June 1–30**; today is **June 20**.

**What the tool does:**
- *Allow past edits = OFF* → only **June 20–30** are editable; earlier days stay
  exactly as they are.
- *Lookback = 7 days* → editable window opens back to **June 13**.

**Result:** No accidental rewriting of settled history; you control how far back the
tool can reach.

---

### Example 9 — Protect a specific publisher or campaign

**Setup:** Publisher X is on a fixed-rate deal you must not touch.

**What the tool does:** Add Publisher X (or a campaign/job group/job) to
**Exclusions**. Excluded cells **still appear in the preview** (so you see what *would*
have changed) but are reverted to current values and **never written**, flagged
`EXCLUDED_BY_USER`.

**Result:** You get full optimization everywhere else while honoring the fixed deal.

---

### Example 10 — Catch a bad-data / extreme markup before it ships

**Setup:** Dirty upstream data would require a markup of **−650%** on a cell (nonsense).

**What the tool does:** Flags it `EXTREME_NEGATIVE_MARKUP` and **blocks it**. On
Execute, if any such cell exists, the API returns a **400 error listing the offending
cells** — it will only proceed if the user explicitly confirms
(`confirm_extreme_markup = true`).

**Result:** A single bad number can't silently misprice a client. A human decides.

---

### Example 11 — Skip no-ops and empty cells

**Setup:** For many cells, the newly-computed markup equals the current one, or the
cell has zero cost / no data.

**What the tool does:** Flags them (`NO_CHANGE`, `VPSPEND_ZERO`,
`ENTITY_SKIPPED_NO_DATA`) and **skips** them — no pointless write, no wasted API call.

**Result:** Executes are fast and clean; only real changes are pushed.

---

## 9. Guardrails & safety (built in)

- **Preview before Execute** — every run is fully previewable with zero side effects.
- **Writeable-date window** — past dates are locked unless explicitly allowed.
- **Exclusions** — protect any publisher / campaign / job group / job.
- **Pacing** — optional strict daily/weekly/biweekly ceilings.
- **Extreme-markup block** — dangerous swings require explicit confirmation.
- **Distribution safety** — if spend can't be feasibly allocated after a few
  re-balancing passes, the cell is flagged `INFEASIBLE_DISTRIBUTION` and blocked
  rather than pushed anyway.
- **Reliability on write** — retries with backoff on server errors, a 30s timeout,
  and max-10 concurrent writes.
- **Full audit trail** — every attempt (sent / success / failed / retry) is logged,
  and each run is saved to execution history.
- **Reusable configs** — save, rename, and re-run configurations; browse past runs.

---

## 10. Non-goals

- **Not** a bidding-algorithm replacement — it sets margin/markup on top of existing
  delivery, it doesn't decide *which* jobs to advertise.
- **Not** a client-facing product — internal team tool only.
- **Not** a real-time/always-on optimizer — it runs on demand (Configure → Preview →
  Execute), not as a continuous background loop.
- **Not** a forecasting tool — it acts on current/actual data, not projections beyond
  the pacing split.

---

## 11. Dependencies

### Feature / data
- **Snowflake** — tracking data (clicks/spend/applies), entity metadata (budgets,
  CPA/CPC goals), markup & job grids, Indeed/competitor stats, current date.
- **Publisher audit/write API** — where markups/markdowns are actually applied.
- **Postgres** — stores audit log + run history.
- **Heimdall/Accounts auth** — production access is gated behind Joveo SSO.

### Team
- **Performance/Account team** — provides the real budget/CPA/margin baselines the
  success metrics need, and validates the goal definitions.
- **Data/Platform** — owns the Snowflake tables and the publisher write API contract.

### Critical path
- **Publisher write API stability & correctness.** If the write endpoint changes or
  is unreliable, Execute breaks — this is the single riskiest external dependency.

---

## 12. Risks & mitigations

*V=Value, U=Usability, F=Feasibility, B=Business viability · Impact H/M/L*

| Risk | Type | Impact | Mitigation |
|------|------|--------|------------|
| Users don't trust the computed numbers and keep tuning by hand | V | H | Preview shows the *binding constraint* per cell and full breakdowns; dogfood with a few managers first. |
| Wrong goal picked → mispriced client | U | H | Preview-before-execute, fallback modal when no entity is chosen, extreme-markup confirmation. |
| Stale/dirty Snowflake data → bad ceilings | F | M | Zero/no-data guards, extreme-markup block; surface flags prominently in preview. |
| Publisher API changes or fails mid-run | F | H | Retries + backoff, per-cell success/failure logging, run history for re-run. |
| Margin cap misunderstood (it caps, not floors) | U | M | Clear labeling in UI + this PRD; consider renaming in-product. |
| Concurrent runs on the same client overwrite each other | F | M | ⬜ Needs a locking/last-writer policy — see open questions. |

---

## 13. Open questions

| Question | Assumption | How to validate | Timeline |
|----------|-----------|-----------------|----------|
| What are the real baselines for the success metrics? | Manual tuning takes hours; overspend is common | Pull from Postgres execution history + interview 3 managers | Before sign-off |
| Should two people running the same client at once be blocked? | Rare today | Check history for overlapping runs; decide on a lock | Before wider rollout |
| Is "FIXED_MARGIN caps margin" the intended semantic (vs a floor)? | Yes — contractual ceiling | Confirm with Account team | Before sign-off |
| Do managers want a scheduled/automated re-run, or keep it on-demand? | On-demand is enough for v1 | 3–5 user interviews | Next planning cycle |

---

## 14. Before finalizing
- [ ] Replace all `[PLACEHOLDER]` metrics with real baselines from execution history.
- [ ] Confirm the `FIXED_MARGIN` semantic (ceiling vs floor) with the Account team.
- [ ] Validate the four "money leak" claims with actual incident data.

## 15. Sign-off
| Role | Name | Approved |
|------|------|----------|
| Product | Akshita Kharbanda | ⬜ |
| Engineering | | ⬜ |
| Performance / Account lead | | ⬜ |
