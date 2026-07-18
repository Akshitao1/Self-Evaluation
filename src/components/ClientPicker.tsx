import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { getClientById, searchClients } from "../lib/api";
import type { ClientCatalogEntry, ClientMeta } from "../lib/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface Props {
  /** Stable value — always the UUID when known, echoed back to parent on every change. */
  value: string;
  /** Whatever we have about the selected client (name, agency, status). */
  meta: ClientMeta | null;
  onChange: (value: string, meta: ClientMeta | null) => void;
  placeholder?: string;
  /** The client_id of the *primary* client. When set and equal to a picked row, the UI warns (used for INDEED comparison). */
  disallowClientId?: string | null;
  /** Smaller, inline variant — used inside GoalRow's Comparison Entity slot. */
  compact?: boolean;
  /** Force an initial mode. Defaults to "search" unless a non-UUID ID is present. */
  initialMode?: "search" | "id";
}

function isLikelyUuid(s: string | null | undefined): boolean {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

function statusChipClass(status: string | null | undefined): string {
  const s = (status ?? "").toUpperCase();
  if (s === "A" || s === "ACTIVE") return "bg-success-light text-success";
  if (s === "I" || s === "INACTIVE") return "bg-surface-alt text-text-muted";
  if (s === "P" || s === "PAUSED") return "bg-warning-light text-warning";
  return "bg-surface-alt text-text-muted";
}

function statusLabel(status: string | null | undefined): string {
  const s = (status ?? "").toUpperCase();
  if (s === "A") return "Active";
  if (s === "I") return "Inactive";
  if (s === "P") return "Paused";
  return status ?? "—";
}

export default function ClientPicker({
  value,
  meta,
  onChange,
  placeholder,
  disallowClientId,
  compact = false,
  initialMode,
}: Props) {
  const hasSelection = Boolean(value && meta && meta.client_id === value);
  const [mode, setMode] = useState<"search" | "id">(() => {
    if (initialMode) return initialMode;
    if (value && !meta) return "id";
    return "search";
  });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientCatalogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  // Lifecycle of the by-id (UUID-paste) lookup, kept separate from the
  // name-search loading/err above so the two paths don't clobber each other.
  const [idLoading, setIdLoading] = useState(false);
  const [idErr, setIdErr] = useState<"not_found" | "lookup_failed" | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (mode !== "search") return;
    if (hasSelection) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setErr(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    const t = window.setTimeout(async () => {
      try {
        const data = await searchClients(q, 20);
        if (cancelled) return;
        setResults(data);
        setOpen(true);
        setActiveIdx(0);
      } catch (e: any) {
        if (!cancelled) {
          setResults([]);
          setErr(typeof e?.detail === "string" ? e.detail : "Search failed");
          setOpen(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, mode, hasSelection]);

  // Resolve client metadata when a full UUID is entered/pasted in id mode, so
  // the saved-config record gets the real client name (not just the id).
  useEffect(() => {
    if (mode !== "id") return;
    const id = value.trim();
    // Already resolved for this exact id — no-op (also breaks the loop where a
    // successful lookup updates `meta`, which re-triggers this effect).
    if (meta && meta.client_id === id) { setIdErr(null); setIdLoading(false); return; }
    if (!isLikelyUuid(id)) { setIdLoading(false); setIdErr(null); return; }

    let cancelled = false;
    setIdLoading(true);
    setIdErr(null);
    const t = window.setTimeout(async () => {
      try {
        const row = await getClientById(id);
        if (cancelled) return;
        if (row) {
          onChange(id, {
            client_id: row.client_id,
            client_name: row.client_name,
            agency_id: row.agency_id,
            agency_name: row.agency_name,
            status: row.status,
          });
        } else {
          // Valid UUID but absent from the catalog: keep the id (preview/execute
          // still work), leave meta null; save falls back to id-as-name.
          setIdErr("not_found");
        }
      } catch {
        if (!cancelled) setIdErr("lookup_failed");
      } finally {
        if (!cancelled) setIdLoading(false);
      }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mode, meta]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(row: ClientCatalogEntry) {
    onChange(row.client_id, {
      client_id: row.client_id,
      client_name: row.client_name,
      agency_id: row.agency_id,
      agency_name: row.agency_name,
      status: row.status,
    });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function clear() {
    onChange("", null);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  const duplicateWarning = useMemo(
    () =>
      disallowClientId && value && value === disallowClientId
        ? "Comparison client must differ from the primary Client ID."
        : null,
    [disallowClientId, value],
  );

  // Selected chip view
  if (hasSelection && mode === "search" && meta) {
    return (
      <div className={compact ? "space-y-1" : "space-y-1.5"}>
        <SelectionChip meta={meta} onClear={clear} />
        {!compact && (
          <div className="text-[11px] text-text-muted font-mono truncate">{value}</div>
        )}
        {duplicateWarning && (
          <div className="text-[11px] text-danger">{duplicateWarning}</div>
        )}
      </div>
    );
  }

  return (
    <div ref={boxRef} className={compact ? "space-y-1" : "space-y-1.5"}>
      {/* Mode switch */}
      <div className="inline-flex rounded-md border border-border bg-surface-alt p-0.5 text-[11px]">
        <button
          type="button"
          onClick={() => { setMode("search"); setErr(null); }}
          className={`px-2 py-0.5 cursor-pointer rounded ${mode === "search" ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"}`}
        >
          Search by name
        </button>
        <button
          type="button"
          onClick={() => { setMode("id"); setOpen(false); setErr(null); }}
          className={`px-2 py-0.5 cursor-pointer rounded ${mode === "id" ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"}`}
        >
          Paste UUID
        </button>
      </div>

      {mode === "search" ? (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
          <input
            className="w-full h-9 pl-8 pr-8 text-sm rounded-md border border-border bg-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => { if (results.length > 0 || query.trim().length >= 2) setOpen(true); }}
            onKeyDown={(e) => {
              if (!open) return;
              if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, Math.max(results.length - 1, 0))); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter" && results[activeIdx]) { e.preventDefault(); pick(results[activeIdx]); }
              else if (e.key === "Escape") { setOpen(false); }
            }}
            placeholder={placeholder ?? "Type at least 2 characters…"}
            autoComplete="off"
          />
          {loading && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted animate-spin" />
          )}
          {open && (
            <div className="absolute z-20 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
              {err ? (
                <div className="px-3 py-2 text-xs text-danger">{err}</div>
              ) : query.trim().length < 2 ? (
                <div className="px-3 py-2 text-xs text-text-muted">Type at least 2 characters to search…</div>
              ) : loading ? (
                <div className="px-3 py-2 text-xs text-text-muted">Searching…</div>
              ) : results.length === 0 ? (
                <div className="px-3 py-2 text-xs text-text-muted">No clients match "{query.trim()}".</div>
              ) : (
                results.map((r, i) => {
                  const blocked = disallowClientId && r.client_id === disallowClientId;
                  return (
                    <button
                      type="button"
                      key={`${r.client_id}:${r.agency_id ?? ""}`}
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => { if (!blocked) pick(r); }}
                      disabled={!!blocked}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs ${i === activeIdx ? "bg-surface-alt" : "bg-surface"} ${blocked ? "opacity-50 cursor-not-allowed" : "hover:bg-surface-alt"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <TruncatedText text={r.client_name} className="block truncate font-medium text-text" />
                        <TruncatedText
                          text={`${r.agency_name ?? (r.agency_id ? `Agency ${r.agency_id}` : "No agency")}${blocked ? " · same as primary client" : ""}`}
                          className="block truncate text-[11px] text-text-muted"
                        />
                      </div>
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${statusChipClass(r.status)} shrink-0`}>
                        {statusLabel(r.status)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      ) : (
        // UUID-paste mode
        <div className="space-y-1">
          <input
            className="w-full h-9 px-3 text-sm rounded-md border border-border bg-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 font-mono"
            value={value}
            onChange={(e) => {
              const next = e.target.value.trim();
              // Drop a stale chip when the id text changes; keep it if the same
              // id is re-entered or the component merely re-renders.
              onChange(next, meta && meta.client_id === next ? meta : null);
            }}
            placeholder="e.g. 1b4a7136-5323-…-…"
            autoComplete="off"
          />
          {idLoading && (
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <Loader2 className="w-3 h-3 animate-spin" /> Resolving client…
            </div>
          )}
          {!idLoading && hasSelection && meta && <SelectionChip meta={meta} onClear={clear} />}
          {!idLoading && !hasSelection && idErr === "not_found" && (
            <div className="text-[11px] text-warning">No client found for this ID — you can still save; the ID will be used as the name.</div>
          )}
          {!idLoading && !hasSelection && idErr === "lookup_failed" && (
            <div className="text-[11px] text-warning">Couldn&apos;t verify this client ID. You can still proceed.</div>
          )}
          {value && !isLikelyUuid(value) && (
            <div className="text-[11px] text-warning">Doesn't look like a 36-char UUID.</div>
          )}
          {duplicateWarning && (
            <div className="text-[11px] text-danger">{duplicateWarning}</div>
          )}
        </div>
      )}
    </div>
  );
}

// Renders text that may be clipped by `truncate`, surfacing the full value in
// a tooltip only when it actually overflows. Uses the Radix tooltip (instant,
// styled) instead of the native `title`, which has a long delay and is flaky
// inside the hover-highlighted dropdown rows.
function TruncatedText({
  text,
  title,
  className,
}: {
  text: string;
  /** Tooltip content; defaults to `text`. */
  title?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflow(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return (
    <Tooltip open={open && overflow} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <span ref={ref} className={className}>{text}</span>
      </TooltipTrigger>
      <TooltipContent className="bg-white text-black border border-border shadow-md [&_svg]:fill-white [&_svg]:bg-white">
        {title ?? text}
      </TooltipContent>
    </Tooltip>
  );
}

function SelectionChip({ meta, onClear }: { meta: ClientMeta; onClear: () => void }) {
  return (
    <div className="flex items-center gap-2 w-full rounded-md border border-border bg-surface px-3 h-9 text-sm">
      <Check className="w-3.5 h-3.5 text-success shrink-0" />
      <TruncatedText text={meta.client_name} className="truncate font-medium text-text" />
      {meta.agency_name && (
        <TruncatedText text={`· ${meta.agency_name}`} title={meta.agency_name} className="text-text-muted truncate" />
      )}
      {meta.status && (
        <span className={`ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded ${statusChipClass(meta.status)} shrink-0`}>
          {statusLabel(meta.status)}
        </span>
      )}
      <button
        type="button"
        onClick={onClear}
        className="ml-2 p-0.5 cursor-pointer rounded hover:bg-surface-alt text-text-muted hover:text-text shrink-0"
        aria-label="Clear selection"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
