"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Copy, Eye, Loader2, RefreshCw } from "lucide-react";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import { getExecution, listExecutions } from "../../../lib/api";
import { useStore } from "../../../lib/store";
import type {
  ExecutionHistoryItem,
  ExecutionHistoryListItem,
  ExecutionPayloadRecord,
} from "../../../lib/types";
import { humanizeError } from "../../../lib/errors";

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatNumber(n: unknown): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPct(n: unknown): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return `${n.toFixed(2)}%`;
}

export default function ExecutionHistoryPage() {
  const router = useRouter();
  const { loadConfigFromHistory } = useStore();
  const [rows, setRows] = useState<ExecutionHistoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ExecutionHistoryItem | "loading" | "error">>({});

  async function toggleExpand(id: string) {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next && details[id] === undefined) {
      setDetails((d) => ({ ...d, [id]: "loading" }));
      try {
        const full = await getExecution(id);
        setDetails((d) => ({ ...d, [id]: full }));
      } catch {
        setDetails((d) => ({ ...d, [id]: "error" }));
      }
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await listExecutions());
    } catch (e: any) {
      setError(humanizeError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cloneRun(row: ExecutionHistoryListItem) {
    setBusyId(row.id);
    setError(null);
    try {
      const full = await getExecution(row.id);
      loadConfigFromHistory(
        full.config,
        {
          client_id: full.client_id,
          client_name: full.client_name,
          agency_id: full.agency_id,
          agency_name: full.agency_name,
          status: full.status,
        },
        null,
        null,
      );
      router.push("/create");
    } catch (e: any) {
      setError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Execution History
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            Every successful Execute is auto-saved here. Clone a run to re-edit its config.
          </p>
        </div>
        <Button variant="ghost" onClick={load} icon={<RefreshCw className="w-4 h-4" />}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-danger-light border border-danger/20 text-danger rounded-md p-4 text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}

      <Card>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading history…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10">
            <Clock className="w-10 h-10 text-text-light mx-auto mb-3" />
            <p className="text-text font-medium">No executions yet.</p>
            <p className="text-sm text-text-muted mt-1">Successful runs from the Execute page will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-alt text-text-muted text-xs text-left">
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Executed By</th>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Agency</th>
                  <th className="px-3 py-2 font-medium text-right">Cells OK</th>
                  <th className="px-3 py-2 font-medium text-right">Failed</th>
                  <th className="px-3 py-2 font-medium text-right">Skipped</th>
                  <th className="px-3 py-2 font-medium text-right">Adjustment</th>
                  <th className="px-3 py-2 font-medium text-right">Final Margin</th>
                  <th className="px-3 py-2 font-medium w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = r.summary ?? {};
                  const expanded = expandedId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className="border-t border-border-light hover:bg-surface-alt/60 cursor-pointer"
                        onClick={() => toggleExpand(r.id)}
                      >
                        <td className="px-3 py-2 text-text-muted text-xs whitespace-nowrap">{formatTs(r.executed_at)}</td>
                        <td className="px-3 py-2 text-text-muted whitespace-nowrap">{r.executed_by_name ?? r.executed_by_email ?? "—"}</td>
                        <td className="px-3 py-2 font-medium">{r.client_name}</td>
                        <td className="px-3 py-2 text-text-muted">{r.agency_name ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-success font-medium">{formatNumber((s as any).cells_written)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber((s as any).cells_failed)}</td>
                        <td className="px-3 py-2 text-right text-text-muted">{formatNumber((s as any).cells_skipped)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber((s as any).total_adjustment)}</td>
                        <td className="px-3 py-2 text-right">{formatPct((s as any).final_margin_pct)}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => cloneRun(r)}
                              disabled={busyId === r.id}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded text-primary hover:bg-primary/10 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                              title="Clone into editor"
                            >
                              {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                              Clone
                            </button>
                            <button
                              onClick={() => toggleExpand(r.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded text-text-muted hover:bg-surface-alt cursor-pointer"
                              title="Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-t border-border-light bg-surface-alt/40">
                          <td colSpan={10} className="px-3 py-3">
                            <div className="grid grid-cols-4 gap-4 text-xs">
                              <KV k="Total Cells" v={formatNumber((s as any).total_cells)} />
                              <KV k="CD Spend (New)" v={formatNumber((s as any).total_cd_new)} />
                              <KV k="VP Spend" v={formatNumber((s as any).total_vpspend)} />
                              <KV k="Final Margin %" v={formatPct((s as any).final_margin_pct)} />
                              <KV k="Executed By" v={r.executed_by_name ?? "—"} />
                              <KV k="Executor Email" v={r.executed_by_email ?? "—"} />
                              <KV k="Executed At" v={formatTs(r.executed_at)} />
                              <KV k="Run ID" v={r.id} mono />
                              <KV k="Saved Config" v={r.saved_config_id ?? "—"} mono />
                            </div>
                            <PayloadsSection detail={details[r.id]} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function PayloadsSection({ detail }: { detail: ExecutionHistoryItem | "loading" | "error" | undefined }) {
  if (detail === undefined || detail === "loading") {
    return (
      <div className="mt-4 flex items-center gap-2 text-xs text-text-muted">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading payloads…
      </div>
    );
  }
  if (detail === "error") {
    return <div className="mt-4 text-xs text-danger">Could not load payloads.</div>;
  }
  const payloads = detail.payloads ?? [];
  if (payloads.length === 0) {
    return <div className="mt-4 text-xs text-text-muted">No payloads recorded for this run.</div>;
  }
  return (
    <div className="mt-4">
      <div className="text-xs font-medium text-text mb-2">Payloads ({payloads.length})</div>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {payloads.map((p: ExecutionPayloadRecord, i) => (
          <div key={`${p.cell_id}_${i}`} className="border border-border-light rounded bg-surface">
            <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border-light">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  p.curl_type === "MARKDOWN" ? "bg-warning-light text-warning" : "bg-[#E8EAF6] text-primary"
                }`}
              >
                {p.curl_type ?? "MARKUP"}
              </span>
              <span className="text-[11px] font-mono text-text-muted truncate flex-1">{p.cell_id}</span>
              <span className={`text-[11px] font-medium ${p.success ? "text-success" : "text-danger"}`}>
                {p.http_status ?? (p.success ? "OK" : "ERR")}
              </span>
            </div>
            <pre className="text-[10px] leading-relaxed font-mono p-2.5 overflow-x-auto whitespace-pre text-text">
              {JSON.stringify(p.body, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-text-muted">{k}</div>
      <div className={`text-text ${mono ? "font-mono text-[11px] truncate" : "font-medium"}`}>{v}</div>
    </div>
  );
}

