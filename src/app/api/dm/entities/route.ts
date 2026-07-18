import { NextRequest, NextResponse } from "next/server";
import {
  getCampaignMetadata,
  getClientMetadata,
  getJobBudget,
  getJobgroupBudget,
  getJobgroupMetadata,
} from "@/lib/server/snowflake/queries/q2-entity-metadata";
import { EntityRequestSchema } from "@/lib/server/dm/models/dm-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface EntityInfo {
  entity_id: string;
  entity_name: string | null;
  budget: number | null;
  budget_cap_frequency: string | null;
  cpa: number | null;
  cpc: number | null;
}

function emptyInfo(eid: string): EntityInfo {
  return { entity_id: eid, entity_name: null, budget: null, budget_cap_frequency: null, cpa: null, cpc: null };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = EntityRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  }
  const { client_id: clientId, entity_level, start_date: sd, end_date: ed } = parsed.data;
  const level = entity_level.toUpperCase();

  console.log(`/dm/entities — client_id=${clientId}, entity_level=${level}, range=${sd}..${ed}`);

  const entities = new Map<string, EntityInfo>();
  try {
    if (level === "CLIENT") {
      for (const m of await getClientMetadata(clientId)) {
        entities.set(m.entity_id, {
          ...emptyInfo(m.entity_id),
          budget: m.effective_budget,
          cpa: m.cpa_goal,
        });
      }
    } else if (level === "CAMPAIGN") {
      for (const m of await getCampaignMetadata(clientId, sd, ed)) {
        entities.set(m.entity_id, {
          entity_id: m.entity_id,
          entity_name: m.entity_name,
          budget: m.effective_budget,
          budget_cap_frequency: null,
          cpa: m.cpa_goal,
          cpc: m.cpc_goal,
        });
      }
    } else if (level === "JOBGROUP") {
      for (const m of await getJobgroupMetadata(clientId, sd, ed)) {
        entities.set(m.entity_id, {
          entity_id: m.entity_id,
          entity_name: m.entity_name,
          budget: null,
          budget_cap_frequency: null,
          cpa: m.cpa_goal,
          cpc: m.cpc_goal,
        });
      }
      for (const b of await getJobgroupBudget(clientId, sd, ed)) {
        const existing = entities.get(b.entity_id);
        if (existing) {
          existing.budget = b.effective_budget;
        } else {
          entities.set(b.entity_id, { ...emptyInfo(b.entity_id), budget: b.effective_budget });
        }
      }
    } else if (level === "JOB") {
      for (const m of await getJobBudget(clientId, sd, ed)) {
        entities.set(m.entity_id, {
          ...emptyInfo(m.entity_id),
          budget: m.effective_budget,
          budget_cap_frequency: m.budget_cap_frequency,
        });
      }
    } else {
      return NextResponse.json({ detail: `Unsupported entity_level: ${entity_level}` }, { status: 400 });
    }

    const result = [...entities.values()];
    // Sort ascending by display name (nulls last), falling back to entity_id, so
    // every consumer (e.g. "Run on selected only") gets an alphabetical list.
    result.sort((a, b) => {
      const an = (a.entity_name ?? "").toLowerCase();
      const bn = (b.entity_name ?? "").toLowerCase();
      if (an && bn) return an < bn ? -1 : an > bn ? 1 : 0;
      if (an) return -1;
      if (bn) return 1;
      return a.entity_id < b.entity_id ? -1 : a.entity_id > b.entity_id ? 1 : 0;
    });
    console.log(`/dm/entities — returning ${result.length} entities for ${level}/${clientId}`);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Entity lookup failed:", err);
    return NextResponse.json(
      { detail: `Database error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
}
