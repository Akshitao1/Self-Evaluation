import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Search, X, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import Card from "./Card";
import { fetchEntities, fetchPublishers } from "../lib/api";
import type { EntityInfo, ExclusionConfig, PublisherEntry } from "../lib/types";
import { exclusionCount } from "../lib/types";

type Level = "CAMPAIGN" | "JOBGROUP" | "PUBLISHER";

interface Option {
  id: string;
  label: string;
  sublabel?: string | null;
}

interface Props {
  clientId: string;
  // Passed through to /dm/publishers so Snowflake can prune tracking-event
  // scans to the run window — without them the publisher query scans the
  // client's full history (tens of seconds).
  startDate?: string;
  endDate?: string;
  value: ExclusionConfig;
  onChange: (next: ExclusionConfig) => void;
}

const SECTION_META: Record<Level, { title: string; field: keyof ExclusionConfig; emptyHint: string }> = {
  CAMPAIGN: { title: "Campaigns", field: "campaign_ids", emptyHint: "No campaigns found for this client." },
  JOBGROUP: { title: "Job Groups", field: "jobgroup_ids", emptyHint: "No job groups found for this client." },
  PUBLISHER: { title: "Publishers", field: "publisher_ids", emptyHint: "No publishers found for this client." },
};

export default function ExclusionsCard({ clientId, startDate, endDate, value, onChange }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const total = exclusionCount(value);

  // Auto-expand if user has exclusions already set (e.g. after loading a saved config).
  const wasAutoExpanded = useRef(false);
  useEffect(() => {
    if (total > 0 && !wasAutoExpanded.current) {
      setCollapsed(false);
      wasAutoExpanded.current = true;
    }
  }, [total]);

  function setList(field: keyof ExclusionConfig, ids: string[]) {
    onChange({ ...value, [field]: ids });
  }

  function clearAll() {
    onChange({ campaign_ids: [], jobgroup_ids: [], job_ids: [], publisher_ids: [] });
  }

  return (
    <Card
      title={`Exclusions${total > 0 ? ` (${total} excluded)` : ""}`}
      action={
        <div className="flex items-center gap-3">
          {total > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-text-muted hover:text-text cursor-pointer underline underline-offset-2"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="text-text-muted hover:text-text flex items-center gap-1 cursor-pointer text-xs"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {collapsed ? "Show" : "Hide"}
          </button>
        </div>
      }
    >
      <p className="text-[13px] text-text-muted mb-4">
        Pick campaigns, job groups, or publishers to skip. Cells matching any of these entities or
        publishers will be <strong>skipped</strong> during execute — their markup stays untouched.
        Exclusions save with the config.
      </p>

      {collapsed ? (
        <div className="text-[13px] text-text-muted">
          {total === 0 ? (
            <span>No exclusions set. Click <em>Show</em> to pick entities or publishers to skip.</span>
          ) : (
            <SummaryChips value={value} />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <ExclusionSection
            level="CAMPAIGN"
            clientId={clientId}
            startDate={startDate}
            endDate={endDate}
            selected={value.campaign_ids}
            onChange={(ids) => setList("campaign_ids", ids)}
          />
          <ExclusionSection
            level="JOBGROUP"
            clientId={clientId}
            startDate={startDate}
            endDate={endDate}
            selected={value.jobgroup_ids}
            onChange={(ids) => setList("jobgroup_ids", ids)}
          />
          <ExclusionSection
            level="PUBLISHER"
            clientId={clientId}
            startDate={startDate}
            endDate={endDate}
            selected={value.publisher_ids}
            onChange={(ids) => setList("publisher_ids", ids)}
          />
        </div>
      )}
    </Card>
  );
}

function SummaryChips({ value }: { value: ExclusionConfig }) {
  const parts: string[] = [];
  if (value.campaign_ids.length) parts.push(`${value.campaign_ids.length} campaign${value.campaign_ids.length > 1 ? "s" : ""}`);
  if (value.jobgroup_ids.length) parts.push(`${value.jobgroup_ids.length} job group${value.jobgroup_ids.length > 1 ? "s" : ""}`);
  if (value.publisher_ids.length) parts.push(`${value.publisher_ids.length} publisher${value.publisher_ids.length > 1 ? "s" : ""}`);
  return <span>Excluding {parts.join(" · ")}.</span>;
}

interface SectionProps {
  level: Level;
  clientId: string;
  startDate?: string;
  endDate?: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}

function ExclusionSection({ level, clientId, startDate, endDate, selected, onChange }: SectionProps) {
  const meta = SECTION_META[level];
  const [expanded, setExpanded] = useState(false);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Auto-expand if this section already has selections.
  const didAutoOpen = useRef(false);
  useEffect(() => {
    if (selected.length > 0 && !didAutoOpen.current) {
      setExpanded(true);
      didAutoOpen.current = true;
    }
  }, [selected.length]);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      if (level === "PUBLISHER") {
        const rows: PublisherEntry[] = await fetchPublishers(clientId, startDate, endDate);
        setOptions(
          rows.map((r) => ({
            id: r.publisher_id,
            label: r.publisher_name || r.publisher_id,
            sublabel: r.publisher_bid_type,
          })),
        );
      } else {
        const rows: EntityInfo[] = await fetchEntities(clientId, level, startDate, endDate);
        setOptions(
          rows.map((r) => ({
            id: r.entity_id,
            label: r.entity_name || r.entity_id,
            sublabel: r.entity_name ? r.entity_id : null,
          })),
        );
      }
    } catch (e: unknown) {
      const msg = (e as { detail?: string } | null)?.detail ?? "Failed to load list";
      setError(typeof msg === "string" ? msg : "Failed to load list");
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [level, clientId, startDate, endDate]);

  // Lazy-load on first expand so we don't fire 4 Snowflake calls when the card opens.
  useEffect(() => {
    if (expanded && options === null && !loading) {
      void load();
    }
  }, [expanded, options, loading, load]);

  // Reset when client changes.
  const prevClient = useRef(clientId);
  useEffect(() => {
    if (prevClient.current !== clientId) {
      setOptions(null);
      setError(null);
      setQuery("");
      prevClient.current = clientId;
    }
  }, [clientId]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(() => {
    if (!options) return [];
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q)),
    );
  }, [options, query]);

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function clear() {
    onChange([]);
  }

  const title = `${meta.title}${selected.length ? ` · ${selected.length} excluded` : ""}`;

  return (
    <div className="border border-border-light rounded-md">
      <div className="flex items-center justify-between px-3 py-2 bg-surface-alt">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 text-sm font-medium text-text cursor-pointer"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {title}
        </button>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-text-muted hover:text-text cursor-pointer underline underline-offset-2"
          >
            Clear
          </button>
        )}
      </div>
      {expanded && (
        <div className="px-3 py-3 space-y-2">
          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((id) => {
                const opt = options?.find((o) => o.id === id);
                const label = opt?.label || id;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-warning-light text-warning rounded text-xs"
                  >
                    <span className="truncate max-w-[240px]">{label}</span>
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      className="hover:text-danger cursor-pointer"
                      title="Remove from exclusions"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {!clientId ? (
            <div className="text-xs text-text-muted italic">
              Select a client first to load {meta.title.toLowerCase()}.
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading {meta.title.toLowerCase()}…
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 text-xs text-danger bg-danger-light px-2 py-1.5 rounded">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div>{error}</div>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="inline-flex items-center gap-1 mt-1 underline underline-offset-2 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              </div>
            </div>
          ) : options && options.length === 0 ? (
            <div className="text-xs text-text-muted italic">{meta.emptyHint}</div>
          ) : (
            <>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${meta.title.toLowerCase()}…`}
                  className="w-full pl-7 pr-2 py-1 text-xs border border-border-light rounded bg-surface"
                />
              </div>
              <div className="max-h-48 overflow-y-auto border border-border-light rounded">
                {filtered.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-text-muted italic text-center">
                    No matches for "{query}".
                  </div>
                ) : (
                  filtered.map((o) => {
                    const checked = selectedSet.has(o.id);
                    return (
                      <label
                        key={o.id}
                        className={`flex items-start gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-surface-alt border-b border-border-light last:border-b-0 ${
                          checked ? "bg-warning-light/60" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(o.id)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-text truncate">{o.label}</div>
                          {o.sublabel && (
                            <div className="text-text-muted truncate text-[11px] font-mono">
                              {o.sublabel}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-text-muted pt-0.5">
                <span>
                  {filtered.length} of {options?.length ?? 0} shown
                </span>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="inline-flex items-center gap-1 hover:text-text cursor-pointer"
                  title="Refresh list"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
