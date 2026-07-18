"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Copy, Eye, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import { deleteSavedConfig, getSavedConfig, listSavedConfigs } from "../../../lib/api";
import { useStore } from "../../../lib/store";
import type { SavedConfigListItem } from "../../../lib/types";
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

function statusChipClass(status: string | null): string {
  const s = (status ?? "").toUpperCase();
  if (s === "A") return "bg-success-light text-success";
  if (s === "I") return "bg-surface-alt text-text-muted";
  if (s === "P") return "bg-warning-light text-warning";
  return "bg-surface-alt text-text-muted";
}

export default function SavedConfigsPage() {
  const router = useRouter();
  const { loadConfigFromHistory } = useStore();
  const [rows, setRows] = useState<SavedConfigListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [toDelete, setToDelete] = useState<SavedConfigListItem | null>(null);

  async function load(query = q) {
    setLoading(true);
    setError(null);
    try {
      const data = await listSavedConfigs(undefined, query.trim() || undefined);
      setRows(data);
    } catch (e: any) {
      setError(humanizeError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openConfig(row: SavedConfigListItem) {
    setBusyId(row.id);
    setError(null);
    try {
      const full = await getSavedConfig(row.id);
      loadConfigFromHistory(
        full.config,
        {
          client_id: full.client_id,
          client_name: full.client_name,
          agency_id: full.agency_id,
          agency_name: full.agency_name,
          status: full.status,
        },
        full.id,
        full.label,
      );
      router.push("/create");
    } catch (e: any) {
      setError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const id = toDelete.id;
    setBusyId(id);
    try {
      await deleteSavedConfig(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setToDelete(null);
    } catch (e: any) {
      setError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-primary" /> Saved Configs
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            Drafts you saved from the Configure page. Click one to load, tweak, and preview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") load();
              }}
              placeholder="Search by label or client…"
              className="h-9 w-64 pl-8 pr-3 text-sm rounded-md border border-border bg-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
          </div>
          <Button variant="ghost" onClick={() => load()} icon={<RefreshCw className="w-4 h-4" />}>
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-danger-light border border-danger/20 text-danger rounded-md p-4 text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}

      <Card>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading saved configs…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10">
            <Bookmark className="w-10 h-10 text-text-light mx-auto mb-3" />
            <p className="text-text font-medium">No saved configurations yet.</p>
            <p className="text-sm text-text-muted mt-1">
              Build a config on the Configure page and click &quot;Save Config&quot; to see it here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-alt text-text-muted text-xs text-left">
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Agency</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                  <th className="px-3 py-2 font-medium w-40 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border-light hover:bg-surface-alt/60">
                    <td className="px-3 py-2 font-medium">{r.label}</td>
                    <td className="px-3 py-2">{r.client_name}</td>
                    <td className="px-3 py-2 text-text-muted">{r.agency_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      {r.status && (
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${statusChipClass(r.status)}`}>
                          {r.status}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-text-muted text-xs">{formatTs(r.updated_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openConfig(r)}
                          disabled={busyId === r.id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded text-primary hover:bg-primary/10 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                          title="Open & edit"
                        >
                          {busyId === r.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                          Open
                        </button>
                        <button
                          onClick={() => openConfig(r)}
                          disabled={busyId === r.id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded text-text-muted hover:bg-surface-alt cursor-pointer disabled:cursor-not-allowed"
                          title="Load into editor"
                        >
                          <Copy className="w-3.5 h-3.5" /> Clone
                        </button>
                        <button
                          onClick={() => setToDelete(r)}
                          disabled={busyId === r.id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded text-danger hover:bg-danger-light disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {toDelete && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-navy/40">
          <div className="w-full max-w-md bg-surface rounded-md shadow-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border-light">
              <h3 className="font-semibold text-text">Delete saved config?</h3>
            </div>
            <div className="p-5 text-sm text-text">
              <p>
                Delete <span className="font-medium">&quot;{toDelete.label}&quot;</span>? This cannot be undone.
              </p>
            </div>
            <div className="px-5 py-3 bg-surface-alt border-t border-border-light flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setToDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDelete} loading={busyId === toDelete.id}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

