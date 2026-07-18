import { useSyncExternalStore } from "react";
import type { ClientMeta, DMConfig, EntityInfo, ExecutionSummary, PreviewRow } from "./types";
import { EMPTY_EXCLUSIONS } from "./types";

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const now = new Date();
const monthStart = localDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
const today = localDateStr(now);

export const DEFAULT_CONFIG: DMConfig = {
  client_id: "",
  start_date: monthStart,
  end_date: today,
  goals: [
    { goal_type: "BUDGET", entity_level: "CLIENT", entity_id: "", value: null },
  ],
  pacing_config: { strict: false, window: null },
  past_edit_config: { allow_past_edits: true, lookback_days: null },
  exclusions: { ...EMPTY_EXCLUSIONS },
};

interface State {
  config: DMConfig;
  preview: PreviewRow[];
  execution: ExecutionSummary | null;
  entities: EntityInfo[];
  /** Client picker selection for the primary client_id field. */
  clientMeta: ClientMeta | null;
  /** Client picker selection for each INDEED goal's comparison_entity_id. Map is keyed by goal index. */
  comparisonMeta: Record<number, ClientMeta | null>;
  /** When a config was loaded from a saved entry — drives "Save" vs "Save As". */
  savedConfigId: string | null;
  savedConfigLabel: string | null;
  /** Monotonic counter incremented each time a config is loaded from history; a signal for the ConfigPage to rehydrate its local form state. */
  loadSeq: number;
}

let _state: State = {
  config: { ...DEFAULT_CONFIG },
  preview: [],
  execution: null,
  entities: [],
  clientMeta: null,
  comparisonMeta: {},
  savedConfigId: null,
  savedConfigLabel: null,
  loadSeq: 0,
};

const _listeners = new Set<() => void>();

function emitChange() {
  _state = { ..._state };
  _listeners.forEach((fn) => fn());
}

function subscribe(cb: () => void) {
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}

function getSnapshot() {
  return _state;
}

export function useStore() {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  return {
    config: state.config,
    preview: state.preview,
    execution: state.execution,
    entities: state.entities,
    clientMeta: state.clientMeta,
    comparisonMeta: state.comparisonMeta,
    savedConfigId: state.savedConfigId,
    savedConfigLabel: state.savedConfigLabel,
    loadSeq: state.loadSeq,
    setConfig: (c: DMConfig) => { _state.config = c; emitChange(); },
    setPreview: (p: PreviewRow[]) => { _state.preview = p; emitChange(); },
    setExecution: (e: ExecutionSummary | null) => { _state.execution = e; emitChange(); },
    setEntities: (e: EntityInfo[]) => { _state.entities = e; emitChange(); },
    setClientMeta: (m: ClientMeta | null) => { _state.clientMeta = m; emitChange(); },
    setComparisonMeta: (idx: number, m: ClientMeta | null) => {
      _state.comparisonMeta = { ..._state.comparisonMeta, [idx]: m };
      emitChange();
    },
    clearComparisonMeta: () => { _state.comparisonMeta = {}; emitChange(); },
    setSavedConfigRef: (id: string | null, label: string | null) => {
      _state.savedConfigId = id;
      _state.savedConfigLabel = label;
      emitChange();
    },
    loadConfigFromHistory: (cfg: DMConfig, meta: ClientMeta | null, savedId: string | null = null, savedLabel: string | null = null) => {
      // Back-compat: configs saved before exclusions existed won't have the
      // field. Coerce to an empty structure so downstream code can rely on it.
      if (!cfg.exclusions) cfg = { ...cfg, exclusions: { ...EMPTY_EXCLUSIONS } };
      _state.config = cfg;
      _state.clientMeta = meta;
      _state.comparisonMeta = {};
      _state.savedConfigId = savedId;
      _state.savedConfigLabel = savedLabel;
      _state.preview = [];
      _state.execution = null;
      _state.loadSeq = _state.loadSeq + 1;
      emitChange();
    },
    resetForNewRun: () => {
      _state.config = { ...DEFAULT_CONFIG };
      _state.clientMeta = null;
      _state.comparisonMeta = {};
      _state.savedConfigId = null;
      _state.savedConfigLabel = null;
      _state.preview = [];
      _state.execution = null;
      _state.loadSeq = _state.loadSeq + 1;
      emitChange();
    },
  };
}
