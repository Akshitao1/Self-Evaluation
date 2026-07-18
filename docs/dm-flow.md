# DM Tool — Process Flow: Configure Run → Preview → Execute

This document is a from-scratch reference for the two main screens of the
Demand-Management (DM) tool and everything they touch:

- **Configure Run** — [`src/app/(dm)/create/page.tsx`](../src/app/(dm)/create/page.tsx)
- **Preview** — [`src/app/(dm)/preview/page.tsx`](../src/app/(dm)/preview/page.tsx)

It explains, case by case, what every form value does, how the data flows to the
backend, what the backend pipeline computes, and how the preview is rendered. It
ends with a full reference for the API layer, the store, the types, and the
difference between Preview and Execute.

---

## 1. What this tool is

The DM tool adjusts how much money is spent ("bids") per **cell**, where a *cell*
is the combination **(entity × publisher × date)**. For a chosen client and date
range, you define one or more **goals** (budget caps, CPA/CPC/CPAS targets, fixed
margin, Indeed-matching, etc.). The backend then computes a new spend per cell that
respects those goals, and expresses the change as a **markup** or **markdown**
percentage. **Preview** shows the proposed changes; **Execute** actually pushes them
to the publisher APIs.

The flow is three pages:

```
/create  (Configure Run)  →  /preview  (review proposed changes)  →  /execute  (apply)
```

### Glossary

| Term | Meaning |
|------|---------|
| **Cell** | One row of work: `(entity_id, publisher_id, event_publisher_date)`. The atom the pipeline computes on. |
| **Entity level** | Granularity of a goal: `CLIENT → CAMPAIGN → JOBGROUP → JOB` (broad → narrow). |
| **Goal** | A constraint/target. Up to 4 per config. Drives both the pipeline math and the Preview columns. |
| **Ceiling** | A computed upper bound on spend for an entity (budget/metric/pacing/indeed/margin). The **binding** ceiling is the smallest one. |
| **VPSpend** | Vendor/publisher spend (the underlying cost). |
| **MOJOSpend** | Joveo's internal cost basis used for **markup**. |
| **CDSpend** | "Client-direct" spend — what the client is billed. `CDSpend_current` vs `CDSpend_NEW`. |
| **Markup** | `(CDSpend_NEW / MOJOSpend − 1) × 100`. Used for most goals. |
| **Markdown** | `(1 − VPSpend / CDSpend_NEW) × 100`. Used for `JOB_BUDGET` and JOB-level `INDEED`. |
| **Curl** | The HTTP write request that applies a markup/markdown to the publisher API. |
| **Writeable date** | A date the run is allowed to edit (governed by past-edit config). Non-writeable cells keep current spend. |
| **Pacing** | Spreading a budget across dates so it isn't spent all at once. |

---

## 2. End-to-end data flow

```
┌─────────────────────────── /create (ConfigPage) ───────────────────────────┐
│  form: DMConfig (client_id, dates, goals[], pacing, exclusions, past_edit)  │
│  ClientPicker / DatePicker / GoalRow(s) / ExclusionsCard                    │
│                                                                             │
│  "Generate Preview"  → handlePreview() → buildPendingConfig()               │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                       │ fetchPreview(config)
                                       ▼
                          POST /api/dm/preview   (api.ts)
                                       │
                                       ▼
                       runPipeline(config)  (server/dm/pipeline.ts)
        ┌──────────────────────────────────────────────────────────────┐
        │ 1 runAllQueries (Snowflake)        6 computeIndeedCeilings     │
        │ 2 resolveWriteableDates            7 annotate per-entity       │
        │ 3 resolveCurlType (MARKUP/MARKDOWN)   ceilings                 │
        │ 4 buildCellsFromGrid               8 distributeSpend (+JG cap) │
        │ 5 computePacing                    9 computeAllMarkups         │
        │                                      + applyExclusions         │
        └──────────────────────────────────────────────────────────────┘
                                       │ buildPreview() → PreviewRow[]
                                       ▼
        store.setPreview(rows) + setEntities(...)  →  router.push("/preview")
                                       │
                                       ▼
┌──────────────────────────── /preview (PreviewPage) ─────────────────────────┐
│  Reads preview[], config, entities from store.                              │
│  4 tabs: Entity Summary · Entity×Publisher · Detail · Rollup                │
│  "Proceed to Execute" → /execute                                            │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                       │ executeRun(ExecuteRequest)
                                       ▼
                          POST /api/dm/execute   (api.ts)
                runPipeline(...) again → executeCurls() → publisher APIs
                       + persists run to Postgres history
```

**Key point:** the pipeline is deterministic and runs on the **server**. The
frontend never computes new spend — it only assembles a `DMConfig`, sends it, and
renders the `PreviewRow[]` that comes back.

