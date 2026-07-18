"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import InfoTip from "../../../components/InfoTip";
import Tabs from "../../../components/Tabs";
import { useStore } from "../../../lib/store";
import type { PreviewRow, EntityInfo, GoalConfig } from "../../../lib/types";

/* ── Shared helpers ── */

// Always-visible helper line (and optional tooltip) shown under the tab bar,
// keyed by the active tab id.
const TAB_HELP: Record<string, { help: string; tip?: string }> = {
  entity: { help: "Headline impact by entity." },
  publisher: {
    help: "Spend change per entity and publisher.",
    tip: "Bar chart: light blue = old spend, dark blue = new spend. Sortable table below for the detail.",
  },
  detail: {
    help: "Spend change over time.",
    tip: "Line chart: dotted = old spend, solid = new spend. Defaults to all publishers; pick one to isolate it. Sortable table below.",
  },
  rollup: {
    help: "Adjustments summarised by job group or campaign.",
    tip: "Switch the rollup level to see totals at whichever level you report on.",
  },
};

type SortDir = "asc" | "desc";

function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function deltaColor(v: number): string {
  if (v > 0) return "text-success";
  if (v < 0) return "text-danger";
  return "";
}

const CHART_COLORS = {
  current: "#7681E8",
  new: "#303F9F",
  delta: "#43A047",
  grid: "#F0F1F3",
  muted: "#9CA3B0",
};

const PUB_COLORS = [
  "#303F9F", "#7681E8", "#43A047", "#F9A825", "#E53935",
  "#00897B", "#8E24AA", "#D84315", "#1565C0", "#6D4C41",
];

/* ── Goal-driven dynamic column helpers ── */

interface GoalColDef {
  label: string;
  key: string;
  isTarget?: boolean;
}

function entityLevelPrefix(level: string): string {
  switch (level) {
    case "JOB": return "Job";
    case "JOBGROUP": return "JG";
    case "CAMPAIGN": return "Campaign";
    default: return "Client";
  }
}

function goalColumnDefs(goals: GoalConfig[]): GoalColDef[] {
  const cols: GoalColDef[] = [];
  // Multiple goals can request the same computed column (e.g. CPA goal +
  // INDEED goal with metric=CPA both want Current CPA / New CPA). Track the
  // keys we've already emitted so React sees unique keys in the header row.
  const seen = new Set<string>();
  const push = (col: GoalColDef) => {
    if (seen.has(col.key)) return;
    seen.add(col.key);
    cols.push(col);
  };
  for (const g of goals) {
    const pfx = entityLevelPrefix(g.entity_level);
    switch (g.goal_type) {
      case "BUDGET":
        push({ label: `${pfx} Budget`, key: "budget_target", isTarget: true });
        break;
      case "JOB_BUDGET":
        push({ label: "Job Budget", key: "job_budget_target", isTarget: true });
        break;
      case "CPA":
        push({ label: `${pfx} CPA Target`, key: "cpa_target", isTarget: true });
        push({ label: "Current CPA", key: "current_cpa" });
        push({ label: "New CPA", key: "new_cpa" });
        break;
      case "CPC":
        push({ label: `${pfx} CPC Target`, key: "cpc_target", isTarget: true });
        push({ label: "Current CPC", key: "current_cpc" });
        push({ label: "New CPC", key: "new_cpc" });
        break;
      case "CPAS":
        push({ label: `${pfx} CPAS Target`, key: "cpas_target", isTarget: true });
        push({ label: "Current CPAS", key: "current_cpas" });
        push({ label: "New CPAS", key: "new_cpas" });
        break;
      case "FIXED_MARGIN":
        push({ label: "Fixed Margin%", key: "margin_target", isTarget: true });
        push({ label: "Current Margin%", key: "current_margin" });
        push({ label: "New Margin%", key: "new_margin" });
        break;
      case "INDEED": {
        // Indeed compares our per-unit metric (CPA or CPC) against the
        // comparison client's metric * match_pct.  Surface:
        //   - the raw Indeed spend / volume (applies or clicks) used to
        //     derive the comparison metric (for diagnostics)
        //   - the implied Indeed metric (spend / volume)
        //   - the target per-unit metric (metric * match_pct)
        //   - current vs new (same metric) so the user can verify compliance
        //   - the total Indeed ceiling (spend cap) that was applied
        const metric = g.indeed_metric ?? "CPA";
        const volLabel = metric === "CPA" ? "Indeed Applies" : "Indeed Clicks";
        push({ label: "Indeed Spend", key: "indeed_spend" });
        push({ label: volLabel, key: "indeed_volume" });
        push({ label: `Indeed ${metric}`, key: "indeed_metric_value" });
        push({ label: `Indeed ${metric} Target`, key: "indeed_target", isTarget: true });
        if (metric === "CPA") {
          push({ label: "Current CPA", key: "current_cpa" });
          push({ label: "New CPA", key: "new_cpa" });
        } else {
          push({ label: "Current CPC", key: "current_cpc" });
          push({ label: "New CPC", key: "new_cpc" });
        }
        push({ label: "Indeed Ceiling", key: "indeed_ceiling" });
        break;
      }
    }
  }
  return cols;
}

interface AggSpend {
  clicks: number;
  applyStart: number;
  apply: number;
  vpspend: number;
  mojoSpend: number;
  cdCurrent: number;
  cdNew: number;
  budgetCeiling?: number | null;
  indeedCeiling?: number | null;
  indeedSpend?: number | null;
  indeedVolume?: number | null;
  goalTargets?: Record<string, number> | null;
}

/** Look up a resolved goal target from the backend-computed goal_targets dict,
 *  falling back to the old per_entity_values → goal.value → dbFallback chain. */
function resolveTarget(
  goalTargets: Record<string, number> | null | undefined,
  goals: GoalConfig[],
  goalType: string,
  entityId: string | undefined,
  dbFallback: number | null | undefined,
): number | null {
  if (goalTargets && goalTargets[goalType] != null) return goalTargets[goalType];
  const g = goals.find((g) => g.goal_type === goalType);
  if (!g) return dbFallback ?? null;
  if (entityId && g.per_entity_values?.[entityId] != null) return g.per_entity_values[entityId];
  if (g.value != null) return g.value;
  return dbFallback ?? null;
}

function goalCellValue(
  key: string,
  agg: AggSpend,
  entity: EntityInfo | undefined,
  goals: GoalConfig[],
  curlType: string | null,
): number | null {
  const eid = entity?.entity_id;
  const gt = agg.goalTargets;
  switch (key) {
    case "budget_target":
      return resolveTarget(gt, goals, "BUDGET", eid, entity?.budget);
    case "job_budget_target":
      return resolveTarget(gt, goals, "JOB_BUDGET", eid, null);
    case "cpa_target":
      return resolveTarget(gt, goals, "CPA", eid, entity?.cpa);
    case "cpc_target":
      return resolveTarget(gt, goals, "CPC", eid, entity?.cpc);
    case "cpas_target":
      return resolveTarget(gt, goals, "CPAS", eid, null);
    case "current_cpa":
      return agg.apply > 0 ? agg.cdCurrent / agg.apply : null;
    case "new_cpa":
      return agg.apply > 0 ? agg.cdNew / agg.apply : null;
    case "current_cpc":
      return agg.clicks > 0 ? agg.cdCurrent / agg.clicks : null;
    case "new_cpc":
      return agg.clicks > 0 ? agg.cdNew / agg.clicks : null;
    case "current_cpas":
      return agg.applyStart > 0 ? agg.cdCurrent / agg.applyStart : null;
    case "new_cpas":
      return agg.applyStart > 0 ? agg.cdNew / agg.applyStart : null;
    case "current_margin":
      if (curlType === "MARKDOWN")
        return agg.cdCurrent > 0 ? (1 - agg.vpspend / agg.cdCurrent) * 100 : null;
      return agg.vpspend > 0 ? ((agg.cdCurrent / agg.vpspend) - 1) * 100 : null;
    case "new_margin":
      if (curlType === "MARKDOWN")
        return agg.cdNew > 0 ? (1 - agg.vpspend / agg.cdNew) * 100 : null;
      return agg.vpspend > 0 ? ((agg.cdNew / agg.vpspend) - 1) * 100 : null;
    case "margin_target":
      return resolveTarget(gt, goals, "FIXED_MARGIN", eid, null);
    case "indeed_target":
      return resolveTarget(gt, goals, "INDEED", eid, null);
    case "indeed_ceiling":
      return agg.indeedCeiling ?? null;
    case "indeed_spend":
      return agg.indeedSpend ?? null;
    case "indeed_volume":
      return agg.indeedVolume ?? null;
    case "indeed_metric_value": {
      const s = agg.indeedSpend;
      const v = agg.indeedVolume;
      if (s == null || v == null || v === 0) return null;
      return s / v;
    }
    default:
      return null;
  }
}

