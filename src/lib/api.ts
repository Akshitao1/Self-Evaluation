import type {
    ClientCatalogEntry,
    DMConfig,
    EntityInfo,
    ExecuteRequest,
    ExecutionHistoryItem,
    ExecutionHistoryListItem,
    ExecutionSummary,
    PreviewRow,
    PublisherEntry,
    SavedConfig,
    SavedConfigListItem,
  } from "./types";
  
  const BASE = "/api";
  
  async function request<T>(url: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${url}`, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw { status: res.status, detail: body.detail ?? body };
    }
    return res.json();
  }
  
  export async function fetchPreview(config: DMConfig): Promise<PreviewRow[]> {
    return request<PreviewRow[]>("/dm/preview", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }
  
  export async function executeRun(req: ExecuteRequest): Promise<ExecutionSummary> {
    return request<ExecutionSummary>("/dm/execute", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }
  
  export async function fetchEntities(
    client_id: string,
    entity_level: string,
    start_date?: string,
    end_date?: string,
  ): Promise<EntityInfo[]> {
    const body: Record<string, string> = { client_id, entity_level };
    if (start_date && end_date) {
      body.start_date = start_date;
      body.end_date = end_date;
    }
    return request<EntityInfo[]>("/dm/entities", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
  
  export async function healthCheck(): Promise<{ status: string; version: string }> {
    return request("/health");
  }
  
  /* ── Client catalog (q9) ──────────────────────────────────────────────── */
  
  export async function searchClients(query: string, limit = 20): Promise<ClientCatalogEntry[]> {
    if (!query || query.trim().length < 2) return [];
    const params = new URLSearchParams({ q: query.trim(), limit: String(limit) });
    return request<ClientCatalogEntry[]>(`/dm/clients?${params}`);
  }

  export async function getClientById(clientId: string): Promise<ClientCatalogEntry | null> {
    const trimmed = (clientId ?? "").trim();
    if (!trimmed) return null;
    const params = new URLSearchParams({ client_id: trimmed });
    try {
      return await request<ClientCatalogEntry>(`/dm/clients?${params}`);
    } catch (e: any) {
      if (e?.status === 404) return null; // not found vs. service error
      throw e;
    }
  }
  
  /* ── Publisher catalog ───────────────────────────────────────────────── */
  
  export async function fetchPublishers(
    client_id: string,
    start_date?: string,
    end_date?: string,
  ): Promise<PublisherEntry[]> {
    if (!client_id) return [];
    const params = new URLSearchParams({ client_id });
    if (start_date && end_date) {
      params.set("start_date", start_date);
      params.set("end_date", end_date);
    }
    return request<PublisherEntry[]>(`/dm/publishers?${params}`);
  }
  
  /* ── Saved configs (Postgres) ────────────────────────────────────────── */
  
  export async function listSavedConfigs(
    clientId?: string,
    q?: string,
  ): Promise<SavedConfigListItem[]> {
    const params = new URLSearchParams();
    if (clientId) params.set("client_id", clientId);
    if (q) params.set("q", q);
    const suffix = params.toString() ? `?${params}` : "";
    return request<SavedConfigListItem[]>(`/dm/saved-configs${suffix}`);
  }
  
  export async function getSavedConfig(id: string): Promise<SavedConfig> {
    return request<SavedConfig>(`/dm/saved-configs/${encodeURIComponent(id)}`);
  }
  
  export async function createSavedConfig(body: {
    label: string;
    config: DMConfig;
    client_id: string;
    client_name: string;
    agency_id: string | null;
    agency_name: string | null;
    status: string | null;
  }): Promise<SavedConfig> {
    return request<SavedConfig>(`/dm/saved-configs`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
  
  export async function updateSavedConfig(
    id: string,
    patch: { label?: string; config?: DMConfig },
  ): Promise<SavedConfig> {
    return request<SavedConfig>(`/dm/saved-configs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }
  
  export async function deleteSavedConfig(id: string): Promise<{ deleted: boolean; id: string }> {
    return request<{ deleted: boolean; id: string }>(
      `/dm/saved-configs/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  }
  
  /* ── Execution history (Postgres) ────────────────────────────────────── */
  
  export async function listExecutions(clientId?: string): Promise<ExecutionHistoryListItem[]> {
    const params = new URLSearchParams();
    if (clientId) params.set("client_id", clientId);
    const suffix = params.toString() ? `?${params}` : "";
    return request<ExecutionHistoryListItem[]>(`/dm/executions${suffix}`);
  }
  
  export async function getExecution(id: string): Promise<ExecutionHistoryItem> {
    return request<ExecutionHistoryItem>(`/dm/executions/${encodeURIComponent(id)}`);
  }
  