---

## 3. The Configure Run page (`/create`)

File: [`src/app/(dm)/create/page.tsx`](../src/app/(dm)/create/page.tsx)

### 3.1 Component map

| Component | Lines | Role |
|-----------|-------|------|
| `ConfigPage` | [47](../src/app/(dm)/create/page.tsx#L47) | The page. Owns the `form` state and all entity-loading logic. |
| `GoalRow` | [775](../src/app/(dm)/create/page.tsx#L775) | One goal card. Renders different controls per `goal_type`. |
| `IndeedOverridesSection` | [1205](../src/app/(dm)/create/page.tsx#L1205) | Per-jobgroup `match_pct` overrides for INDEED goals. |
| `FallbackModal` | [687](../src/app/(dm)/create/page.tsx#L687) | Warns when a goal will run at client level because no entity was picked. |
| `SaveDialog` | [719](../src/app/(dm)/create/page.tsx#L719) | Label input for Save / Save As / Rename. |
| `Field` | [1351](../src/app/(dm)/create/page.tsx#L1351) | Small label + input wrapper. |

### 3.2 State

`ConfigPage` keeps the editable config in a **local** `form` state
([63](../src/app/(dm)/create/page.tsx#L63)) and syncs to the global store only when
generating a preview or saving. Per-goal entity lists live in index-keyed maps:

| State | Purpose |
|-------|---------|
| `form: DMConfig` | The config being edited. |
| `entitiesMap[idx]` | Auto-fetched entity list for goal `idx` (campaigns/jobgroups/jobs with DB values). |
| `selectMode[idx]` | Whether goal `idx` is in "run on selected only / per-entity values" mode. |
| `manualEntitiesMap[idx]` | Entity list for the **JOB_BUDGET manual-budget** table. |
| `indeedJgsMap[idx]` | Jobgroup list for **INDEED match_pct overrides**. |
| `entityFetchErrors[idx]` | Per-goal fetch error message. |
| `fallbackModal` / `saveDialog` / `saveNotice` / `newRunConfirm` | Modal/notification flags. |

### 3.3 When entities auto-load — `shouldAutoFetch`

[Lines 25–29](../src/app/(dm)/create/page.tsx#L25). A goal auto-fetches its entity
list (so you can pick specific entities and see DB values) when:

- `entity_level === "CAMPAIGN"` → always; **or**
- `goal_type === "CPAS"` **and** `entity_level === "JOBGROUP"`; **or**
- `goal_type ∈ {BUDGET, CPA, CPC, JOB_BUDGET}` **and** `entity_level ∈ {CLIENT, CAMPAIGN, JOBGROUP, JOB}`.

Auto-fetch truth table (✓ = entity list loads automatically):

| goal_type \ level | CLIENT | CAMPAIGN | JOBGROUP | JOB |
|-------------------|:------:|:--------:|:--------:|:---:|
| **BUDGET**        | ✓ | ✓ | ✓ | ✓ |
| **CPA**           | ✓ | ✓ | ✓ | ✓ |
| **CPC**           | ✓ | ✓ | ✓ | ✓ |
| **CPAS**          | ✗ | ✓ | ✓ (special) | ✗ |
| **JOB_BUDGET**    | (forced to JOB) | — | — | ✓ |
| **INDEED**        | ✗ | ✓ | ✗ | ✗ |
| **FIXED_MARGIN**  | — (no entity level) | — | — | — |

Three loaders fire `fetchEntities()` for different purposes:
`loadEntities` (auto-fetch list, [91](../src/app/(dm)/create/page.tsx#L91)),
`loadManualEntities` (JOB_BUDGET manual budgets, [114](../src/app/(dm)/create/page.tsx#L114)),
`loadIndeedJgs` (INDEED overrides, [127](../src/app/(dm)/create/page.tsx#L127)).

### 3.4 Rehydration from saved configs / history

When a config is loaded elsewhere (Saved Configs or Execution History), the store's
`loadConfigFromHistory` bumps `loadSeq`. The effect at
[151–168](../src/app/(dm)/create/page.tsx#L151) watches `loadSeq`, copies the store
config into local `form`, clears all entity maps, and re-runs auto-fetch for each
goal. This is why the form re-populates after you click "Load" on a saved config.

---

### 3.5 Card-by-card walkthrough

#### Card: Client & Date Range — [475–506](../src/app/(dm)/create/page.tsx#L475)

- **Client** (`ClientPicker`): on change, sets `form.client_id` + `clientMeta`,
  **wipes all entity maps**, and re-fetches entities for every auto-fetch goal with
  the new client. `clientMeta` (id/name/agency/status) is what gets persisted when
  you save a config.
- **Start Date / End Date** (`DatePicker`): write `start_date` / `end_date`
  (`"YYYY-MM-DD"` strings). They bound the Snowflake queries and the writeable-date
  window.

#### Card: Goals (1–4) — [508–545](../src/app/(dm)/create/page.tsx#L508)

Up to 4 goals. `addGoal` ([232](../src/app/(dm)/create/page.tsx#L232)) appends an
empty `BUDGET/CLIENT` goal; `removeGoal` ([241](../src/app/(dm)/create/page.tsx#L241))
deletes and **reindexes** all the index-keyed maps. `updateGoal`
([170](../src/app/(dm)/create/page.tsx#L170)) is the central mutator — note it
clears INDEED-only fields whenever you switch away from INDEED, and forces
`entity_level = JOB` when you pick `JOB_BUDGET`.

The **first goal's `entity_level`** is special: it sets the grain of the whole
preview (the Preview page keys its tables off `config.goals[0].entity_level`).

##### Per-goal-type cases (the "case for each form value")

Each `GoalConfig` always has `goal_type`, `entity_level`, `entity_id`. The extra
fields and UI depend on the type:

---

**`BUDGET`** — cap total CD spend at a budget.
- Auto-fetches the entity list. Default UI: *"All {entities} · N total"* with a
  **"Run on selected only"** toggle ([898–933](../src/app/(dm)/create/page.tsx#L898)).
- Toggling on (or when no entity has a DB budget) shows the **per-entity value
  table** → writes `per_entity_values: { entity_id: number }`.
- Picking a single entity from the list sets `entity_id` and pre-fills `value` from
  `EntityInfo.budget` via `getValueFromEntity` ([31](../src/app/(dm)/create/page.tsx#L31)).
- Resulting fields: `value` and/or `per_entity_values`.

**`CPA` / `CPC`** — target cost per acquisition / per click.
- Same auto-fetch + per-entity editor as BUDGET. Default `value` is sourced from
  `EntityInfo.cpa` / `EntityInfo.cpc`.
- Resulting fields: `value` and/or `per_entity_values`.

**`CPAS`** — target cost per apply-start.
- Auto-fetches **only** at CAMPAIGN or JOBGROUP level (see truth table). At other
  levels it falls into the manual `Entity ID` + `Value` path
  ([1136–1145](../src/app/(dm)/create/page.tsx#L1136)).

**`JOB_BUDGET`** — per-job budgets; **forces `entity_level = JOB`** and the select is
disabled ([848–850](../src/app/(dm)/create/page.tsx#L848)).
- **Budget Level** (`budget_level`, [875–896](../src/app/(dm)/create/page.tsx#L875)):
  - `JAX` — budget taken directly from the current JAX client.
  - `MAIN` — budget from the parent/main client; non-JAX publisher spend is subtracted.
- Per-entity table shows a **Frequency** badge from `EntityInfo.budget_cap_frequency`.
- **Manual budget fallback** ([1010–1133](../src/app/(dm)/create/page.tsx#L1010)) for
  jobs that have no DB budget — `manual_budget_level`:
  - `None (DB only)` — jobs without a DB budget get no cap.
  - `CLIENT` — one flat `value` shared by all such jobs.
  - `CAMPAIGN` / `JOBGROUP` — loads that level's entities (`loadManualEntities`) and
    shows a per-entity budget table → `manual_budget_values: { entity_id: number }`,
    plus an optional flat `value` as fallback for unmatched jobs.
- Resulting fields: `budget_level`, `value`, `manual_budget_level`,
  `manual_budget_values`.

**`INDEED`** — match a competitor (comparison client) metric.
[1158–1200](../src/app/(dm)/create/page.tsx#L1158). Four inputs:
- **Match %** (`match_pct`) — target = comparison metric × match_pct.
- **Metric** (`indeed_metric`) — `CPA` or `CPC`; decides which volume/metric is compared.
- **Comparison Entity** (`comparison_entity_id`) — a second `ClientPicker`;
  `disallowClientId` prevents picking the same client. Stored meta → `comparisonMeta[idx]`.
- **Publisher Name** (`indeed_publisher_name`) — e.g. `"Indeed"`.
- **Per-jobgroup overrides** (`IndeedOverridesSection`, [1205](../src/app/(dm)/create/page.tsx#L1205)):
  only valid at `JOBGROUP`/`JOB` level. Loads jobgroups (`loadIndeedJgs`), lets you
  set `match_pct_overrides: { jobgroup_id: number }`. If overrides exist at a wrong
  level, a warning with a **Clear** action is shown instead
  ([1230–1245](../src/app/(dm)/create/page.tsx#L1230)).

**`FIXED_MARGIN`** — keep a fixed margin %. [1147–1156](../src/app/(dm)/create/page.tsx#L1147).
- No entity level (the goal grid is single-column). A single **Margin %** → `value`.
- Applies to all entities; no cell will breach this margin within its budget.

> **Manual fallback path** ([1136–1145](../src/app/(dm)/create/page.tsx#L1136)):
> for any non-auto-fetch, non-INDEED, non-FIXED_MARGIN goal, you type the
> `entity_id` and `value` directly.

#### Card: Pacing — [547–587](../src/app/(dm)/create/page.tsx#L547)

- **Strict Pacing** (`pacing_config.strict`): `false` = "no ceiling" (spend isn't
  paced across dates); `true` = enforce a per-window ceiling. Turning it on defaults
  `window` to `DAILY`.
- **Window** (`pacing_config.window`, only shown when strict): `DAILY | WEEKLY | BIWEEKLY`.

#### Card: Exclusions — [589](../src/app/(dm)/create/page.tsx#L589)

`ExclusionsCard` ([`src/components/ExclusionsCard.tsx`](../src/components/ExclusionsCard.tsx))
edits `form.exclusions` (`ExclusionConfig`): four ID lists —
`campaign_ids`, `jobgroup_ids`, `job_ids`, `publisher_ids`. Excluded cells still
appear in the preview but are reverted to current values and never written.

#### Card: Past Edits — [591–628](../src/app/(dm)/create/page.tsx#L591)

- **Allow Past Edits** (`past_edit_config.allow_past_edits`): `false` = future dates
  only; `true` = allow editing past dates.
- **Lookback Days** (`lookback_days`, only when allowed): blank = unlimited, else
  the run can edit back this many days from today.

### 3.6 Actions

#### Generate Preview — [289–318](../src/app/(dm)/create/page.tsx#L289)

1. `handlePreview` scans for goals that need an entity but have none picked (skips
   CLIENT-level, FIXED_MARGIN, and manual-budget goals). If any are missing it opens
   the **FallbackModal** — confirming runs those goals at **client level**.
2. `buildPendingConfig` ([259](../src/app/(dm)/create/page.tsx#L259)) sets each
   goal's `entity_id` to `client_id` if it was left blank.
3. `runPreview` ([269](../src/app/(dm)/create/page.tsx#L269)): `setConfig(cfg)`,
   pushes all loaded entities into the store via `setEntities`, calls
   `fetchPreview(cfg)`, `setPreview(rows)`, and routes to `/preview`. Errors are
   humanized via [`humanizeError`](../src/lib/errors.ts).

#### Save / Save As / Rename / Update — [320–379](../src/app/(dm)/create/page.tsx#L320)

- If `savedConfigId` is null → **Save Config** opens SaveDialog → `createSavedConfig`
  (persists label + config + client meta) and stores the returned id/label.
- If editing an existing config → **Save** (`updateExisting` → `updateSavedConfig`
  with new config), **Rename** (`renameExisting` → update label), **Save As…**
  (`saveAsNew` → create a copy).
- `savedConfigId`/`savedConfigLabel` drive which buttons appear and the
  "Editing saved config …" subtitle.

#### New — [381–402](../src/app/(dm)/create/page.tsx#L381)

`handleNewRun` clears the form. If the form is "dirty" (a saved config is loaded, a
client is picked, or any goal has a value), it first asks for confirmation
([651–682](../src/app/(dm)/create/page.tsx#L651)), then calls `resetForNewRun()`.

---

## 4. The Preview page (`/preview`)

File: [`src/app/(dm)/preview/page.tsx`](../src/app/(dm)/preview/page.tsx)

Reads `preview`, `config`, and `entities` from the store
([302](../src/app/(dm)/preview/page.tsx#L302)). If `preview` is empty it shows a
"No preview data → Go to Config" placeholder
([325–333](../src/app/(dm)/preview/page.tsx#L325)).

Header shows client + date range + cell count, an **EXCLUDED_BY_USER** banner with a
**Hide excluded** checkbox ([369–386](../src/app/(dm)/preview/page.tsx#L369)), and a
**Proceed to Execute** button. The grain (`levelName`) comes from
`config.goals[0].entity_level`.

### 4.1 Dynamic columns — `goalColumnDefs`

[67–135](../src/app/(dm)/preview/page.tsx#L67). The goal-target/metric columns shown
in every table are generated from `config.goals` (deduped across goals). Mapping:

| goal_type | Columns added |
|-----------|---------------|
| `BUDGET` | `{level} Budget` (target) |
| `JOB_BUDGET` | `Job Budget` (target) |
| `CPA` | `{level} CPA Target`, `Current CPA`, `New CPA` |
| `CPC` | `{level} CPC Target`, `Current CPC`, `New CPC` |
| `CPAS` | `{level} CPAS Target`, `Current CPAS`, `New CPAS` |
| `FIXED_MARGIN` | `Fixed Margin%`, `Current Margin%`, `New Margin%` |
| `INDEED` | `Indeed Spend`, `Indeed Applies/Clicks`, `Indeed {metric}`, `Indeed {metric} Target`, `Current/New {CPA|CPC}`, `Indeed Ceiling` |

Cell values are computed by `goalCellValue` (aggregated rows,
[169](../src/app/(dm)/preview/page.tsx#L169)) and `goalCellValueForRow` (single cell,
[230](../src/app/(dm)/preview/page.tsx#L230)). Targets prefer the backend-computed
`goal_targets` dict, falling back to `per_entity_values → goal.value → DB value`
(`resolveTarget`, [154](../src/app/(dm)/preview/page.tsx#L154)).

### 4.2 Tabs

`tabDefs` ([341–349](../src/app/(dm)/preview/page.tsx#L341)). The 4th tab only shows
when rows carry a `job_group_id`/`campaign_id` (`hasHierarchy`).

#### Tab 1 — `{level} Summary` (`EntityTab`, [427](../src/app/(dm)/preview/page.tsx#L427))
Groups cells by `entity_id`. Columns: entity, Clicks, Apply Starts, Applies, VP
Spend, Mojo Spend, CD Spend, New CD Spend, dynamic goal columns, Adjustment,
Adj %. Adjustment = `cdNew − cdCurrent`. Stat cards: entity count, total clicks,
total applies, total adjustment, **Final Margin %** (`(cdNew/vpspend − 1)×100`).
Sortable by any base column.

#### Tab 2 — `{level} × Publisher` (`PublisherTab`, [611](../src/app/(dm)/preview/page.tsx#L611))
Groups by `entity_id::publisher_id`. Adds avg **markup_new** / **markdown_new** over
writeable cells. Renders a **"Spend by Publisher — Current vs New"** bar chart
(top 15 publishers by new spend, [715–729](../src/app/(dm)/preview/page.tsx#L715))
and the breakdown table (adds a **Dates** = cell-count column).

#### Tab 3 — `{level} × Publisher × Date` Detail (`DetailTab`, [823](../src/app/(dm)/preview/page.tsx#L823))
One row per `PreviewRow`. Has a **publisher filter** dropdown and a **Spend Over Time
by Publisher** line chart (dashed = current, solid = new, top 8 publishers,
[908–934](../src/app/(dm)/preview/page.tsx#L908)). Table adds:
- **Markup/down** — `markdown_new` if `curl_type === "MARKDOWN"` else `markup_new`.
- **Writeable** — `is_writeable` Yes/No.
- **Blocked** — `Excluded` (EXCLUDED_BY_USER) / `Blocked` (`curl_blocked`) / `OK`.
- **Flags** — `row.flags.join(", ")`.

#### Tab 4 — Job Group / Campaign Rollup (`RollupTab`, [1076](../src/app/(dm)/preview/page.tsx#L1076))
Toggle between **JOB_GROUP** and **CAMPAIGN**
([1233–1247](../src/app/(dm)/preview/page.tsx#L1233)). Aggregates spend per group and:
- JOB_GROUP budget cap from `job_group_budget`; CAMPAIGN cap = sum of child jobgroup
  budgets ([1127–1141](../src/app/(dm)/preview/page.tsx#L1127)).
- Counts jobs flagged `JOBGROUP_BUDGET_CAPPED` and tallies `binding_constraint`.
- Columns: group, Jobs (+capped count), [Job Groups if campaign], Clicks/Apply
  Starts/Applies, VP/Mojo/CD/New CD, Current CPA, New CPA, [Budget Cap, Utilization%
  when any budget], Adjustment, Adj %, Top Binding.
- Rows where `cdNew > budgetCap` are highlighted red; over-budget group count and
  top bindings appear above the table.

---

## 5. The backend pipeline

File: [`src/lib/server/dm/pipeline.ts`](../src/lib/server/dm/pipeline.ts) — single
export `runPipeline(config): PipelineResult` ([445](../src/lib/server/dm/pipeline.ts#L445)).
Engines live in [`src/lib/server/dm/engines/`](../src/lib/server/dm/engines/).

### 5.1 The nine steps

1. **`runAllQueries(config)`** — Snowflake queries: tracking data (clicks/spend/
   conversions), entity metadata (budgets, CPA/CPC goals), markup & job grids,
   Indeed stats, and the current date.
2. **`resolveWriteableDates`** (`engines/writeable-dates.ts`) — from
   `past_edit_config`: if `allow_past_edits=false`, start at today; else if
   `lookback_days=null`, start at `start_date`; else `max(start_date, today −
   lookback_days)`. Returns the editable date list. Non-writeable cells are locked to
   current spend.
3. **`resolveCurlType`** (`engines/curl-type-resolver.ts`) — `MARKDOWN` if any goal is
   `JOB_BUDGET`, or `INDEED` at `JOB` level; otherwise `MARKUP`. MARKDOWN works off
   `VPSpend`, MARKUP off `MOJOSpend`.
4. **`buildCellsFromGrid`** — builds `Cell` objects (publisher/date/entity, current
   spend, clicks/applies, current markup/markdown) from the appropriate grid.
5. **`computePacing`** (`engines/pacing.ts`) — per-entity, per-date ceiling. Not
   strict → `Infinity` (no constraint). Strict → distribute remaining budget across
   writeable dates: `DAILY` equal split, `WEEKLY`/`BIWEEKLY` proportional to days in
   each window.
6. **`computeIndeedCeilings` / `…ByEntity`** (`engines/indeed-mapper.ts`) — for INDEED
   goals. JOB/CLIENT level matches job refs to Indeed's stats; JOBGROUP/CAMPAIGN
   matches by entity name. Target metric = Indeed metric × `match_pct`; ceiling =
   target × our volume (Applies for CPA, Clicks for CPC).
7. **Per-entity ceiling annotation** — for each entity, attaches
   `budget_ceiling`, `metric_ceiling`, `pacing_ceiling`, `indeed_ceiling`,
   `margin_ceiling`, and a `goal_targets` dict to its cells.
8. **`distributeSpend`** (`engines/distribution.ts`) + **`applyJobgroupAggregateCap`** —
   the entity's total new spend = **min of all active ceilings** (the binding one).
   That total is allocated across writeable cells proportional to current spend, then
   re-normalized (≤3 iterations) to respect each cell's ceiling; non-convergence flags
   `INFEASIBLE_DISTRIBUTION`. For JOB-level primary goals, jobgroup aggregate caps are
   then enforced so the sum of jobs can't exceed a jobgroup budget.
9. **`computeAllMarkups`** (`engines/markup-calculator.ts`) + **`applyExclusions`**
   (`engines/exclusions.ts`) — convert `CDSpend_NEW` to markup/markdown, then revert
   excluded cells.

### 5.2 Ceiling formulas by goal type

| Goal | Ceiling (per cell unless noted) |
|------|---------------------------------|
| `BUDGET` / `JOB_BUDGET` | Effective budget for the entity (per-entity value or DB), minus already-incurred spend for LIFETIME frequency. `JOB_BUDGET` resolves JAX vs MAIN and manual-budget overrides. |
| `CPA` | `target_cpa × Apply` |
| `CPC` | `target_cpc × Clicks` |
| `CPAS` | `target_cpas × Apply_start` |
| `FIXED_MARGIN` | MARKUP: `MOJOSpend × (1 + margin/100)`; MARKDOWN: `VPSpend / (1 − margin/100)` (if margin < 100) |
| `INDEED` | `indeed_metric × match_pct × our_volume` (see step 6) |

The **binding constraint** that wins is recorded per cell as `binding_constraint`
(e.g. `BUDGET_CONSTRAINED`, `CPA_CONSTRAINED`), surfaced in the Detail and Rollup tabs.

### 5.3 Markup/markdown formulas & guards

- MARKUP: `markup_new = (CDSpend_NEW / MOJOSpend − 1) × 100`, clamped to `[−100, ∞)`.
- MARKDOWN: `markdown_new = (1 − VPSpend / CDSpend_NEW) × 100`, clamped to `[0, 100]`.

Guards set `curl_blocked` and add flags: `ZERO_MOJO`, `NOT_WRITEABLE`, `NO_CHANGE`,
`EXTREME_NEGATIVE_MARKUP` (< −500, needs explicit confirmation), and clamping.

### 5.4 Flag catalogue (non-exhaustive)

`BUDGET_CAPPED`, `METRIC_CAPPED`, `PACING_CAPPED`, `INDEED_CAPPED`,
`JOBGROUP_BUDGET_CAPPED`, `ZERO_MOJO`, `VPSPEND_ZERO`, `NO_CHANGE`,
`NEGATIVE_MARKUP`, `EXTREME_NEGATIVE_MARKUP`, `NOT_WRITEABLE`,
`ENTITY_SKIPPED_NO_DATA`, `EXCLUDED_BY_USER`, `INFEASIBLE_DISTRIBUTION`.

### 5.5 Engine / model index

| File | Role |
|------|------|
| `engines/writeable-dates.ts` | Editable date window. |
| `engines/curl-type-resolver.ts` | MARKUP vs MARKDOWN decision. |
| `engines/pacing.ts` | Per-date budget ceilings. |
| `engines/indeed-mapper.ts` | Indeed cross-client ceilings (by job-ref or name). |
| `engines/distribution.ts` | Allocate target spend across cells. |
| `engines/markup-calculator.ts` | CDSpend_NEW → markup/markdown + guards. |
| `engines/exclusions.ts` | Revert excluded cells. |
| `engines/constraint.ts` | Binding-constraint helpers. |
| `engines/preview-builder.ts` | `Cell[]` → `PreviewRow[]`. |
| `engines/execute-runner.ts` | Send curls to publisher APIs (execute only). |
| `models/dm-config.ts` | Zod schemas for config/execute requests. |
| `models/cell.ts` | `Cell`, `PreviewRow`, execution types. |
| `models/tracking.ts` | Snowflake query result types. |

---

## 6. API & state reference

### 6.1 API client — [`src/lib/api.ts`](../src/lib/api.ts)

All calls go through `request<T>()` (base `/api`, JSON, throws `{status, detail}` on
non-2xx).

| Function | Method & path | Sends | Returns |
|----------|---------------|-------|---------|
| `fetchPreview(config)` | `POST /api/dm/preview` | `DMConfig` | `PreviewRow[]` |
| `executeRun(req)` | `POST /api/dm/execute` | `ExecuteRequest` | `ExecutionSummary` |
| `fetchEntities(client_id, entity_level, [start, end])` | `POST /api/dm/entities` | `{client_id, entity_level, start_date?, end_date?}` | `EntityInfo[]` |
| `searchClients(q, limit=20)` | `GET /api/dm/clients?q&limit` | query (min 2 chars) | `ClientCatalogEntry[]` |
| `fetchPublishers(client_id, [start, end])` | `GET /api/dm/publishers?...` | query | `PublisherEntry[]` |
| `listSavedConfigs([clientId], [q])` | `GET /api/dm/saved-configs?...` | query | `SavedConfigListItem[]` |
| `getSavedConfig(id)` | `GET /api/dm/saved-configs/{id}` | — | `SavedConfig` |
| `createSavedConfig(body)` | `POST /api/dm/saved-configs` | label+config+client meta | `SavedConfig` |
| `updateSavedConfig(id, patch)` | `PATCH /api/dm/saved-configs/{id}` | `{label?, config?}` | `SavedConfig` |
| `deleteSavedConfig(id)` | `DELETE /api/dm/saved-configs/{id}` | — | `{deleted, id}` |
| `listExecutions([clientId])` | `GET /api/dm/executions?...` | query | `ExecutionHistoryListItem[]` |
| `getExecution(id)` | `GET /api/dm/executions/{id}` | — | `ExecutionHistoryItem` |
| `healthCheck()` | `GET /api/health` | — | `{status, version}` |

Route handlers live under [`src/app/api/dm/`](../src/app/api/dm/) (`preview`,
`execute`, `entities`, `clients`, `publishers`, `saved-configs`, `executions`).

### 6.2 Store — [`src/lib/store.ts`](../src/lib/store.ts)

A tiny external store via `useSyncExternalStore`. Fields: `config`, `preview`,
`execution`, `entities`, `clientMeta`, `comparisonMeta` (per-goal INDEED comparison
client), `savedConfigId`, `savedConfigLabel`, `loadSeq`.

Actions: `setConfig`, `setPreview`, `setExecution`, `setEntities`, `setClientMeta`,
`setComparisonMeta(idx, m)`, `clearComparisonMeta`, `setSavedConfigRef(id, label)`,
`loadConfigFromHistory(cfg, meta, id?, label?)` (atomic load that clears
preview/execution and **bumps `loadSeq`** so `/create` rehydrates; back-fills
`exclusions` for old configs), and `resetForNewRun()`.

`DEFAULT_CONFIG` ([16–26](../src/lib/store.ts#L16)): empty client, `start_date` =
first of this month, `end_date` = today, one `BUDGET/CLIENT` goal, non-strict pacing,
past edits allowed, empty exclusions.

### 6.3 Core types — [`src/lib/types.ts`](../src/lib/types.ts)

```ts
interface DMConfig {
  client_id: string;
  start_date: string;          // "YYYY-MM-DD"
  end_date: string;
  goals: GoalConfig[];
  pacing_config: PacingConfig;
  past_edit_config: PastEditConfig;
  exclusions: ExclusionConfig;
}

interface GoalConfig {
  goal_type: "BUDGET" | "CPA" | "CPC" | "CPAS" | "JOB_BUDGET" | "INDEED" | "FIXED_MARGIN";
  entity_level: "CLIENT" | "CAMPAIGN" | "JOBGROUP" | "JOB";
  entity_id: string;
  value?: number | null;
  per_entity_values?: Record<string, number> | null;
  budget_level?: "JAX" | "MAIN" | null;
  manual_budget_level?: "CLIENT" | "CAMPAIGN" | "JOBGROUP" | null;
  manual_budget_values?: Record<string, number> | null;
  match_pct?: number | null;
  match_pct_overrides?: Record<string, number> | null;
  indeed_metric?: "CPA" | "CPC" | null;
  comparison_entity_id?: string | null;
  indeed_publisher_name?: string | null;
}

interface PacingConfig   { strict: boolean; window?: "DAILY" | "WEEKLY" | "BIWEEKLY" | null; }
interface PastEditConfig { allow_past_edits: boolean; lookback_days?: number | null; }
interface ExclusionConfig {
  campaign_ids: string[]; jobgroup_ids: string[]; job_ids: string[]; publisher_ids: string[];
}

interface EntityInfo {
  entity_id: string; entity_name: string | null;
  budget: number | null; budget_cap_frequency: string | null;
  cpa: number | null; cpc: number | null;
}

interface PreviewRow {
  publisher_id: string; publisher_bid_type: string | null; event_publisher_date: string;
  entity_id: string; entity_name: string | null; entity_level: string;
  VPSpend: number; MOJOSpend: number; CDSpend_current: number; CDSpend_NEW: number | null;
  budget_ceiling: number | null; metric_ceiling: number | null; pacing_ceiling: number | null;
  indeed_ceiling: number | null; indeed_spend: number | null; indeed_volume: number | null;
  margin_ceiling: number | null; CDSpend_ceiling: number | null; ideal_spend: number | null;
  markup_current: number | null; markup_new: number | null;
  markdown_current: number | null; markdown_new: number | null;
  curl_type: "MARKUP" | "MARKDOWN" | null;
  is_writeable: boolean; curl_blocked: boolean; flags: string[];
  Clicks: number; Apply_start: number; Apply: number;
  binding_constraint: string | null;
  spend_delta: number | null; spend_delta_pct: number | null; markup_delta: number | null;
  goal_targets: Record<string, number> | null;
  job_group_id: string | null; job_group_name: string | null; job_id: string | null;
  campaign_id: string | null; campaign_name: string | null; job_group_budget: number | null;
}

interface ExecuteRequest extends DMConfig {
  confirm_extreme_markup: boolean;
  client_name?: string | null; agency_id?: string | null; agency_name?: string | null;
  client_status?: string | null; saved_config_id?: string | null;
}

interface ExecutionSummary {
  total_cells: number; cells_written: number; cells_failed: number; cells_skipped: number;
  results: ExecutionResult[];   // { cell_id, http_status, success, retry_count, error_message }
  run_timestamp: string;
}
```

---

## 7. Preview vs Execute

Both `POST /api/dm/preview` and `POST /api/dm/execute` run the **same**
`runPipeline(config)`. The differences:

| | Preview | Execute |
|---|---------|---------|
| Endpoint | `POST /api/dm/preview` | `POST /api/dm/execute` |
| Input | `DMConfig` | `ExecuteRequest` (DMConfig + `confirm_extreme_markup` + client meta + `saved_config_id`) |
| Side effects | None — pure computation | Sends curls to publisher APIs; writes audit + run history to Postgres |
| Extreme markup | Just flagged `EXTREME_NEGATIVE_MARKUP` | If any exist and `confirm_extreme_markup=false`, returns **400** with the offending cells; set `true` to proceed |
| Output | `PreviewRow[]` | `ExecutionSummary` (written/failed/skipped counts + per-cell results) |

`executeCurls` (`engines/execute-runner.ts`) only writes cells where
`!curl_blocked && is_writeable`, builds a markup or markdown payload, POSTs to the
publisher audit API (with bearer auth, retries on 5xx, 30s timeout, max 10
concurrent), logs every attempt, and persists the run to history.

---

## 8. Quick mental model

1. **Configure** assembles a `DMConfig` — a client, a date range, and up to 4 goals
   plus pacing/exclusions/past-edit rules.
2. **Preview** sends it to the server, which queries Snowflake, computes a ceiling
   per goal, takes the tightest one, redistributes spend across editable cells, turns
   the result into markup/markdown, and returns one row per cell.
3. The **Preview page** slices those rows four ways (entity, entity×publisher,
   cell detail, jobgroup/campaign rollup) with goal-driven columns.
4. **Execute** re-runs the same math and actually writes the markups to the publisher
   APIs, recording the outcome.
