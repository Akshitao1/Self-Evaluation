"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Eye, Loader2, Check, Save, AlertTriangle, FilePlus } from "lucide-react";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import InfoTip from "../../../components/InfoTip";
import ClientPicker from "../../../components/ClientPicker";
import ExclusionsCard from "../../../components/ExclusionsCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { DatePicker } from "../../../components/ui/date-picker";
import { useStore, DEFAULT_CONFIG } from "../../../lib/store";
import { fetchPreview, fetchEntities, createSavedConfig, updateSavedConfig } from "../../../lib/api";
import type { ClientMeta, DMConfig, ExclusionConfig, GoalConfig, EntityInfo } from "../../../lib/types";
import { EMPTY_EXCLUSIONS } from "../../../lib/types";
import { humanizeError } from "../../../lib/errors";

const GOAL_TYPES = ["BUDGET", "CPA", "CPC", "CPAS", "INDEED", "FIXED_MARGIN"] as const;
const ENTITY_LEVELS = ["CLIENT", "CAMPAIGN", "JOBGROUP", "JOB"] as const;
const PACING_WINDOWS = ["DAILY", "WEEKLY", "BIWEEKLY"] as const;

const AUTO_FETCH_GOALS = new Set(["BUDGET", "CPA", "CPC", "JOB_BUDGET"]);
const AUTO_FETCH_LEVELS = new Set(["CLIENT", "CAMPAIGN", "JOBGROUP", "JOB"]);

function shouldAutoFetch(goal: GoalConfig): boolean {
  if (goal.goal_type === "FIXED_MARGIN" || goal.goal_type === "INDEED") return false;
  if (goal.entity_level === "CAMPAIGN") return true;
  if (goal.goal_type === "CPAS" && goal.entity_level === "JOBGROUP") return true;
  return AUTO_FETCH_GOALS.has(goal.goal_type) && AUTO_FETCH_LEVELS.has(goal.entity_level);
}

function getValueFromEntity(entity: EntityInfo, goalType: string): number | null {
  if (goalType === "BUDGET" || goalType === "JOB_BUDGET") return entity.budget;
  if (goalType === "CPA") return entity.cpa;
  if (goalType === "CPC") return entity.cpc;
  return null;
}

function levelLabel(level: string): string {
  if (level === "JOBGROUP") return "Job Groups";
  return level.charAt(0) + level.slice(1).toLowerCase() + "s";
}

function emptyGoal(): GoalConfig {
  return { goal_type: "BUDGET", entity_level: "CLIENT", entity_id: "", value: null, budget_level: "JAX" };
}

