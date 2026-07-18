"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, AlertTriangle, CheckCircle, XCircle, ArrowLeft, Copy, Check } from "lucide-react";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import Button from "../../../components/Button";
import { useStore } from "../../../lib/store";
import { executeRun } from "../../../lib/api";
import { formatCurl } from "../../../lib/curl-format";
import { humanizeExecuteError } from "../../../lib/errors";
import { PROFILE_KEY } from "../../../utils/authHelper";
import type { ExecuteRequest, ExecutionSummary, PreviewRow } from "../../../lib/types";

function readExecutor(): { email: string | null; name: string | null } {
  if (typeof window === "undefined") return { email: null, name: null };
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return { email: null, name: null };
    const p = JSON.parse(raw) as { email?: string; displayName?: string };
    return { email: p.email ?? null, name: p.displayName ?? null };
  } catch {
    return { email: null, name: null };
  }
}

export default function ExecutePage() {
  const { preview, config, execution, clientMeta, savedConfigId, setExecution } = useStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const executableRows = useMemo(
    () => preview.filter((r) => r.is_writeable && !r.curl_blocked),
    [preview],
  );
  const stats = useMemo(() => {
    const hasExtreme = preview.some((r) => r.flags.includes("EXTREME_NEGATIVE_MARKUP"));
    return { executable: executableRows.length, total: preview.length, hasExtreme };
  }, [preview, executableRows]);

  async function handleExecute() {
    if (!confirmed) return;
    setError(null);
    setLoading(true);
    try {
      const executor = readExecutor();
      const req: ExecuteRequest = {
        ...config,
        confirm_extreme_markup: stats.hasExtreme,
        client_name: clientMeta?.client_name ?? null,
        agency_id: clientMeta?.agency_id ?? null,
        agency_name: clientMeta?.agency_name ?? null,
        client_status: clientMeta?.status ?? null,
        saved_config_id: savedConfigId,
        executed_by_email: executor.email,
        executed_by_name: executor.name,
      };
      const result = await executeRun(req);
      setExecution(result);
    } catch (e: any) {
      setError(humanizeExecuteError(e));
    } finally {
      setLoading(false);
    }
  }

  if (!preview.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-text-muted">
        <p className="text-lg font-medium">No preview available</p>
        <p className="text-sm mt-1">Generate a preview first before executing.</p>
        <Button className="mt-4" onClick={() => router.push("/create")}>
          Go to Config
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text">Execute</h2>
          <p className="text-sm text-text-muted mt-0.5">Review and confirm before writing changes.</p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/preview")} icon={<ArrowLeft className="w-4 h-4" />}>
          Back to Preview
        </Button>
      </div>

      {!execution && (
        <>
          {/* Pre-execution summary */}
          <Card title="Execution Summary">
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div>
                <div className="text-xs text-text-muted font-medium">Total Cells</div>
                <div className="text-xl font-semibold mt-0.5">{stats.total}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted font-medium">Will Execute</div>
                <div className="text-xl font-semibold text-success mt-0.5">{stats.executable}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted font-medium">Skipped/Blocked</div>
                <div className="text-xl font-semibold text-danger mt-0.5">{stats.total - stats.executable}</div>
              </div>
            </div>

            {stats.hasExtreme && (
              <div className="bg-warning-light border border-warning/30 rounded-md p-4 flex items-start gap-3 mb-5">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-sm text-text">Extreme Markup Detected</div>
                  <div className="text-xs text-text-muted mt-0.5">
                    Some cells have extreme negative markup (below -500%). Confirming will override this safeguard.
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-border-light pt-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
                />
                <div>
                  <div className="text-sm font-medium text-text">
                    I confirm execution of {stats.executable} markup/markdown updates
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    Client:{" "}
                    {clientMeta?.client_name
                      ? `${clientMeta.client_name}${clientMeta.agency_name ? ` (${clientMeta.agency_name})` : ""}`
                      : config.client_id}{" "}
                    &middot; {config.start_date} to {config.end_date}
                  </div>
                </div>
              </label>
            </div>
          </Card>

          {/* Formed curls — testing aid (actual wire format, auth token redacted) */}
          <Card title={`Formed Curls (Testing) · ${executableRows.length}`}>
            {executableRows.length === 0 ? (
              <p className="text-sm text-text-muted">No executable cells — nothing to send.</p>
            ) : (
              <>
                <p className="text-xs text-text-muted mb-3">
                  Exact request fired per executable cell — copy-paste runnable.
                </p>
                <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                  {executableRows.map((row) => (
                    <CurlBlock key={`${row.publisher_id}_${row.event_publisher_date}_${row.entity_id}`} row={row} />
                  ))}
                </div>
              </>
            )}
          </Card>

          {error && (
            <div className="bg-danger-light border border-danger/20 text-danger rounded-md p-4 text-sm whitespace-pre-wrap">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              variant="success"
              onClick={handleExecute}
              loading={loading}
              disabled={!confirmed}
              icon={<Play className="w-4 h-4" />}
            >
              Execute {stats.executable} Curls
            </Button>
          </div>
        </>
      )}

      {execution && <ResultsView execution={execution} />}
    </div>
  );
}

function ResultsView({ execution }: { execution: ExecutionSummary }) {
  const { setExecution, resetForNewRun } = useStore();
  const router = useRouter();
  const allSuccess = execution.cells_failed === 0;

  return (
    <>
      <Card title="Execution Results">
        <div className="grid grid-cols-4 gap-4 mb-5">
          <ResultStat icon={<CheckCircle className="w-5 h-5 text-success" />} label="Written" value={execution.cells_written} />
          <ResultStat icon={<XCircle className="w-5 h-5 text-danger" />} label="Failed" value={execution.cells_failed} />
          <ResultStat icon={<AlertTriangle className="w-5 h-5 text-warning" />} label="Skipped" value={execution.cells_skipped} />
          <ResultStat icon={<Play className="w-5 h-5 text-primary" />} label="Total" value={execution.total_cells} />
        </div>

        <div className={`rounded-md p-4 flex items-center gap-3 ${allSuccess ? "bg-success-light" : "bg-danger-light"}`}>
          {allSuccess ? (
            <CheckCircle className="w-5 h-5 text-success shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-danger shrink-0" />
          )}
          <div>
            <div className={`font-medium text-sm ${allSuccess ? "text-success" : "text-danger"}`}>
              {allSuccess ? "All curls executed successfully" : `${execution.cells_failed} curl(s) failed`}
            </div>
            <div className="text-xs text-text-muted mt-0.5">Timestamp: {execution.run_timestamp}</div>
          </div>
        </div>
      </Card>

      {/* Failed details */}
      {execution.cells_failed > 0 && (
        <Card title="Failed Cells">
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-light bg-surface-alt text-text-muted text-xs">
                  <th className="px-4 py-2.5 text-left font-medium">Cell ID</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Retries</th>
                  <th className="px-4 py-2.5 text-left font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {execution.results
                  .filter((r) => !r.success)
                  .map((r) => (
                    <tr key={r.cell_id} className="border-b border-border-light">
                      <td className="px-4 py-2.5 font-medium">{r.cell_id}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="danger">{r.http_status ?? "N/A"}</Badge>
                      </td>
                      <td className="px-4 py-2.5">{r.retry_count}</td>
                      <td className="px-4 py-2.5 text-text-muted text-xs max-w-xs truncate">{r.error_message}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex justify-between pb-6">
        <Button
          variant="ghost"
          onClick={() => {
            resetForNewRun();
            router.push("/create");
          }}
        >
          New Run
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setExecution(null);
            router.push("/history");
          }}
        >
          View History
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setExecution(null);
            router.push("/preview");
          }}
        >
          Back to Preview
        </Button>
      </div>
    </>
  );
}

function CurlBlock({ row }: { row: PreviewRow }) {
  const [copied, setCopied] = useState(false);
  const curl = useMemo(() => formatCurl(row), [row]);
  const cellId = `${row.publisher_id}_${row.event_publisher_date}_${row.entity_id}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(curl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="border border-border-light rounded-md overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-surface-alt">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant={row.curl_type === "MARKDOWN" ? "warning" : "info"}>
            {row.curl_type ?? "MARKUP"}
          </Badge>
          <span className="text-xs font-mono text-text-muted truncate">{cellId}</span>
        </div>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded text-text-muted hover:bg-surface cursor-pointer shrink-0"
          title="Copy curl"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="text-[11px] leading-relaxed font-mono p-3 overflow-x-auto whitespace-pre text-text">
        {curl}
      </pre>
    </div>
  );
}

function ResultStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <div className="text-xs text-text-muted font-medium">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
}