function goalCellValueForRow(
  key: string,
  row: PreviewRow,
  entity: EntityInfo | undefined,
  goals: GoalConfig[],
): number | null {
  const eid = row.entity_id ?? entity?.entity_id;
  const gt = row.goal_targets;
  switch (key) {
    case "budget_target":
      return resolveTarget(gt, goals, "BUDGET", eid, entity?.budget);
    case "job_budget_target":
      return resolveTarget(gt, goals, "JOB_BUDGET", eid, null);
    case "cpa_target":
      return resolveTarget(gt, goals, "CPA", eid, entity?.cpa);
    case "cpc_target":
      return resolveTarget(gt, goals, "CPC", eid, entity?.cpc);
    case "cpas_target":
      return resolveTarget(gt, goals, "CPAS", eid, null);
    case "current_cpa":
      return row.Apply > 0 ? row.CDSpend_current / row.Apply : null;
    case "new_cpa":
      return row.Apply > 0 ? (row.CDSpend_NEW ?? 0) / row.Apply : null;
    case "current_cpc":
      return row.Clicks > 0 ? row.CDSpend_current / row.Clicks : null;
    case "new_cpc":
      return row.Clicks > 0 ? (row.CDSpend_NEW ?? 0) / row.Clicks : null;
    case "current_cpas":
      return row.Apply_start > 0 ? row.CDSpend_current / row.Apply_start : null;
    case "new_cpas":
      return row.Apply_start > 0 ? (row.CDSpend_NEW ?? 0) / row.Apply_start : null;
    case "current_margin":
      if (row.curl_type === "MARKDOWN")
        return row.CDSpend_current > 0 ? (1 - (row.VPSpend ?? 0) / row.CDSpend_current) * 100 : null;
      return (row.VPSpend ?? 0) > 0 ? ((row.CDSpend_current / (row.VPSpend ?? 0)) - 1) * 100 : null;
    case "new_margin": {
      const cdNew = row.CDSpend_NEW ?? 0;
      const vpspend = row.VPSpend ?? 0;
      if (row.curl_type === "MARKDOWN") {
        return cdNew > 0 ? (1 - vpspend / cdNew) * 100 : null;
      }
      return vpspend > 0 ? ((cdNew / vpspend) - 1) * 100 : null;
    }
    case "margin_target":
      return resolveTarget(gt, goals, "FIXED_MARGIN", eid, null);
    case "indeed_target":
      return resolveTarget(gt, goals, "INDEED", eid, null);
    case "indeed_ceiling":
      return row.indeed_ceiling ?? null;
    case "indeed_spend":
      return row.indeed_spend ?? null;
    case "indeed_volume":
      return row.indeed_volume ?? null;
    case "indeed_metric_value": {
      const s = row.indeed_spend;
      const v = row.indeed_volume;
      if (s == null || v == null || v === 0) return null;
      return s / v;
    }
    default:
      return null;
  }
}

type SortKey = string;

function isExcluded(row: PreviewRow): boolean {
  return row.flags.includes("EXCLUDED_BY_USER");
}