export default function ConfigPage() {
  const {
    config,
    clientMeta,
    comparisonMeta,
    savedConfigId,
    savedConfigLabel,
    loadSeq,
    setConfig,
    setPreview,
    setEntities,
    setClientMeta,
    setComparisonMeta,
    setSavedConfigRef,
    resetForNewRun,
  } = useStore();
  const [form, setForm] = useState<DMConfig>(config.client_id ? config : { ...DEFAULT_CONFIG });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entityFetchErrors, setEntityFetchErrors] = useState<Record<number, string>>({});
  const [fallbackModal, setFallbackModal] = useState<{ missing: string[]; pending: DMConfig } | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveDialog, setSaveDialog] = useState<{ mode: "create" | "rename"; initialLabel: string } | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [newRunConfirm, setNewRunConfirm] = useState(false);
  const router = useRouter();

  const [entitiesMap, setEntitiesMap] = useState<Record<number, EntityInfo[]>>({});
  const [entitiesLoading, setEntitiesLoading] = useState<Record<number, boolean>>({});
  const [selectMode, setSelectMode] = useState<Record<number, boolean>>({});

  const [manualEntitiesMap, setManualEntitiesMap] = useState<Record<number, EntityInfo[]>>({});
  const [manualEntitiesLoading, setManualEntitiesLoading] = useState<Record<number, boolean>>({});

  // Jobgroup list specifically for Indeed match_pct overrides.  Loaded on
  // demand when the user expands the overrides panel, kept separate from
  // manualEntitiesMap so the two features don't stomp on each other.
  const [indeedJgsMap, setIndeedJgsMap] = useState<Record<number, EntityInfo[]>>({});
  const [indeedJgsLoading, setIndeedJgsLoading] = useState<Record<number, boolean>>({});

  function update<K extends keyof DMConfig>(key: K, val: DMConfig[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const loadEntities = useCallback(
    async (goalIdx: number, clientId: string, entityLevel: string, startDate?: string, endDate?: string) => {
      if (!clientId.trim()) return;
      setEntitiesLoading((prev) => ({ ...prev, [goalIdx]: true }));
      setEntityFetchErrors((prev) => {
        const n = { ...prev };
        delete n[goalIdx];
        return n;
      });
      try {
        const entities = await fetchEntities(clientId, entityLevel, startDate, endDate);
        setEntitiesMap((prev) => ({ ...prev, [goalIdx]: entities }));
      } catch (e: any) {
        setEntitiesMap((prev) => ({ ...prev, [goalIdx]: [] }));
        const msg = humanizeError(e) || `Could not load ${entityLevel.toLowerCase()}s for this client.`;
        setEntityFetchErrors((prev) => ({ ...prev, [goalIdx]: msg }));
      } finally {
        setEntitiesLoading((prev) => ({ ...prev, [goalIdx]: false }));
      }
    },
    [],
  );

  const loadManualEntities = useCallback(async (goalIdx: number, clientId: string, level: string) => {
    if (!clientId.trim()) return;
    setManualEntitiesLoading((prev) => ({ ...prev, [goalIdx]: true }));
    try {
      const entities = await fetchEntities(clientId, level, form.start_date, form.end_date);
      setManualEntitiesMap((prev) => ({ ...prev, [goalIdx]: entities }));
    } catch {
      setManualEntitiesMap((prev) => ({ ...prev, [goalIdx]: [] }));
    } finally {
      setManualEntitiesLoading((prev) => ({ ...prev, [goalIdx]: false }));
    }
  }, [form.start_date, form.end_date]);

  const loadIndeedJgs = useCallback(async (goalIdx: number, clientId: string) => {
    if (!clientId.trim()) return;
    setIndeedJgsLoading((prev) => ({ ...prev, [goalIdx]: true }));
    try {
      const entities = await fetchEntities(clientId, "JOBGROUP", form.start_date, form.end_date);
      setIndeedJgsMap((prev) => ({ ...prev, [goalIdx]: entities }));
    } catch {
      setIndeedJgsMap((prev) => ({ ...prev, [goalIdx]: [] }));
    } finally {
      setIndeedJgsLoading((prev) => ({ ...prev, [goalIdx]: false }));
    }
  }, [form.start_date, form.end_date]);

  // Load auto-fetch entity lists on mount and whenever the date range changes,
  // so each list reflects only entities present in tracking for the range.
  useEffect(() => {
    if (!form.client_id.trim()) return;
    setEntitiesMap({});
    form.goals.forEach((goal, idx) => {
      if (shouldAutoFetch(goal)) {
        loadEntities(idx, form.client_id, goal.entity_level, form.start_date, form.end_date);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.start_date, form.end_date]);

  // Rehydrate local form state + entity lookups when a config is loaded from
  // Saved Configs or Execution History (loadSeq bumps).
  useEffect(() => {
    if (loadSeq === 0) return;
    setForm(config);
    setEntitiesMap({});
    setEntitiesLoading({});
    setSelectMode({});
    setManualEntitiesMap({});
    setManualEntitiesLoading({});
    setIndeedJgsMap({});
    setIndeedJgsLoading({});
    setEntityFetchErrors({});
    if (config.client_id && config.client_id.trim()) {
      config.goals.forEach((g, idx) => {
        if (shouldAutoFetch(g)) loadEntities(idx, config.client_id, g.entity_level, config.start_date, config.end_date);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSeq]);

  function updateGoal(idx: number, patch: Partial<GoalConfig>) {
    if (patch.goal_type === "JOB_BUDGET") {
      patch.entity_level = "JOB";
      if (!patch.budget_level) patch.budget_level = "JAX";
    }

    setForm((f) => {
      const goals = [...f.goals];
      goals[idx] = { ...goals[idx], ...patch };
      if (patch.goal_type && patch.goal_type !== "INDEED") {
        goals[idx].match_pct = null;
        goals[idx].indeed_metric = null;
        goals[idx].comparison_entity_id = null;
        goals[idx].indeed_publisher_name = null;
      }
      return { ...f, goals };
    });

    const newGoal = { ...form.goals[idx], ...patch };

    if ((patch.goal_type || patch.entity_level) && shouldAutoFetch(newGoal) && form.client_id.trim()) {
      setEntitiesMap((prev) => {
        const n = { ...prev };
        delete n[idx];
        return n;
      });
      setSelectMode((prev) => ({ ...prev, [idx]: false }));
      setForm((f) => {
        const goals = [...f.goals];
        goals[idx] = { ...goals[idx], ...patch, entity_id: "", value: null };
        return { ...f, goals };
      });
      loadEntities(idx, form.client_id, newGoal.entity_level, form.start_date, form.end_date);
    }
  }

  function toggleSelectMode(goalIdx: number, on: boolean) {
    setSelectMode((prev) => ({ ...prev, [goalIdx]: on }));
    if (!on) {
      setForm((f) => {
        const goals = [...f.goals];
        goals[goalIdx] = { ...goals[goalIdx], entity_id: "", value: null, per_entity_values: null };
        return { ...f, goals };
      });
    }
  }

  function selectEntity(goalIdx: number, entityId: string) {
    const entities = entitiesMap[goalIdx] ?? [];
    const entity = entities.find((e) => e.entity_id === entityId);
    setForm((f) => {
      const goals = [...f.goals];
      const dbValue = entity ? getValueFromEntity(entity, goals[goalIdx].goal_type) : null;
      goals[goalIdx] = {
        ...goals[goalIdx],
        entity_id: entityId,
        value: dbValue ?? goals[goalIdx].value,
      };
      return { ...f, goals };
    });
  }

  function addGoal() {
    if (form.goals.length >= 4) return;
    const newIdx = form.goals.length;
    setForm((f) => ({ ...f, goals: [...f.goals, emptyGoal()] }));
    if (form.client_id.trim()) {
      loadEntities(newIdx, form.client_id, "CLIENT", form.start_date, form.end_date);
    }
  }

  function removeGoal(idx: number) {
    if (form.goals.length <= 1) return;
    setForm((f) => ({ ...f, goals: f.goals.filter((_, i) => i !== idx) }));
    const reindex = (map: Record<number, any>) => {
      const next: Record<number, any> = {};
      Object.entries(map).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < idx) next[ki] = v;
        else if (ki > idx) next[ki - 1] = v;
      });
      return next;
    };
    setEntitiesMap(reindex);
    setSelectMode(reindex);
    setManualEntitiesMap(reindex);
    setManualEntitiesLoading(reindex);
  }

  function buildPendingConfig(): DMConfig {
    return {
      ...form,
      goals: form.goals.map((g) => ({
        ...g,
        entity_id: g.entity_id || form.client_id,
      })),
    };
  }

  async function runPreview(cfg: DMConfig) {
    setError(null);
    setLoading(true);
    try {
      setConfig(cfg);
      const allEntities = new Map<string, EntityInfo>();
      Object.values(entitiesMap)
        .flat()
        .forEach((e) => allEntities.set(e.entity_id, e));
      setEntities(Array.from(allEntities.values()));
      const rows = await fetchPreview(cfg);
      setPreview(rows);
      router.push("/preview");
    } catch (e: any) {
      setError(humanizeError(e));
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview() {
    setError(null);
    // Safety: detect goals where the user didn't pick an entity and we'd
    // silently fall back to the client_id. Always opt-in via modal.
    const missing = form.goals
      .map((g, i) => ({ goal: g, i }))
      .filter(({ goal }) => {
        if (goal.goal_type === "FIXED_MARGIN") return false;
        if (goal.entity_level === "CLIENT") return false;
        if (goal.entity_id && goal.entity_id.trim()) return false;
        // Manual budgets mode doesn't use entity_id — excluded.
        if (goal.manual_budget_values) return false;
        return true;
      })
      .map(({ goal, i }) => `Goal #${i + 1} (${goal.goal_type}/${goal.entity_level})`);

    if (missing.length > 0) {
      setFallbackModal({ missing, pending: buildPendingConfig() });
      return;
    }

    await runPreview(buildPendingConfig());
  }

  async function confirmFallbackAndPreview() {
    if (!fallbackModal) return;
    const pending = fallbackModal.pending;
    setFallbackModal(null);
    await runPreview(pending);
  }

  /* ─ Save / Save-As ─────────────────────────────────────────────────── */

  async function saveAsNew(label: string) {
    if (!label.trim()) return;
    if (!form.client_id.trim()) {
      setError("Pick or enter a client before saving this configuration.");
      setSaveDialog(null);
      return;
    }
    setSavingConfig(true);
    try {
      const created = await createSavedConfig({
        label: label.trim(),
        config: form,
        client_id: clientMeta?.client_id ?? form.client_id.trim(),
        // Backend requires a non-empty client_name; fall back to the id so a
        // client entered by UUID (or absent from the catalog) can still save.
        client_name: clientMeta?.client_name?.trim() || form.client_id.trim(),
        agency_id: clientMeta?.agency_id ?? null,
        agency_name: clientMeta?.agency_name ?? null,
        status: clientMeta?.status ?? null,
      });
      setSavedConfigRef(created.id, created.label);
      setSaveNotice(`Saved as "${created.label}".`);
      setSaveDialog(null);
    } catch (e: any) {
      setError(humanizeError(e));
      setSaveDialog(null);
    } finally {
      setSavingConfig(false);
    }
  }

  async function updateExisting() {
    if (!savedConfigId) return;
    setSavingConfig(true);
    try {
      const updated = await updateSavedConfig(savedConfigId, { config: form });
      setSavedConfigRef(updated.id, updated.label);
      setSaveNotice(`Updated "${updated.label}".`);
    } catch (e: any) {
      setError(humanizeError(e));
    } finally {
      setSavingConfig(false);
    }
  }

  async function renameExisting(label: string) {
    if (!savedConfigId || !label.trim()) return;
    setSavingConfig(true);
    try {
      const updated = await updateSavedConfig(savedConfigId, { label: label.trim() });
      setSavedConfigRef(updated.id, updated.label);
      setSaveNotice(`Renamed to "${updated.label}".`);
      setSaveDialog(null);
    } catch (e: any) {
      setError(humanizeError(e));
      setSaveDialog(null);
    } finally {
      setSavingConfig(false);
    }
  }

  // "New" button handler. Dirty state = user has entered anything meaningful,
  // or is editing an existing saved config. Only prompt in that case so a
  // user clicking New on a blank form doesn't see a pointless dialog.
  const isDirty = Boolean(savedConfigId) || Boolean(form.client_id && form.client_id.trim()) || form.goals.some((g) => g.entity_id || g.value != null);

  function handleNewRun() {
    if (isDirty) {
      setNewRunConfirm(true);
    } else {
      doNewRun();
    }
  }

  function doNewRun() {
    resetForNewRun();
    setError(null);
    setEntityFetchErrors({});
    setFallbackModal(null);
    setSaveDialog(null);
    setSaveNotice(null);
    setNewRunConfirm(false);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text">Configure Run</h2>
          <p className="text-sm text-text-muted mt-0.5">
            {savedConfigId && savedConfigLabel ? (
              <>
                Editing saved config <span className="font-medium text-text">&quot;{savedConfigLabel}&quot;</span>
              </>
            ) : (
              "Set the rules for how margin is calculated for this client, then preview before anything runs."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={handleNewRun} icon={<FilePlus className="w-4 h-4" />} title="Clear the form and start a fresh config">
            New
          </Button>
          {savedConfigId ? (
            <>
              <Button
                variant="ghost"
                onClick={() => setSaveDialog({ mode: "rename", initialLabel: savedConfigLabel ?? "" })}
                loading={savingConfig && saveDialog?.mode === "rename"}
                icon={<Save className="w-4 h-4" />}
              >
                Rename
              </Button>
              <Button variant="ghost" onClick={() => updateExisting()} loading={savingConfig && !saveDialog} icon={<Save className="w-4 h-4" />}>
                Save
              </Button>
              <Button
                variant="ghost"
                onClick={() => setSaveDialog({ mode: "create", initialLabel: `${savedConfigLabel ?? ""} (copy)` })}
                icon={<Save className="w-4 h-4" />}
              >
                Save As…
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              onClick={() =>
                setSaveDialog({
                  mode: "create",
                  initialLabel: clientMeta?.client_name ? `${clientMeta.client_name} — draft` : "",
                })
              }
              icon={<Save className="w-4 h-4" />}
            >
              Save Config
            </Button>
          )}
          <Button onClick={handlePreview} loading={loading} icon={<Eye className="w-4 h-4" />}>
            Generate Preview
          </Button>
        </div>
      </div>

      {saveNotice && (
        <div className="bg-success-light border border-success/20 text-success rounded-md px-4 py-2 text-sm flex items-center justify-between">
          <span>{saveNotice}</span>
          <button onClick={() => setSaveNotice(null)} className="text-success hover:opacity-70">
            ×
          </button>
        </div>
      )}

      {error && <div className="bg-danger-light border border-danger/20 text-danger rounded-md p-4 text-sm whitespace-pre-wrap">{error}</div>}

      <Card title="Client & Date Range">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="flex items-center gap-1 text-xs font-medium text-text-muted mb-1.5">
              Client
              <InfoTip text="Search by client name or paste a client ID." />
            </span>
            <ClientPicker
              value={form.client_id}
              meta={clientMeta}
              onChange={(v, m) => {
                // The picker may call onChange twice for one selection: once with
                // the raw id (meta null), then again once metadata resolves. Only
                // reset/re-fetch entity lists when the id itself actually changed.
                const idChanged = v.trim() !== form.client_id.trim();
                update("client_id", v);
                setClientMeta(m);
                if (idChanged) {
                  setEntitiesMap({});
                  setEntitiesLoading({});
                  setEntityFetchErrors({});
                  if (v && v.trim()) {
                    form.goals.forEach((g, idx) => {
                      if (shouldAutoFetch(g)) loadEntities(idx, v, g.entity_level, form.start_date, form.end_date);
                    });
                  }
                }
              }}
              placeholder="Search by client name…"
            />
          </div>
          <div>
            <span className="flex items-center gap-1 text-xs font-medium text-text-muted mb-1.5">
              Start Date
              <InfoTip text="Monthly goals → first day of the month. Weekly goals → first day of the week." />
            </span>
            <DatePicker value={form.start_date} onChange={(v) => update("start_date", v)} placeholder="Start date" />
            <span className="block text-xs text-text-muted mt-1">Margin calculation begins from this date.</span>
          </div>
          <div>
            <span className="flex items-center gap-1 text-xs font-medium text-text-muted mb-1.5">
              End Date
              <InfoTip text="Monthly goals → last day of the month. Weekly goals → last day of the week." />
            </span>
            <DatePicker value={form.end_date} onChange={(v) => update("end_date", v)} placeholder="End date" />
            <span className="block text-xs text-text-muted mt-1">Margin calculation stops after this date.</span>
          </div>
        </div>
      </Card>

      <Card
        title={`Goals (${form.goals.length}/4)`}
        action={
          form.goals.length < 4 ? (
            <button onClick={addGoal} className="text-primary hover:text-primary-light cursor-pointer text-sm font-medium flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Goal
            </button>
          ) : null
        }
      >
        <div className="space-y-4">
          <p className="flex items-center gap-1 text-xs text-text-muted">
            Add up to 4 rules for a client.
            <InfoTip text="Add up to 4 rules that margin is calculated against. With multiple goals, the tool uses the most restrictive result." />
          </p>
          {form.goals.map((goal, idx) => (
            <GoalRow
              key={idx}
              goal={goal}
              idx={idx}
              clientId={form.client_id}
              entities={entitiesMap[idx] ?? []}
              isLoading={entitiesLoading[idx] ?? false}
              isSelectMode={selectMode[idx] ?? false}
              manualEntities={manualEntitiesMap[idx] ?? []}
              manualLoading={manualEntitiesLoading[idx] ?? false}
              onLoadManualEntities={loadManualEntities}
              indeedJgs={indeedJgsMap[idx] ?? []}
              indeedJgsLoading={indeedJgsLoading[idx] ?? false}
              onLoadIndeedJgs={loadIndeedJgs}
              onUpdate={updateGoal}
              onSelectEntity={selectEntity}
              onToggleSelect={toggleSelectMode}
              onRemove={removeGoal}
              canRemove={form.goals.length > 1}
              fetchError={entityFetchErrors[idx]}
              comparisonMeta={comparisonMeta[idx] ?? null}
              onSetComparisonMeta={setComparisonMeta}
            />
          ))}
        </div>
      </Card>

      <Card title="Pacing">
        <div className="grid grid-cols-3 gap-4">
          <Field
            label="Strict Pacing"
            help="Cap daily spend evenly across the date range."
            tooltip="Strict: spreads the budget per day (e.g. 3,000/month over 30 days = 100/day cap). Non-strict: no daily ceiling."
          >
            <Select
              value={form.pacing_config.strict ? "true" : "false"}
              onValueChange={(val) =>
                update("pacing_config", {
                  ...form.pacing_config,
                  strict: val === "true",
                  window: val === "true" ? form.pacing_config.window || "DAILY" : null,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Strict</SelectItem>
                <SelectItem value="false">Non-strict (no ceiling)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {form.pacing_config.strict && (
            <Field label="Window">
              <Select
                value={form.pacing_config.window ?? "DAILY"}
                onValueChange={(val) => update("pacing_config", { ...form.pacing_config, window: val as "DAILY" | "WEEKLY" | "BIWEEKLY" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PACING_WINDOWS.map((w) => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
      </Card>

      <ExclusionsCard clientId={form.client_id} startDate={form.start_date} endDate={form.end_date} value={form.exclusions ?? EMPTY_EXCLUSIONS} onChange={(next: ExclusionConfig) => update("exclusions", next)} />

      <Card title="Past Edits">
        <div className="grid grid-cols-3 gap-4">
          <Field
            label="Allow Past Edits"
            help="Choose whether past dates can be changed."
            tooltip="No: margin applies from today only — past data is never altered. Yes: past data can be altered, limited by Lookback Days."
          >
            <Select
              value={form.past_edit_config.allow_past_edits ? "true" : "false"}
              onValueChange={(val) =>
                update("past_edit_config", {
                  allow_past_edits: val === "true",
                  lookback_days: val === "true" ? form.past_edit_config.lookback_days : null,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">No (future dates only)</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {form.past_edit_config.allow_past_edits && (
            <Field
              label="Lookback Days"
              help="How many recent days can be altered. Blank = full date range entered above."
              tooltip="Margin is still calculated for the whole period; only the last N days of data are actually changed. Example: 2 = only the last 2 days are altered."
            >
              <input
                type="number"
                value={form.past_edit_config.lookback_days ?? ""}
                onChange={(e) =>
                  update("past_edit_config", {
                    ...form.past_edit_config,
                    lookback_days: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Blank = unlimited"
              />
            </Field>
          )}
        </div>
      </Card>

      <div className="flex justify-end pb-6">
        <Button onClick={handlePreview} loading={loading} icon={<Eye className="w-4 h-4" />}>
          Generate Preview
        </Button>
      </div>

      {fallbackModal && <FallbackModal missing={fallbackModal.missing} clientLabel={clientMeta?.client_name ?? form.client_id} onCancel={() => setFallbackModal(null)} onConfirm={confirmFallbackAndPreview} />}

      {saveDialog && (
        <SaveDialog
          mode={saveDialog.mode}
          initialLabel={saveDialog.initialLabel}
          submitting={savingConfig}
          onCancel={() => setSaveDialog(null)}
          onSubmit={(label) => {
            if (saveDialog.mode === "rename") renameExisting(label);
            else saveAsNew(label);
          }}
        />
      )}

      {newRunConfirm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-navy/40">
          <div className="w-full max-w-md bg-surface rounded-md shadow-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border-light">
              <h3 className="font-semibold text-text">Start a new config?</h3>
            </div>
            <div className="p-5 text-sm text-text space-y-2">
              <p>
                This will clear the current form
                {savedConfigId && savedConfigLabel ? (
                  <>
                    {" "}
                    and unlink it from saved config <span className="font-medium">&quot;{savedConfigLabel}&quot;</span>
                  </>
                ) : null}
                . Any unsaved changes will be lost.
              </p>
              <p className="text-text-muted text-xs">
                Already-saved configs stay in <em>Saved Configs</em> — only your current editing state is cleared.
              </p>
            </div>
            <div className="px-5 py-3 bg-surface-alt border-t border-border-light flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setNewRunConfirm(false)}>
                Cancel
              </Button>
              <Button onClick={doNewRun} icon={<FilePlus className="w-4 h-4" />}>
                Start fresh
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FallbackModal({ missing, clientLabel, onCancel, onConfirm }: { missing: string[]; clientLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-navy/40">
      <div className="w-full max-w-md bg-surface rounded-md shadow-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border-light flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <h3 className="font-semibold text-text">Confirm client-level fallback</h3>
        </div>
        <div className="p-5 space-y-3 text-sm text-text">
          <p>You haven&apos;t picked an entity for:</p>
          <ul className="list-disc list-inside text-text-muted">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <p>
            These goals will run against the whole client <span className="font-medium">{clientLabel}</span> instead of a specific campaign/job-group/job.
          </p>
        </div>
        <div className="px-5 py-3 bg-surface-alt border-t border-border-light flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Go back
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Run at client level
          </Button>
        </div>
      </div>
    </div>
  );
}

function SaveDialog({
  mode,
  initialLabel,
  submitting,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "rename";
  initialLabel: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (label: string) => void;
}) {
  const [label, setLabel] = useState(initialLabel);
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-navy/40">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (label.trim()) onSubmit(label.trim());
        }}
        className="w-full max-w-md bg-surface rounded-md shadow-xl border border-border overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-border-light flex items-center gap-2">
          <Save className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-text">{mode === "rename" ? "Rename saved config" : "Save configuration"}</h3>
        </div>
        <div className="p-5 space-y-2 text-sm">
          <label className="block">
            <span className="block text-xs font-medium text-text-muted mb-1.5">Label</span>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={200}
              className="w-full h-9 px-3 text-sm rounded-md border border-border bg-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              placeholder="e.g. Yale NHH — June baseline"
            />
          </label>
          <p className="text-xs text-text-muted">
            Find it later in <span className="font-medium">Saved Configs</span>.
          </p>
        </div>
        <div className="px-5 py-3 bg-surface-alt border-t border-border-light flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={!label.trim()}>
            {mode === "rename" ? "Rename" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function GoalRow({
  goal,
  idx,
  clientId,
  entities,
  isLoading,
  isSelectMode,
  manualEntities,
  manualLoading,
  onLoadManualEntities,
  indeedJgs,
  indeedJgsLoading,
  onLoadIndeedJgs,
  onUpdate,
  onSelectEntity,
  onToggleSelect,
  onRemove,
  canRemove,
  fetchError,
  comparisonMeta,
  onSetComparisonMeta,
}: {
  goal: GoalConfig;
  idx: number;
  clientId: string;
  entities: EntityInfo[];
  isLoading: boolean;
  isSelectMode: boolean;
  manualEntities: EntityInfo[];
  manualLoading: boolean;
  onLoadManualEntities: (idx: number, clientId: string, level: string) => void;
  indeedJgs: EntityInfo[];
  indeedJgsLoading: boolean;
  onLoadIndeedJgs: (idx: number, clientId: string) => void;
  onUpdate: (idx: number, patch: Partial<GoalConfig>) => void;
  onSelectEntity: (idx: number, entityId: string) => void;
  onToggleSelect: (idx: number, on: boolean) => void;
  onRemove: (idx: number) => void;
  canRemove: boolean;
  fetchError?: string;
  comparisonMeta: ClientMeta | null;
  onSetComparisonMeta: (idx: number, m: ClientMeta | null) => void;
}) {
  const autoFetch = shouldAutoFetch(goal);
  const label = levelLabel(goal.entity_level);

  const entitiesWithValue = entities.filter((e) => getValueFromEntity(e, goal.goal_type) != null);
  const selectedEntity = entities.find((e) => e.entity_id === goal.entity_id);
  const resolvedValue = selectedEntity ? getValueFromEntity(selectedEntity, goal.goal_type) : null;
  const needsManualValue = autoFetch && entitiesWithValue.length === 0 && entities.length > 0;

  return (
    <div className="p-4 bg-surface-alt rounded-md border border-border-light">
      <div className="flex items-start gap-3">
        <div className={`flex-1 grid ${goal.goal_type === "FIXED_MARGIN" ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
          <Field
            label="Goal Type"
            tooltip="BUDGET, CPA, CPC, CPAS compare that metric at the selected level. PUBLISHER_COMPARISON benchmarks against a publisher. FIXED MARGIN % applies a set margin."
          >
            <Select value={goal.goal_type} onValueChange={(val) => onUpdate(idx, { goal_type: val as GoalConfig["goal_type"] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t === "FIXED_MARGIN" ? "FIXED MARGIN %" : t === "INDEED" ? "PUBLISHER_COMPARISION" : t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {goal.goal_type !== "FIXED_MARGIN" && (
            <Field label="Entity Level">
              <Select
                value={goal.entity_level}
                onValueChange={(val) => onUpdate(idx, { entity_level: val as GoalConfig["entity_level"] })}
                disabled={goal.goal_type === "JOB_BUDGET"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(goal.goal_type === "JOB_BUDGET" ? ENTITY_LEVELS : ENTITY_LEVELS.filter((l) => l !== "JOB")).map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
        <button onClick={() => onRemove(idx)} disabled={!canRemove} className="mt-6 p-1.5 text-text-muted hover:text-danger disabled:opacity-30 cursor-pointer rounded disabled:cursor-not-allowed">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {fetchError && (
        <div className="mt-3 flex items-start gap-2 bg-warning-light border border-warning/30 text-warning rounded-md px-3 py-2 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{fetchError}</span>
        </div>
      )}

      {goal.goal_type === "JOB_BUDGET" && (
        <div className="mt-3 pt-3 border-t border-border-light">
          <div className="max-w-xs">
            <Field label="Budget Level">
              <Select value={goal.budget_level ?? "JAX"} onValueChange={(val) => onUpdate(idx, { budget_level: val as "JAX" | "MAIN" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JAX">JAX Client</SelectItem>
                  <SelectItem value="MAIN">Main Client</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <p className="text-xs text-text-muted mt-2">
            {goal.budget_level === "MAIN"
              ? "Budget sourced from the parent (main) client; non-JAX publisher spend is subtracted."
              : "Budget sourced directly from the current JAX client."}
          </p>
        </div>
      )}

      {autoFetch && (
        <div className="mt-3 pt-3 border-t border-border-light">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-muted py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading {label.toLowerCase()}...
            </div>
          ) : (
            <>
              {/* Default: All entities with DB values */}
              {!isSelectMode && !needsManualValue && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded bg-success/10 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-success" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-text">All {label}</span>
                      <span className="text-xs text-text-muted ml-2">
                        {entities.length} total
                        {entitiesWithValue.length > 0 && entitiesWithValue.length < entities.length && (
                          <>
                            {" "}
                            &middot; {entitiesWithValue.length} with {goal.goal_type} value
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onToggleSelect(idx, true)}
                      className="text-xs font-medium text-primary hover:text-primary-light cursor-pointer px-2.5 py-1 rounded-md border border-primary/20 hover:bg-primary/5 transition-colors"
                    >
                      Run on selected only
                    </button>
                    <InfoTip text="Fetches current values for the selected goal + entity from the database. You can edit them at runtime; only selected entities are included." />
                  </div>
                </div>
              )}

              {/* Per-entity value editor: shown when in select mode OR no DB values exist */}
              {(isSelectMode || needsManualValue) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text-muted">
                      Set {goal.goal_type} per {goal.entity_level.toLowerCase()} &middot; {entities.length} total
                    </span>
                    {isSelectMode && (
                      <button onClick={() => onToggleSelect(idx, false)} className="text-xs cursor-pointer font-medium text-text-muted hover:text-primary px-2 py-0.5 rounded transition-colors">
                        Use all {label.toLowerCase()}
                      </button>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto rounded-md border border-border-light">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-surface-alt text-text-muted text-xs sticky top-0">
                          <th className="text-left px-3 py-2">{goal.entity_level === "CAMPAIGN" ? "Campaign" : goal.entity_level === "JOBGROUP" ? "Job Group" : "Entity"}</th>
                          {goal.goal_type === "JOB_BUDGET" && <th className="text-center px-3 py-2 w-24">Frequency</th>}
                          <th className="px-3 py-2 w-40">
                            <span className="flex items-center justify-end gap-1">
                              {goal.goal_type} Value
                              <InfoTip text="Pre-filled from the database where available. You can edit any value here before previewing." />
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {entities.map((e) => {
                          const pev = goal.per_entity_values ?? {};
                          const dbVal = getValueFromEntity(e, goal.goal_type);
                          const curVal = pev[e.entity_id];
                          return (
                            <tr key={e.entity_id} className="border-t border-border-light hover:bg-surface-alt/60">
                              <td className="px-3 py-1.5 font-medium truncate max-w-[220px]" title={e.entity_name ?? e.entity_id}>
                                {e.entity_name ?? e.entity_id.slice(0, 24)}
                              </td>
                              {goal.goal_type === "JOB_BUDGET" && (
                                <td className="px-3 py-1.5 text-center">
                                  {e.budget_cap_frequency ? (
                                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                                      {e.budget_cap_frequency}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-text-muted">—</span>
                                  )}
                                </td>
                              )}
                              <td className="px-3 py-1.5 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={curVal ?? dbVal ?? ""}
                                  onChange={(ev) => {
                                    const next = { ...pev };
                                    if (ev.target.value === "") delete next[e.entity_id];
                                    else next[e.entity_id] = Number(ev.target.value);
                                    onUpdate(idx, { per_entity_values: Object.keys(next).length ? next : null });
                                  }}
                                  placeholder="Enter value"
                                  className="w-32 h-7 px-2 text-sm text-right rounded border border-border bg-surface outline-none focus:border-primary"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {goal.per_entity_values && (
                    <p className="text-xs text-text-muted">
                      {Object.keys(goal.per_entity_values).length} of {entities.length} with custom values
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Manual budget fallback for JOB_BUDGET */}
      {goal.goal_type === "JOB_BUDGET" && autoFetch && !isLoading && (
        <div className="mt-3 pt-3 border-t border-border-light space-y-3">
          <div className="flex items-end gap-3">
            <div className="w-48">
              <Field label="Manual Budget Level">
                <Select
                  value={goal.manual_budget_level ?? "__none__"}
                  onValueChange={(val) => {
                    const lvl = (val === "__none__" ? null : val) as GoalConfig["manual_budget_level"];
                    onUpdate(idx, { manual_budget_level: lvl, manual_budget_values: null });
                    if (lvl && lvl !== "CLIENT" && clientId.trim()) {
                      onLoadManualEntities(idx, clientId, lvl);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None (DB only)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (DB only)</SelectItem>
                    <SelectItem value="CLIENT">Client (all jobs same budget)</SelectItem>
                    <SelectItem value="CAMPAIGN">Campaign</SelectItem>
                    <SelectItem value="JOBGROUP">Job Group</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {goal.manual_budget_level === "CLIENT" && (
              <div className="w-48">
                <Field label="Budget Value">
                  <input
                    type="number"
                    step="0.01"
                    value={goal.value ?? ""}
                    onChange={(e) => onUpdate(idx, { value: e.target.value ? Number(e.target.value) : null })}
                    placeholder="e.g. 10000"
                  />
                </Field>
              </div>
            )}
          </div>
          <p className="text-xs text-text-muted">
            {!goal.manual_budget_level && "Jobs without a database budget will have no budget cap."}
            {goal.manual_budget_level === "CLIENT" && "All jobs without a DB budget share this single budget value."}
            {goal.manual_budget_level === "CAMPAIGN" && "Set a budget per campaign — all jobs in that campaign share it."}
            {goal.manual_budget_level === "JOBGROUP" && "Set a budget per job group — all jobs in that group share it."}
          </p>

          {/* Per-entity manual budget table for CAMPAIGN / JOBGROUP */}
          {goal.manual_budget_level && goal.manual_budget_level !== "CLIENT" && (
            <>
              {manualLoading ? (
                <div className="flex items-center gap-2 text-sm text-text-muted py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading {levelLabel(goal.manual_budget_level).toLowerCase()}...
                </div>
              ) : manualEntities.length > 0 ? (
                <div className="max-h-60 overflow-y-auto rounded-md border border-border-light">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-alt text-text-muted text-xs sticky top-0">
                        <th className="text-left px-3 py-2">{goal.manual_budget_level === "CAMPAIGN" ? "Campaign" : "Job Group"}</th>
                        <th className="text-right px-3 py-2 w-40">Budget</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualEntities.map((e) => {
                        const mbv = goal.manual_budget_values ?? {};
                        return (
                          <tr key={e.entity_id} className="border-t border-border-light hover:bg-surface-alt/60">
                            <td className="px-3 py-1.5 font-medium truncate max-w-[220px]" title={e.entity_name ?? e.entity_id}>
                              {e.entity_name ?? e.entity_id.slice(0, 24)}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={mbv[e.entity_id] ?? ""}
                                onChange={(ev) => {
                                  const next = { ...mbv };
                                  if (ev.target.value) {
                                    next[e.entity_id] = Number(ev.target.value);
                                  } else {
                                    delete next[e.entity_id];
                                  }
                                  onUpdate(idx, { manual_budget_values: Object.keys(next).length ? next : null });
                                }}
                                placeholder="Enter budget"
                                className="w-32 h-7 px-2 text-sm text-right rounded border border-border bg-surface outline-none focus:border-primary"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-text-muted">No {levelLabel(goal.manual_budget_level).toLowerCase()} found for this client.</p>
              )}
              {goal.manual_budget_values && (
                <p className="text-xs text-text-muted">
                  {Object.keys(goal.manual_budget_values).length} of {manualEntities.length} with a manual budget
                </p>
              )}
            </>
          )}

          {/* Flat fallback for jobs that don't match any manual entry */}
          {goal.manual_budget_level && goal.manual_budget_level !== "CLIENT" && (
            <div className="max-w-xs pt-2">
              <Field label="Fallback Budget (for unmatched jobs)">
                <input
                  type="number"
                  step="0.01"
                  value={goal.value ?? ""}
                  onChange={(e) => onUpdate(idx, { value: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Optional — leave blank for no cap"
                />
              </Field>
            </div>
          )}
        </div>
      )}

      {/* Manual entry for non-auto-fetch goals (JOB level, CPAS, FIXED_MARGIN, INDEED) */}
      {!autoFetch && goal.goal_type !== "INDEED" && goal.goal_type !== "FIXED_MARGIN" && (
        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border-light">
          <Field label="Entity ID">
            <input value={goal.entity_id} onChange={(e) => onUpdate(idx, { entity_id: e.target.value })} placeholder="Entity identifier" />
          </Field>
          <Field label="Value" tooltip="Pre-filled from the database where available. You can edit any value here before previewing.">
            <input type="number" value={goal.value ?? ""} onChange={(e) => onUpdate(idx, { value: e.target.value ? Number(e.target.value) : null })} placeholder="e.g. 10000" />
          </Field>
        </div>
      )}

      {goal.goal_type === "FIXED_MARGIN" && (
        <div className="mt-3 pt-3 border-t border-border-light">
          <div className="max-w-xs">
            <Field label="Margin %">
              <input type="number" step="0.01" value={goal.value ?? ""} onChange={(e) => onUpdate(idx, { value: e.target.value ? Number(e.target.value) : null })} placeholder="e.g. 15" />
            </Field>
          </div>
          <p className="text-xs text-text-muted mt-2">Applies to all entities — no cell will breach this margin within its budget.</p>
        </div>
      )}

      {goal.goal_type === "INDEED" && (
        <>
          <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-border-light">
            <Field label="Match %" tooltip="Sets how much margin is added relative to the comparison publisher — e.g. 80 keeps you within 80% of its CPA/CPC.">
              <input type="number" value={goal.match_pct ?? ""} onChange={(e) => onUpdate(idx, { match_pct: e.target.value ? Number(e.target.value) : null })} placeholder="e.g. 80" />
            </Field>
            <Field label="Metric">
              <Select
                value={goal.indeed_metric ?? "__none__"}
                onValueChange={(val) => onUpdate(idx, { indeed_metric: (val === "__none__" ? null : val) as GoalConfig["indeed_metric"] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select...</SelectItem>
                  <SelectItem value="CPA">CPA</SelectItem>
                  <SelectItem value="CPC">CPC</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div>
              <span className="flex items-center gap-1 text-xs font-medium text-text-muted mb-1.5">
                Comparison Entity
                <InfoTip text="Can be the same client or a different one — whichever publisher you want to match performance to." />
              </span>
              <ClientPicker
                value={goal.comparison_entity_id ?? ""}
                meta={comparisonMeta}
                disallowClientId={clientId || null}
                compact
                onChange={(v, m) => {
                  onUpdate(idx, { comparison_entity_id: v || null });
                  onSetComparisonMeta(idx, m);
                }}
                placeholder="Search comparison client…"
              />
            </div>
            <Field label="Publisher Name" tooltip="Name the publisher you're comparing against.">
              <input value={goal.indeed_publisher_name ?? ""} onChange={(e) => onUpdate(idx, { indeed_publisher_name: e.target.value || null })} placeholder="e.g. Indeed" />
            </Field>
          </div>

          <IndeedOverridesSection goal={goal} idx={idx} clientId={clientId} jobgroups={indeedJgs} loading={indeedJgsLoading} onLoad={onLoadIndeedJgs} onUpdate={onUpdate} />
        </>
      )}
    </div>
  );
}

function IndeedOverridesSection({
  goal,
  idx,
  clientId,
  jobgroups,
  loading,
  onLoad,
  onUpdate,
}: {
  goal: GoalConfig;
  idx: number;
  clientId: string;
  jobgroups: EntityInfo[];
  loading: boolean;
  onLoad: (idx: number, clientId: string) => void;
  onUpdate: (idx: number, patch: Partial<GoalConfig>) => void;
}) {
  // Jobgroup-keyed overrides only make sense when the goal is computed at
  // JOBGROUP or JOB grain — the backend validator rejects others, so hide
  // the section entirely otherwise to keep the surface area small.
  const overridable = goal.entity_level === "JOBGROUP" || goal.entity_level === "JOB";
  const overrides = goal.match_pct_overrides ?? {};
  const overrideCount = Object.keys(overrides).length;
  const [expanded, setExpanded] = useState<boolean>(overrideCount > 0);

  if (!overridable) {
    // If user has overrides set at a wrong level, still show a warning so
    // they can clear them rather than get a confusing submit error.
    if (overrideCount === 0) return null;
    return (
      <div className="mt-3 pt-3 border-t border-border-light">
        <p className="text-xs text-warning">
          Per-jobgroup match % overrides are set ({overrideCount}) but the goal&apos;s entity_level is <span className="font-mono">{goal.entity_level}</span>.
          Overrides are keyed by jobgroup, so they only apply when entity_level is JOBGROUP or JOB.{" "}
          <button type="button" className="text-primary hover:underline" onClick={() => onUpdate(idx, { match_pct_overrides: null })}>
            Clear overrides
          </button>
        </p>
      </div>
    );
  }

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (next && jobgroups.length === 0 && !loading && clientId.trim()) {
      onLoad(idx, clientId);
    }
  }

  function setOverride(jgId: string, rawVal: string) {
    const next = { ...overrides };
    if (rawVal === "") {
      delete next[jgId];
    } else {
      const n = Number(rawVal);
      if (!Number.isFinite(n)) return;
      next[jgId] = n;
    }
    onUpdate(idx, {
      match_pct_overrides: Object.keys(next).length ? next : null,
    });
  }

  // Always keep jobgroups that already have an override visible even if the
  // backend list doesn't include them (e.g. inactive).  Merge + dedupe.
  const rowsFromServer = jobgroups;
  const extraIds = Object.keys(overrides).filter((id) => !jobgroups.some((e) => e.entity_id === id));
  const extraRows: EntityInfo[] = extraIds.map((id) => ({
    entity_id: id,
    entity_name: null,
    budget: null,
    budget_cap_frequency: null,
    cpa: null,
    cpc: null,
  }));
  const allRows = [...rowsFromServer, ...extraRows];

  return (
    <div className="mt-3 pt-3 border-t border-border-light space-y-2">
      <div className="flex items-center justify-between">
        <button type="button" onClick={toggleExpanded} className="text-sm font-medium text-text hover:text-primary flex items-center gap-2">
          <span>Per-jobgroup Match % overrides</span>
          <span className="text-xs text-text-muted">
            ({overrideCount > 0 ? `${overrideCount} set` : "none"}
            {goal.match_pct != null ? ` · global = ${goal.match_pct}%` : ""})
          </span>
          <span className="text-xs text-text-light">{expanded ? "▾" : "▸"}</span>
        </button>
        {expanded && overrideCount > 0 && (
          <button type="button" onClick={() => onUpdate(idx, { match_pct_overrides: null })} className="text-xs text-text-muted hover:text-danger">
            Clear all
          </button>
        )}
      </div>

      {expanded && (
        <>
          <p className="text-xs text-text-muted">
            Leave blank to use the global match % above. Jobs belonging to multiple jobgroups use the tightest (lowest) override.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-text-muted py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading jobgroups...
            </div>
          ) : allRows.length > 0 ? (
            <div className="max-h-60 overflow-y-auto rounded-md border border-border-light">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-alt text-text-muted text-xs sticky top-0">
                    <th className="text-left px-3 py-2">Job Group</th>
                    <th className="text-right px-3 py-2 w-40">Match %</th>
                  </tr>
                </thead>
                <tbody>
                  {allRows.map((e) => (
                    <tr key={e.entity_id} className="border-t border-border-light hover:bg-surface-alt/60">
                      <td className="px-3 py-1.5 font-medium truncate max-w-[260px]" title={e.entity_name ?? e.entity_id}>
                        {e.entity_name ?? e.entity_id.slice(0, 24)}
                        <span className="ml-2 font-mono text-[10px] text-text-light">{e.entity_id.slice(0, 8)}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={overrides[e.entity_id] ?? ""}
                          onChange={(ev) => setOverride(e.entity_id, ev.target.value)}
                          placeholder={goal.match_pct != null ? `${goal.match_pct}` : "e.g. 80"}
                          className="w-28 h-7 px-2 text-sm text-right rounded border border-border bg-surface outline-none focus:border-primary"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-text-muted">{clientId.trim() ? "No jobgroups found for this client." : "Enter a Client ID first to load jobgroups."}</p>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, children, help, tooltip }: { label: string; children: React.ReactNode; help?: string; tooltip?: string }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-xs font-medium text-text-muted mb-1.5">
        {label}
        {tooltip && <InfoTip text={tooltip} />}
      </span>
      <div className="[&>input]:w-full [&>input]:h-9 [&>input]:px-3 [&>input]:text-sm [&>input]:rounded-md [&>input]:border [&>input]:border-border [&>input]:bg-surface [&>input]:outline-none [&>input]:focus:border-primary [&>input]:focus:ring-1 [&>input]:focus:ring-primary/20">
        {children}
      </div>
      {help && <span className="block text-xs text-text-muted mt-1">{help}</span>}
    </label>
  );
}