export default function PreviewPage() {
  const { preview: previewRaw, config, entities } = useStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("entity");
  const [hideExcluded, setHideExcluded] = useState(false);

  const entityMap = useMemo(() => {
    const m = new Map<string, EntityInfo>();
    entities.forEach((e) => m.set(e.entity_id, e));
    return m;
  }, [entities]);

  const dynCols = useMemo(() => goalColumnDefs(config.goals), [config.goals]);

  const excludedCount = useMemo(
    () => previewRaw.filter(isExcluded).length,
    [previewRaw],
  );

  const preview = useMemo(
    () => (hideExcluded ? previewRaw.filter((r) => !isExcluded(r)) : previewRaw),
    [previewRaw, hideExcluded],
  );

  if (!previewRaw.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-text-muted">
        <p className="text-lg font-medium">No preview data</p>
        <p className="text-sm mt-1">Configure a run first, then generate a preview.</p>
        <Button className="mt-4" onClick={() => router.push("/create")}>Go to Config</Button>
      </div>
    );
  }

  const entityLevel = config.goals[0]?.entity_level ?? "ENTITY";
  const levelName = entityLevel === "JOB" ? "Job" : entityLevel === "JOBGROUP" ? "Job Group" : entityLevel === "CAMPAIGN" ? "Campaign" : "Client";
  const curlType = preview[0]?.curl_type ?? "MARKUP";

  const hasHierarchy = preview.some((r) => r.job_group_id || r.campaign_id);

  const tabDefs = [
    { id: "entity", label: `${levelName} Summary`, count: new Set(preview.map((r) => r.entity_id)).size },
    { id: "publisher", label: `${levelName} × Publisher`, count: new Set(preview.map((r) => `${r.entity_id}::${r.publisher_id}`)).size },
    { id: "detail", label: `${levelName} × Publisher × Date`, count: preview.length },
    ...(hasHierarchy
      ? [{ id: "rollup", label: "Job Group / Campaign Rollup",
          count: new Set(preview.map((r) => r.job_group_id).filter(Boolean)).size }]
      : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text">Preview</h2>
          <p className="text-sm text-text-muted mt-0.5">
            Client: <span className="font-medium text-text">{config.client_id.slice(0, 12)}...</span>
            {" "}&middot;{" "}
            {config.start_date} to {config.end_date}
            {" "}&middot;{" "}
            {preview.length} cells{hideExcluded && excludedCount > 0 ? ` (${excludedCount} hidden)` : ""}
          </p>
          <p className="text-sm text-text-muted mt-0.5">
            Four views of how, where, and how much margin will change. Nothing is written yet.
          </p>
        </div>
        <Button onClick={() => router.push("/execute")} icon={<ArrowRight className="w-4 h-4" />}>
          Proceed to Execute
        </Button>
      </div>

      {excludedCount > 0 && (
        <div className="flex items-center justify-between bg-warning-light border border-warning/30 rounded-md px-4 py-2 text-xs">
          <div className="text-text">
            <span className="font-medium text-warning">{excludedCount}</span>
            <span className="text-text-muted"> cell{excludedCount === 1 ? "" : "s"} flagged </span>
            <span className="font-medium">EXCLUDED_BY_USER</span>
            <span className="text-text-muted"> — their markup is untouched and no curl will be sent.</span>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideExcluded}
              onChange={(e) => setHideExcluded(e.target.checked)}
            />
            <span className="text-text">Hide excluded</span>
          </label>
        </div>
      )}

      <Tabs tabs={tabDefs} active={activeTab} onChange={setActiveTab} />

      {TAB_HELP[activeTab] && (
        <p className="flex items-center gap-1 text-xs text-text-muted -mt-2">
          {TAB_HELP[activeTab].help}
          {TAB_HELP[activeTab].tip && <InfoTip text={TAB_HELP[activeTab].tip!} />}
        </p>
      )}

      {activeTab === "entity" && (
        <EntityTab preview={preview} entityMap={entityMap} goals={config.goals} dynCols={dynCols} levelName={levelName} curlType={curlType} />
      )}
      {activeTab === "publisher" && (
        <PublisherTab preview={preview} entityMap={entityMap} goals={config.goals} dynCols={dynCols} levelName={levelName} curlType={curlType} />
      )}
      {activeTab === "detail" && (
        <DetailTab preview={preview} entityMap={entityMap} goals={config.goals} dynCols={dynCols} levelName={levelName} curlType={curlType} />
      )}
      {activeTab === "rollup" && hasHierarchy && (
        <RollupTab preview={preview} levelName={levelName} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   TAB 1 — Entity Summary
   ══════════════════════════════════════════════ */

interface TabProps {
  preview: PreviewRow[];
  entityMap: Map<string, EntityInfo>;
  goals: GoalConfig[];
  dynCols: GoalColDef[];
  levelName: string;
  curlType: string;
}

interface EntityRow extends AggSpend {
  entity_id: string;
  entity_name: string;
  adjustment: number;
  adjustment_pct: number | null;
  cell_count: number;
}

function EntityTab({ preview, entityMap, goals, dynCols, levelName, curlType }: TabProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "entity_name", dir: "asc" });

  const rows = useMemo(() => {
    const grouped = new Map<string, PreviewRow[]>();
    for (const row of preview) {
      if (!grouped.has(row.entity_id)) grouped.set(row.entity_id, []);
      grouped.get(row.entity_id)!.push(row);
    }

    const summaries: EntityRow[] = [];
    for (const [entityId, cells] of grouped) {
      const entity = entityMap.get(entityId);
      const backendName = cells[0]?.entity_name;
      let clicks = 0, applyStart = 0, apply = 0, vpspend = 0, mojoSpend = 0, cdCurrent = 0, cdNew = 0;
      let budgetCeiling: number | null = null;
      let indeedCeiling: number | null = null;
      let indeedSpend: number | null = null;
      let indeedVolume: number | null = null;
      let goalTargets: Record<string, number> | null = null;
      for (const c of cells) {
        clicks += c.Clicks ?? 0;
        applyStart += c.Apply_start ?? 0;
        apply += c.Apply ?? 0;
        vpspend += c.VPSpend ?? 0;
        mojoSpend += c.MOJOSpend ?? 0;
        cdCurrent += c.CDSpend_current ?? 0;
        cdNew += c.CDSpend_NEW ?? 0;
        if (budgetCeiling == null && c.budget_ceiling != null) budgetCeiling = c.budget_ceiling;
        if (indeedCeiling == null && c.indeed_ceiling != null) indeedCeiling = c.indeed_ceiling;
        if (indeedSpend == null && c.indeed_spend != null) indeedSpend = c.indeed_spend;
        if (indeedVolume == null && c.indeed_volume != null) indeedVolume = c.indeed_volume;
        if (goalTargets == null && c.goal_targets != null) goalTargets = c.goal_targets;
      }
      const adjustment = cdNew - cdCurrent;
      summaries.push({
        entity_id: entityId,
        entity_name: backendName ?? entity?.entity_name ?? entityId,
        clicks, applyStart, apply, vpspend, mojoSpend, cdCurrent, cdNew,
        budgetCeiling, indeedCeiling, indeedSpend, indeedVolume, goalTargets,
        adjustment, adjustment_pct: cdCurrent !== 0 ? (adjustment / cdCurrent) * 100 : null,
        cell_count: cells.length,
      });
    }

    summaries.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sort.key] ?? "";
      const bv = (b as unknown as Record<string, unknown>)[sort.key] ?? "";
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return summaries;
  }, [preview, entityMap, sort]);

  const totals = useMemo(() => {
    const t: AggSpend & { adjustment: number } = { clicks: 0, applyStart: 0, apply: 0, vpspend: 0, mojoSpend: 0, cdCurrent: 0, cdNew: 0, adjustment: 0 };
    for (const r of rows) {
      t.clicks += r.clicks; t.applyStart += r.applyStart; t.apply += r.apply;
      t.vpspend += r.vpspend; t.mojoSpend += r.mojoSpend;
      t.cdCurrent += r.cdCurrent; t.cdNew += r.cdNew;
    }
    t.adjustment = t.cdNew - t.cdCurrent;
    return t;
  }, [rows]);

  function toggleSort(key: SortKey) {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }

  const finalMarginPct = totals.vpspend > 0 ? ((totals.cdNew / totals.vpspend) - 1) * 100 : null;

  return (
    <>
      <div className="grid grid-cols-5 gap-4">
        <StatCard label={`${levelName}s`} value={rows.length.toString()} />
        <StatCard label="Total Clicks" value={totals.clicks.toLocaleString()} />
        <StatCard label="Total Applies" value={totals.apply.toLocaleString()} />
        <StatCard label="Total Adjustment" value={fmtNum(totals.adjustment)} color={totals.adjustment > 0 ? "text-success" : totals.adjustment < 0 ? "text-danger" : "text-text"} />
        <StatCard
          label="Final Margin %"
          value={finalMarginPct != null ? `${fmtNum(finalMarginPct)}%` : "—"}
          color={finalMarginPct == null ? "text-text-muted" : finalMarginPct >= 0 ? "text-success" : "text-danger"}
        />
      </div>

      <Card title={`${levelName} Summary`}>
        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-light bg-surface-alt text-text-muted text-xs">
                <ThSort label={levelName} sortKey="entity_name" sort={sort} onSort={toggleSort} />
                <ThSort label="Clicks" sortKey="clicks" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Apply Starts" sortKey="applyStart" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Applies" sortKey="apply" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Net Spend" sortKey="vpspend" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Mojo Spend" sortKey="mojoSpend" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Gross Spend" sortKey="cdCurrent" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="New Gross Spend" sortKey="cdNew" sort={sort} onSort={toggleSort} align="right" />
                {dynCols.map((c) => <Th key={c.key} align="right">{c.label}</Th>)}
                <ThSort label="Adjustment" sortKey="adjustment" sort={sort} onSort={toggleSort} align="right" />
                <Th align="right">Adj %</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const entity = entityMap.get(row.entity_id);
                return (
                  <tr key={row.entity_id} className="border-b border-border-light hover:bg-surface-alt/60">
                    <td className="px-4 py-2.5 font-medium font-mono text-xs whitespace-nowrap" title={row.entity_id}>{row.entity_name}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{row.clicks.toLocaleString()}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{row.applyStart.toLocaleString()}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{row.apply.toLocaleString()}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{fmtNum(row.vpspend)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{fmtNum(row.mojoSpend)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{fmtNum(row.cdCurrent)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right font-medium">{fmtNum(row.cdNew)}</td>
                    {dynCols.map((c) => {
                      const val = goalCellValue(c.key, row, entity, goals, curlType);
                      return (
                        <td key={c.key} className={`px-4 py-2.5 tabular-nums text-right ${c.isTarget ? "text-primary font-medium" : "font-medium text-secondary"}`}>
                          {val != null ? (c.key.includes("margin") ? `${fmtNum(val)}%` : fmtNum(val)) : <span className="text-text-muted">—</span>}
                        </td>
                      );
                    })}
                    <td className={`px-4 py-2.5 tabular-nums text-right font-semibold ${deltaColor(row.adjustment)}`}>
                      {row.adjustment >= 0 ? "+" : ""}{fmtNum(row.adjustment)}
                    </td>
                    <td className={`px-4 py-2.5 tabular-nums text-right ${deltaColor(row.adjustment)}`}>
                      {fmtPct(row.adjustment_pct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-alt font-semibold text-text">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 tabular-nums text-right">{totals.clicks.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right">{totals.applyStart.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right">{totals.apply.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right">{fmtNum(totals.vpspend)}</td>
                <td className="px-4 py-3 tabular-nums text-right">{fmtNum(totals.mojoSpend)}</td>
                <td className="px-4 py-3 tabular-nums text-right">{fmtNum(totals.cdCurrent)}</td>
                <td className="px-4 py-3 tabular-nums text-right">{fmtNum(totals.cdNew)}</td>
                {dynCols.map((c) => {
                  const val = goalCellValue(c.key, totals, undefined, goals, curlType);
                  return (
                    <td key={c.key} className="px-4 py-3 tabular-nums text-right">
                      {c.isTarget ? "" : val != null ? (c.key.includes("margin") ? `${fmtNum(val)}%` : fmtNum(val)) : "—"}
                    </td>
                  );
                })}
                <td className={`px-4 py-3 tabular-nums text-right ${deltaColor((totals as any).adjustment)}`}>
                  {(totals as any).adjustment >= 0 ? "+" : ""}{fmtNum((totals as any).adjustment)}
                </td>
                <td className={`px-4 py-3 tabular-nums text-right ${deltaColor((totals as any).adjustment)}`}>
                  {fmtPct(totals.cdCurrent !== 0 ? (((totals as any).adjustment) / totals.cdCurrent) * 100 : null)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}

/* ══════════════════════════════════════════════
   TAB 2 — Entity × Publisher
   ══════════════════════════════════════════════ */

interface PubRow extends AggSpend {
  key: string;
  publisher_id: string;
  entity_id: string;
  entity_name: string;
  adjustment: number;
  adjustment_pct: number | null;
  markup_new: number | null;
  markdown_new: number | null;
  curl_type: string | null;
  cell_count: number;
}

function PublisherTab({ preview, entityMap, goals, dynCols, levelName, curlType }: TabProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "cdNew", dir: "desc" });

  const rows = useMemo(() => {
    const grouped = new Map<string, PreviewRow[]>();
    for (const row of preview) {
      const key = `${row.entity_id}::${row.publisher_id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    const summaries: PubRow[] = [];
    for (const [key, cells] of grouped) {
      const first = cells[0];
      const entity = entityMap.get(first.entity_id);
      let clicks = 0, applyStart = 0, apply = 0, vpspend = 0, mojoSpend = 0, cdCurrent = 0, cdNew = 0;
      let budgetCeiling: number | null = null;
      let indeedCeiling: number | null = null;
      let indeedSpend: number | null = null;
      let indeedVolume: number | null = null;
      let goalTargets: Record<string, number> | null = null;
      for (const c of cells) {
        clicks += c.Clicks ?? 0;
        applyStart += c.Apply_start ?? 0;
        apply += c.Apply ?? 0;
        vpspend += c.VPSpend ?? 0;
        mojoSpend += c.MOJOSpend ?? 0;
        cdCurrent += c.CDSpend_current ?? 0;
        cdNew += c.CDSpend_NEW ?? 0;
        if (budgetCeiling == null && c.budget_ceiling != null) budgetCeiling = c.budget_ceiling;
        if (indeedCeiling == null && c.indeed_ceiling != null) indeedCeiling = c.indeed_ceiling;
        if (indeedSpend == null && c.indeed_spend != null) indeedSpend = c.indeed_spend;
        if (indeedVolume == null && c.indeed_volume != null) indeedVolume = c.indeed_volume;
        if (goalTargets == null && c.goal_targets != null) goalTargets = c.goal_targets;
      }
      const adjustment = cdNew - cdCurrent;

      const writeableCells = cells.filter((c) => c.is_writeable && c.markup_new != null);
      const avgMarkup = writeableCells.length > 0
        ? writeableCells.reduce((s, c) => s + (c.markup_new ?? 0), 0) / writeableCells.length : null;
      const avgMarkdown = writeableCells.length > 0
        ? writeableCells.reduce((s, c) => s + (c.markdown_new ?? 0), 0) / writeableCells.length : null;

      summaries.push({
        key, publisher_id: first.publisher_id, entity_id: first.entity_id,
        entity_name: first.entity_name ?? entity?.entity_name ?? first.entity_id,
        clicks, applyStart, apply, vpspend, mojoSpend, cdCurrent, cdNew,
        budgetCeiling, indeedCeiling, indeedSpend, indeedVolume, goalTargets,
        adjustment, adjustment_pct: cdCurrent !== 0 ? (adjustment / cdCurrent) * 100 : null,
        markup_new: avgMarkup, markdown_new: avgMarkdown,
        curl_type: first.curl_type, cell_count: cells.length,
      });
    }

    summaries.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sort.key] ?? "";
      const bv = (b as unknown as Record<string, unknown>)[sort.key] ?? "";
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return summaries;
  }, [preview, entityMap, sort]);

  const chartData = useMemo(() => {
    const byPub = new Map<string, { publisher_id: string; current: number; new_spend: number }>();
    for (const r of rows) {
      const existing = byPub.get(r.publisher_id);
      if (existing) { existing.current += r.cdCurrent; existing.new_spend += r.cdNew; }
      else byPub.set(r.publisher_id, { publisher_id: r.publisher_id, current: r.cdCurrent, new_spend: r.cdNew });
    }
    return [...byPub.values()].sort((a, b) => b.new_spend - a.new_spend).slice(0, 15);
  }, [rows]);

  const totals = useMemo(() => {
    const t: AggSpend & { adjustment: number } = { clicks: 0, applyStart: 0, apply: 0, vpspend: 0, mojoSpend: 0, cdCurrent: 0, cdNew: 0, adjustment: 0 };
    for (const r of rows) {
      t.clicks += r.clicks; t.applyStart += r.applyStart; t.apply += r.apply;
      t.vpspend += r.vpspend; t.mojoSpend += r.mojoSpend;
      t.cdCurrent += r.cdCurrent; t.cdNew += r.cdNew;
    }
    t.adjustment = t.cdNew - t.cdCurrent;
    return t;
  }, [rows]);

  function toggleSort(key: SortKey) {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  }

  const finalMarginPct = totals.vpspend > 0 ? ((totals.cdNew / totals.vpspend) - 1) * 100 : null;

  return (
    <>
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Publishers" value={new Set(rows.map((r) => r.publisher_id)).size.toString()} />
        <StatCard label={`${levelName} × Pub Combos`} value={rows.length.toString()} />
        <StatCard label="Total Current Spend" value={fmtNum(totals.cdCurrent)} />
        <StatCard label="Total Adjustment" value={fmtNum(totals.adjustment)} color={totals.adjustment > 0 ? "text-success" : totals.adjustment < 0 ? "text-danger" : "text-text"} />
        <StatCard
          label="Final Margin %"
          value={finalMarginPct != null ? `${fmtNum(finalMarginPct)}%` : "—"}
          color={finalMarginPct == null ? "text-text-muted" : finalMarginPct >= 0 ? "text-success" : "text-danger"}
        />
      </div>

      {chartData.length > 0 && (
        <Card title="Spend by Publisher — Current vs New">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="publisher_id" tick={{ fontSize: 11, fill: CHART_COLORS.muted }} tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + "…" : v} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.muted }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value, name) => [`$${fmtNum(Number(value))}`, String(name) === "current" ? "Current Spend" : "New Spend"]} contentStyle={{ borderRadius: 6, border: "1px solid #E2E5EA", fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="current" name="Current CD Spend" fill={CHART_COLORS.current} radius={[3, 3, 0, 0]} />
              <Bar dataKey="new_spend" name="New CD Spend" fill={CHART_COLORS.new} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card title={`${levelName} × Publisher Breakdown`}>
        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-light bg-surface-alt text-text-muted text-xs">
                <ThSort label={levelName} sortKey="entity_name" sort={sort} onSort={toggleSort} />
                <ThSort label="Publisher" sortKey="publisher_id" sort={sort} onSort={toggleSort} />
                <ThSort label="Clicks" sortKey="clicks" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Apply Starts" sortKey="applyStart" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Applies" sortKey="apply" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Net Spend" sortKey="vpspend" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Mojo Spend" sortKey="mojoSpend" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Gross Spend" sortKey="cdCurrent" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="New Gross Spend" sortKey="cdNew" sort={sort} onSort={toggleSort} align="right" />
                {dynCols.map((c) => <Th key={c.key} align="right">{c.label}</Th>)}
                <ThSort label="Adjustment" sortKey="adjustment" sort={sort} onSort={toggleSort} align="right" />
                <Th align="right">Adj %</Th>
                <Th align="right">Dates</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const entity = entityMap.get(row.entity_id);
                return (
                  <tr key={row.key} className="border-b border-border-light hover:bg-surface-alt/60">
                    <td className="px-4 py-2.5 font-medium font-mono text-xs whitespace-nowrap" title={row.entity_id}>{row.entity_name}</td>
                    <td className="px-4 py-2.5 max-w-[140px] truncate" title={row.publisher_id}>{row.publisher_id}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{row.clicks.toLocaleString()}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{row.applyStart.toLocaleString()}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{row.apply.toLocaleString()}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{fmtNum(row.vpspend)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{fmtNum(row.mojoSpend)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{fmtNum(row.cdCurrent)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right font-medium">{fmtNum(row.cdNew)}</td>
                    {dynCols.map((c) => {
                      const val = goalCellValue(c.key, row, entity, goals, curlType);
                      return (
                        <td key={c.key} className={`px-4 py-2.5 tabular-nums text-right ${c.isTarget ? "text-primary font-medium" : "font-medium text-secondary"}`}>
                          {val != null ? (c.key.includes("margin") ? `${fmtNum(val)}%` : fmtNum(val)) : <span className="text-text-muted">—</span>}
                        </td>
                      );
                    })}
                    <td className={`px-4 py-2.5 tabular-nums text-right font-semibold ${deltaColor(row.adjustment)}`}>
                      {row.adjustment >= 0 ? "+" : ""}{fmtNum(row.adjustment)}
                    </td>
                    <td className={`px-4 py-2.5 tabular-nums text-right ${deltaColor(row.adjustment)}`}>
                      {fmtPct(row.adjustment_pct)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-right text-text-muted">{row.cell_count}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-alt font-semibold text-text">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3">{new Set(rows.map((r) => r.publisher_id)).size} publishers</td>
                <td className="px-4 py-3 tabular-nums text-right">{totals.clicks.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right">{totals.applyStart.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right">{totals.apply.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right">{fmtNum(totals.vpspend)}</td>
                <td className="px-4 py-3 tabular-nums text-right">{fmtNum(totals.mojoSpend)}</td>
                <td className="px-4 py-3 tabular-nums text-right">{fmtNum(totals.cdCurrent)}</td>
                <td className="px-4 py-3 tabular-nums text-right">{fmtNum(totals.cdNew)}</td>
                {dynCols.map((c) => {
                  const val = goalCellValue(c.key, totals, undefined, goals, curlType);
                  return (
                    <td key={c.key} className="px-4 py-3 tabular-nums text-right">
                      {c.isTarget ? "" : val != null ? (c.key.includes("margin") ? `${fmtNum(val)}%` : fmtNum(val)) : "—"}
                    </td>
                  );
                })}
                <td className={`px-4 py-3 tabular-nums text-right ${deltaColor(totals.adjustment)}`}>
                  {totals.adjustment >= 0 ? "+" : ""}{fmtNum(totals.adjustment)}
                </td>
                <td className={`px-4 py-3 tabular-nums text-right ${deltaColor(totals.adjustment)}`}>
                  {fmtPct(totals.cdCurrent !== 0 ? (totals.adjustment / totals.cdCurrent) * 100 : null)}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}

/* ══════════════════════════════════════════════
   TAB 3 — Entity × Publisher × Date (cell detail)
   ══════════════════════════════════════════════ */

function DetailTab({ preview, entityMap, goals, dynCols, levelName, curlType }: TabProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "event_publisher_date", dir: "asc" });
  const [filterPub, setFilterPub] = useState<string>("__all__");

  const publishers = useMemo(() => [...new Set(preview.map((r) => r.publisher_id))].sort(), [preview]);

  const filtered = useMemo(() => {
    let data = [...preview];
    if (filterPub !== "__all__") data = data.filter((r) => r.publisher_id === filterPub);

    const computedVal = (r: PreviewRow, key: SortKey): string | number => {
      if (key === "adjustment") return (r.CDSpend_NEW ?? 0) - r.CDSpend_current;
      return (r[key as keyof PreviewRow] as string | number) ?? "";
    };

    data.sort((a, b) => {
      const av = computedVal(a, sort.key);
      const bv = computedVal(b, sort.key);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [preview, filterPub, sort]);

  const timeSeriesChart = useMemo(() => {
    const source = filterPub !== "__all__" ? filtered : preview;
    const dates = [...new Set(source.map((r) => r.event_publisher_date))].sort();
    const pubSet = [...new Set(source.map((r) => r.publisher_id))];
    const topPubs = pubSet.slice(0, 8);
    return dates.map((d) => {
      const point: Record<string, string | number> = { date: d };
      for (const pub of topPubs) {
        const cells = source.filter((r) => r.event_publisher_date === d && r.publisher_id === pub);
        point[`${pub}_current`] = cells.reduce((s, c) => s + (c.CDSpend_current ?? 0), 0);
        point[`${pub}_new`] = cells.reduce((s, c) => s + (c.CDSpend_NEW ?? 0), 0);
      }
      return point;
    });
  }, [preview, filtered, filterPub]);

  const chartPublishers = useMemo(() => {
    const source = filterPub !== "__all__" ? filtered : preview;
    return [...new Set(source.map((r) => r.publisher_id))].slice(0, 8);
  }, [preview, filtered, filterPub]);

  const totals = useMemo(() => {
    const t: AggSpend & { adjustment: number } = { clicks: 0, applyStart: 0, apply: 0, vpspend: 0, mojoSpend: 0, cdCurrent: 0, cdNew: 0, adjustment: 0 };
    for (const r of filtered) {
      t.clicks += r.Clicks ?? 0; t.applyStart += r.Apply_start ?? 0; t.apply += r.Apply ?? 0;
      t.vpspend += r.VPSpend ?? 0; t.mojoSpend += r.MOJOSpend ?? 0;
      t.cdCurrent += r.CDSpend_current ?? 0; t.cdNew += r.CDSpend_NEW ?? 0;
    }
    t.adjustment = t.cdNew - t.cdCurrent;
    return t;
  }, [filtered]);

  function toggleSort(key: SortKey) {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }

  const finalMarginPct = totals.vpspend > 0 ? ((totals.cdNew / totals.vpspend) - 1) * 100 : null;

  return (
    <>
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Total Cells" value={filtered.length.toString()} />
        <StatCard label="Total Clicks" value={totals.clicks.toLocaleString()} />
        <StatCard label="Current Spend" value={fmtNum(totals.cdCurrent)} />
        <StatCard label="Total Adjustment" value={fmtNum(totals.adjustment)} color={totals.adjustment > 0 ? "text-success" : totals.adjustment < 0 ? "text-danger" : "text-text"} />
        <StatCard
          label="Final Margin %"
          value={finalMarginPct != null ? `${fmtNum(finalMarginPct)}%` : "—"}
          color={finalMarginPct == null ? "text-text-muted" : finalMarginPct >= 0 ? "text-success" : "text-danger"}
        />
      </div>

      <Card
        title="Spend Over Time by Publisher"
        action={
          <select className="text-sm border border-border rounded-md px-2.5 py-1.5 bg-surface text-text focus:outline-none focus:ring-1 focus:ring-primary" value={filterPub} onChange={(e) => setFilterPub(e.target.value)}>
            <option value="__all__">All Publishers</option>
            {publishers.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        }
      >
        {timeSeriesChart.length > 0 && (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={timeSeriesChart} margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART_COLORS.muted }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.muted }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ borderRadius: 6, border: "1px solid #E2E5EA", fontSize: 12 }} formatter={(value, name) => {
                const n = String(name);
                const label = n.endsWith("_new") ? "New" : "Current";
                const pub = n.replace(/_current$|_new$/, "");
                return [`$${fmtNum(Number(value))}`, `${pub} (${label})`];
              }} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => {
                const v = String(value);
                const label = v.endsWith("_new") ? " New" : " Current";
                const pub = v.replace(/_current$|_new$/, "");
                return `${pub.length > 10 ? pub.slice(0, 10) + "…" : pub}${label}`;
              }} />
              {chartPublishers.map((pub, i) => (
                <Line key={`${pub}_current`} type="monotone" dataKey={`${pub}_current`} stroke={PUB_COLORS[i % PUB_COLORS.length]} strokeDasharray="5 3" strokeWidth={1.5} dot={false} />
              ))}
              {chartPublishers.map((pub, i) => (
                <Line key={`${pub}_new`} type="monotone" dataKey={`${pub}_new`} stroke={PUB_COLORS[i % PUB_COLORS.length]} strokeWidth={2} dot={{ r: 2 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title={`${levelName} × Publisher × Date Detail`}>
        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-light bg-surface-alt text-text-muted text-xs">
                <ThSort label="Date" sortKey="event_publisher_date" sort={sort} onSort={toggleSort} />
                <ThSort label={levelName} sortKey="entity_name" sort={sort} onSort={toggleSort} />
                <ThSort label="Publisher" sortKey="publisher_id" sort={sort} onSort={toggleSort} />
                <Th align="right">Clicks</Th>
                <Th align="right">Apply Starts</Th>
                <Th align="right">Applies</Th>
                <ThSort label="Net Spend" sortKey="VPSpend" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Mojo Spend" sortKey="MOJOSpend" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Gross Spend" sortKey="CDSpend_current" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="New Gross Spend" sortKey="CDSpend_NEW" sort={sort} onSort={toggleSort} align="right" />
                {dynCols.map((c) => <Th key={c.key} align="right">{c.label}</Th>)}
                <ThSort label="Adjustment" sortKey="adjustment" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Markup/down" sortKey="markup_new" sort={sort} onSort={toggleSort} align="right" />
                <Th align="center">Writeable</Th>
                <Th align="center">
                  <span className="inline-flex items-center gap-1">
                    Blocked
                    <InfoTip text="A blocked row is skipped and won't run through DM. The Flags column shows why (e.g. negative markup, zero spend). Review before executing." />
                  </span>
                </Th>
                <Th align="left">Flags</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const markupVal = row.curl_type === "MARKDOWN" ? row.markdown_new : row.markup_new;
                const adj = (row.CDSpend_NEW ?? 0) - row.CDSpend_current;
                const entity = entityMap.get(row.entity_id);
                return (
                  <tr key={`${row.entity_id}-${row.publisher_id}-${row.event_publisher_date}-${i}`} className="border-b border-border-light hover:bg-surface-alt/60">
                    <td className="px-4 py-2.5 tabular-nums">{row.event_publisher_date}</td>
                    <td className="px-4 py-2.5 font-medium font-mono text-xs whitespace-nowrap" title={row.entity_name ?? row.entity_id}>
                      {row.entity_name ?? row.entity_id}
                    </td>
                    <td className="px-4 py-2.5 max-w-[120px] truncate" title={row.publisher_id}>{row.publisher_id}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{row.Clicks}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{row.Apply_start}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{row.Apply}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{fmtNum(row.VPSpend)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{fmtNum(row.MOJOSpend)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{fmtNum(row.CDSpend_current)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right font-medium">{fmtNum(row.CDSpend_NEW)}</td>
                    {dynCols.map((c) => {
                      const val = goalCellValueForRow(c.key, row, entity, goals);
                      return (
                        <td key={c.key} className={`px-4 py-2.5 tabular-nums text-right ${c.isTarget ? "text-primary font-medium" : "font-medium text-secondary"}`}>
                          {val != null ? (c.key.includes("margin") ? `${fmtNum(val)}%` : fmtNum(val)) : <span className="text-text-muted">—</span>}
                        </td>
                      );
                    })}
                    <td className={`px-4 py-2.5 tabular-nums text-right font-semibold ${deltaColor(adj)}`}>
                      {adj >= 0 ? "+" : ""}{fmtNum(adj)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-right font-medium text-secondary">
                      {markupVal != null ? `${fmtNum(markupVal)}%` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {row.is_writeable ? <span className="text-success text-xs font-medium">Yes</span> : <span className="text-text-muted text-xs">No</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {row.flags.includes("EXCLUDED_BY_USER") ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-warning-light text-warning text-[11px] font-medium" title="User excluded - no curl issued">Excluded</span>
                      ) : row.curl_blocked ? (
                        <span className="text-danger text-xs font-medium">Blocked</span>
                      ) : (
                        <span className="text-success text-xs">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-muted max-w-[200px] truncate" title={row.flags.join(", ")}>
                      {row.flags.length > 0 ? row.flags.join(", ") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-alt font-semibold text-text">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3 tabular-nums text-right">{totals.clicks.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right">{totals.applyStart.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right">{totals.apply.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right">{fmtNum(totals.vpspend)}</td>
                <td className="px-4 py-3 tabular-nums text-right">{fmtNum(totals.mojoSpend)}</td>
                <td className="px-4 py-3 tabular-nums text-right">{fmtNum(totals.cdCurrent)}</td>
                <td className="px-4 py-3 tabular-nums text-right">{fmtNum(totals.cdNew)}</td>
                {dynCols.map((c) => {
                  const val = goalCellValue(c.key, totals, undefined, goals, curlType);
                  return (
                    <td key={c.key} className="px-4 py-3 tabular-nums text-right">
                      {c.isTarget ? "" : val != null ? (c.key.includes("margin") ? `${fmtNum(val)}%` : fmtNum(val)) : "—"}
                    </td>
                  );
                })}
                <td className={`px-4 py-3 tabular-nums text-right ${deltaColor(totals.adjustment)}`}>
                  {totals.adjustment >= 0 ? "+" : ""}{fmtNum(totals.adjustment)}
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-center text-xs">{filtered.filter((r) => r.is_writeable).length} / {filtered.length}</td>
                <td className="px-4 py-3 text-center text-xs">{filtered.filter((r) => r.curl_blocked).length} blocked</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}

/* ══════════════════════════════════════════════
   TAB 4 — Rollup (Job Group / Campaign)
   ══════════════════════════════════════════════ */

type RollupLevel = "JOB_GROUP" | "CAMPAIGN";

interface RollupRow {
  id: string;
  name: string;
  clicks: number;
  applyStart: number;
  apply: number;
  vpspend: number;
  mojoSpend: number;
  cdCurrent: number;
  cdNew: number;
  budgetCap: number | null;
  jobIds: Set<string>;
  jobGroupIds: Set<string>;
  jobsCappedByJgBudget: Set<string>;
  bindingCounts: Record<string, number>;
}

interface RollupTabProps {
  preview: PreviewRow[];
  levelName: string;
}

function RollupTab({ preview }: RollupTabProps) {
  const [level, setLevel] = useState<RollupLevel>("JOB_GROUP");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "cdNew", dir: "desc" });

  const rows: RollupRow[] = useMemo(() => {
    const byKey = new Map<string, RollupRow>();
    for (const r of preview) {
      const id = level === "JOB_GROUP" ? r.job_group_id : r.campaign_id;
      const name = level === "JOB_GROUP"
        ? (r.job_group_name ?? r.job_group_id ?? "—")
        : (r.campaign_name ?? r.campaign_id ?? "—");
      if (!id) continue;

      let agg = byKey.get(id);
      if (!agg) {
        agg = {
          id,
          name,
          clicks: 0, applyStart: 0, apply: 0,
          vpspend: 0, mojoSpend: 0, cdCurrent: 0, cdNew: 0,
          budgetCap: null,
          jobIds: new Set(),
          jobGroupIds: new Set(),
          jobsCappedByJgBudget: new Set(),
          bindingCounts: {},
        };
        byKey.set(id, agg);
      }
      agg.clicks += r.Clicks ?? 0;
      agg.applyStart += r.Apply_start ?? 0;
      agg.apply += r.Apply ?? 0;
      agg.vpspend += r.VPSpend ?? 0;
      agg.mojoSpend += r.MOJOSpend ?? 0;
      agg.cdCurrent += r.CDSpend_current ?? 0;
      agg.cdNew += r.CDSpend_NEW ?? 0;
      if (r.entity_level === "JOB") agg.jobIds.add(r.entity_id);
      if (r.job_group_id) agg.jobGroupIds.add(r.job_group_id);

      if (level === "JOB_GROUP") {
        if (agg.budgetCap == null && r.job_group_budget != null) {
          agg.budgetCap = r.job_group_budget;
        }
      }

      if (r.flags?.includes("JOBGROUP_BUDGET_CAPPED") && r.entity_id) {
        agg.jobsCappedByJgBudget.add(r.entity_id);
      }
      const bind = r.binding_constraint;
      if (bind) agg.bindingCounts[bind] = (agg.bindingCounts[bind] ?? 0) + 1;
    }

    if (level === "CAMPAIGN") {
      const campaignBudgets = new Map<string, Map<string, number>>();
      for (const r of preview) {
        if (!r.campaign_id || !r.job_group_id || r.job_group_budget == null) continue;
        if (!campaignBudgets.has(r.campaign_id)) campaignBudgets.set(r.campaign_id, new Map());
        campaignBudgets.get(r.campaign_id)!.set(r.job_group_id, r.job_group_budget);
      }
      for (const [cid, jgs] of campaignBudgets) {
        const row = byKey.get(cid);
        if (!row) continue;
        let sum = 0;
        for (const v of jgs.values()) sum += v;
        row.budgetCap = sum;
      }
    }

    const result = Array.from(byKey.values());
    result.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sort.key];
      const bv = (b as unknown as Record<string, unknown>)[sort.key];
      const an = typeof av === "number" ? av : 0;
      const bn = typeof bv === "number" ? bv : 0;
      if (typeof av === "string" && typeof bv === "string") {
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sort.dir === "asc" ? cmp : -cmp;
      }
      const cmp = an - bn;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [preview, level, sort]);

  const totals = useMemo(() => {
    const t = {
      clicks: 0, applyStart: 0, apply: 0,
      vpspend: 0, mojoSpend: 0, cdCurrent: 0, cdNew: 0,
      budgetCap: 0,
      anyBudget: false,
      jobsCappedByJgBudget: 0,
      jobsTotal: 0,
      overBudgetGroups: 0,
    };
    for (const r of rows) {
      t.clicks += r.clicks;
      t.applyStart += r.applyStart;
      t.apply += r.apply;
      t.vpspend += r.vpspend;
      t.mojoSpend += r.mojoSpend;
      t.cdCurrent += r.cdCurrent;
      t.cdNew += r.cdNew;
      if (r.budgetCap != null) {
        t.budgetCap += r.budgetCap;
        t.anyBudget = true;
        if (r.cdNew > r.budgetCap + 1e-6) t.overBudgetGroups += 1;
      }
      t.jobsCappedByJgBudget += r.jobsCappedByJgBudget.size;
      t.jobsTotal += r.jobIds.size;
    }
    return t;
  }, [rows]);

  function toggleSort(key: SortKey) {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  }

  const topBindings = useMemo(() => {
    const agg: Record<string, number> = {};
    for (const r of rows) {
      for (const [k, v] of Object.entries(r.bindingCounts)) {
        agg[k] = (agg[k] ?? 0) + v;
      }
    }
    return Object.entries(agg)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [rows]);

  const levelLabel = level === "JOB_GROUP" ? "Job Group" : "Campaign";
  const rowIdLabel = level === "JOB_GROUP" ? "Job Group" : "Campaign";
  const finalMarginPct = totals.vpspend > 0 ? ((totals.cdNew / totals.vpspend) - 1) * 100 : null;

  return (
    <>
      <div className="grid grid-cols-5 gap-4">
        <StatCard label={`${levelLabel}s`} value={rows.length.toString()} />
        <StatCard
          label="Total New CD Spend"
          value={fmtNum(totals.cdNew)}
          color={totals.anyBudget && totals.cdNew > totals.budgetCap ? "text-danger" : "text-text"}
        />
        <StatCard
          label={totals.anyBudget ? "Summed Budget Cap" : "Total Current CD Spend"}
          value={fmtNum(totals.anyBudget ? totals.budgetCap : totals.cdCurrent)}
        />
        <StatCard
          label="Jobs capped by JG Budget"
          value={`${totals.jobsCappedByJgBudget.toLocaleString()} / ${totals.jobsTotal.toLocaleString()}`}
          color={totals.jobsCappedByJgBudget > 0 ? "text-danger" : "text-text"}
        />
        <StatCard
          label="Final Margin %"
          value={finalMarginPct != null ? `${fmtNum(finalMarginPct)}%` : "—"}
          color={finalMarginPct == null ? "text-text-muted" : finalMarginPct >= 0 ? "text-success" : "text-danger"}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-text-muted font-medium">Rollup level</span>
        <div className="inline-flex rounded-md border border-border-light bg-surface-alt p-1">
          {(["JOB_GROUP", "CAMPAIGN"] as RollupLevel[]).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                level === l ? "bg-surface text-primary shadow-sm" : "text-text-muted hover:text-text"
              }`}
            >
              {l === "JOB_GROUP" ? "Job Group" : "Campaign"}
            </button>
          ))}
        </div>
        {totals.overBudgetGroups > 0 && (
          <span className="text-xs text-danger font-medium ml-auto">
            {totals.overBudgetGroups} {levelLabel}(s) over budget
          </span>
        )}
        {topBindings.length > 0 && (
          <span className="text-xs text-text-muted">
            Top binding:{" "}
            {topBindings.map(([k, v], i) => (
              <span key={k}>
                {i > 0 ? ", " : ""}
                <span className="font-medium text-text">{k}</span>
                <span className="text-text-light"> ({v})</span>
              </span>
            ))}
          </span>
        )}
      </div>

      <Card title={`${levelLabel} Rollup`}>
        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-light bg-surface-alt text-text-muted text-xs">
                <ThSort label={rowIdLabel} sortKey="name" sort={sort} onSort={toggleSort} />
                <Th align="right">Jobs</Th>
                {level === "CAMPAIGN" && <Th align="right">Job Groups</Th>}
                <ThSort label="Clicks" sortKey="clicks" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Apply Starts" sortKey="applyStart" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Applies" sortKey="apply" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Net Spend" sortKey="vpspend" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Mojo Spend" sortKey="mojoSpend" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="Gross Spend" sortKey="cdCurrent" sort={sort} onSort={toggleSort} align="right" />
                <ThSort label="New Gross Spend" sortKey="cdNew" sort={sort} onSort={toggleSort} align="right" />
                <Th align="right">Current CPA</Th>
                <Th align="right">New CPA</Th>
                {totals.anyBudget && (
                  <>
                    <ThSort label="Budget Cap" sortKey="budgetCap" sort={sort} onSort={toggleSort} align="right" />
                    <Th align="right">Utilization</Th>
                  </>
                )}
                <Th align="right">Adjustment</Th>
                <Th align="right">Adj %</Th>
                <Th align="right">Top Binding</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const adjustment = r.cdNew - r.cdCurrent;
                const adjPct = r.cdCurrent !== 0 ? (adjustment / r.cdCurrent) * 100 : null;
                const currentCpa = r.apply > 0 ? r.cdCurrent / r.apply : null;
                const newCpa = r.apply > 0 ? r.cdNew / r.apply : null;
                const utilization = r.budgetCap != null && r.budgetCap > 0 ? (r.cdNew / r.budgetCap) * 100 : null;
                const overBudget = r.budgetCap != null && r.cdNew > r.budgetCap + 1e-6;
                const topBinding = Object.entries(r.bindingCounts).sort((a, b) => b[1] - a[1])[0];
                return (
                  <tr key={r.id} className={`border-b border-border-light hover:bg-surface-alt/60 ${overBudget ? "bg-danger-light/40" : ""}`}>
                    <td className="px-4 py-2.5 font-medium font-mono text-xs whitespace-nowrap" title={r.id}>{r.name}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">
                      {r.jobIds.size.toLocaleString()}
                      {r.jobsCappedByJgBudget.size > 0 && (
                        <span className="ml-1 text-xs text-danger" title="Jobs capped by jobgroup aggregate budget">
                          ({r.jobsCappedByJgBudget.size} capped)
                        </span>
                      )}
                    </td>
                    {level === "CAMPAIGN" && (
                      <td className="px-4 py-2.5 tabular-nums text-right">{r.jobGroupIds.size.toLocaleString()}</td>
                    )}
                    <td className="px-4 py-2.5 tabular-nums text-right">{r.clicks.toLocaleString()}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{r.applyStart.toLocaleString()}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{r.apply.toLocaleString()}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{fmtNum(r.vpspend)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{fmtNum(r.mojoSpend)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{fmtNum(r.cdCurrent)}</td>
                    <td className={`px-4 py-2.5 tabular-nums text-right font-medium ${overBudget ? "text-danger" : ""}`}>{fmtNum(r.cdNew)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{currentCpa != null ? fmtNum(currentCpa) : <span className="text-text-muted">—</span>}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right">{newCpa != null ? fmtNum(newCpa) : <span className="text-text-muted">—</span>}</td>
                    {totals.anyBudget && (
                      <>
                        <td className="px-4 py-2.5 tabular-nums text-right text-primary font-medium">
                          {r.budgetCap != null ? fmtNum(r.budgetCap) : <span className="text-text-muted">—</span>}
                        </td>
                        <td className={`px-4 py-2.5 tabular-nums text-right ${overBudget ? "text-danger font-semibold" : utilization != null && utilization > 90 ? "text-warning" : ""}`}>
                          {utilization != null ? `${fmtNum(utilization)}%` : <span className="text-text-muted">—</span>}
                        </td>
                      </>
                    )}
                    <td className={`px-4 py-2.5 tabular-nums text-right font-semibold ${deltaColor(adjustment)}`}>
                      {adjustment >= 0 ? "+" : ""}{fmtNum(adjustment)}
                    </td>
                    <td className={`px-4 py-2.5 tabular-nums text-right ${deltaColor(adjustment)}`}>
                      {fmtPct(adjPct)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {topBinding ? (
                        <span className="font-medium text-text">{topBinding[0]}</span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-alt font-semibold text-text">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 tabular-nums text-right">{totals.jobsTotal.toLocaleString()}</td>
                {level === "CAMPAIGN" && <td className="px-4 py-3 tabular-nums text-right">—</td>}
                <td className="px-4 py-3 tabular-nums text-right">{totals.clicks.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right">{totals.applyStart.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right">{totals.apply.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right">{fmtNum(totals.vpspend)}</td>
                <td className="px-4 py-3 tabular-nums text-right">{fmtNum(totals.mojoSpend)}</td>
                <td className="px-4 py-3 tabular-nums text-right">{fmtNum(totals.cdCurrent)}</td>
                <td className={`px-4 py-3 tabular-nums text-right ${totals.anyBudget && totals.cdNew > totals.budgetCap ? "text-danger" : ""}`}>
                  {fmtNum(totals.cdNew)}
                </td>
                <td className="px-4 py-3 tabular-nums text-right">
                  {totals.apply > 0 ? fmtNum(totals.cdCurrent / totals.apply) : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-right">
                  {totals.apply > 0 ? fmtNum(totals.cdNew / totals.apply) : "—"}
                </td>
                {totals.anyBudget && (
                  <>
                    <td className="px-4 py-3 tabular-nums text-right text-primary">{fmtNum(totals.budgetCap)}</td>
                    <td className={`px-4 py-3 tabular-nums text-right ${totals.cdNew > totals.budgetCap ? "text-danger" : ""}`}>
                      {totals.budgetCap > 0 ? `${fmtNum((totals.cdNew / totals.budgetCap) * 100)}%` : "—"}
                    </td>
                  </>
                )}
                <td className={`px-4 py-3 tabular-nums text-right ${deltaColor(totals.cdNew - totals.cdCurrent)}`}>
                  {totals.cdNew - totals.cdCurrent >= 0 ? "+" : ""}{fmtNum(totals.cdNew - totals.cdCurrent)}
                </td>
                <td className={`px-4 py-3 tabular-nums text-right ${deltaColor(totals.cdNew - totals.cdCurrent)}`}>
                  {fmtPct(totals.cdCurrent !== 0 ? ((totals.cdNew - totals.cdCurrent) / totals.cdCurrent) * 100 : null)}
                </td>
                <td className="px-4 py-3 text-right">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}

function StatCard({ label, value, color = "text-text" }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface rounded-md border border-border-light p-4">
      <div className="text-xs text-text-muted font-medium">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th className={`px-4 py-2.5 font-medium whitespace-nowrap ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}>
      {children}
    </th>
  );
}

function ThSort({ label, sortKey, sort, onSort, align = "left" }: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (k: SortKey) => void;
  align?: "left" | "right" | "center";
}) {
  const active = sort.key === sortKey;
  return (
    <th
      className={`px-4 py-2.5 font-medium whitespace-nowrap cursor-pointer select-none hover:text-text ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
      onClick={() => onSort(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {label}
        {active ? (sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
      </span>
    </th>
  );
}
