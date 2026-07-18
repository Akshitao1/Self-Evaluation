import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DMConfigSchema } from "@/lib/server/dm/models/dm-config";
import { runPipeline } from "@/lib/server/dm/pipeline";
import { buildPreview } from "@/lib/server/dm/engines/preview-builder";
import type { PreviewRow } from "@/lib/server/dm/models/cell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sanitizeFloats(rows: PreviewRow[]): PreviewRow[] {
  const fields: (keyof PreviewRow)[] = [
    "budget_ceiling",
    "metric_ceiling",
    "pacing_ceiling",
    "indeed_ceiling",
    "margin_ceiling",
    "CDSpend_ceiling",
    "ideal_spend",
    "CDSpend_NEW",
    "spend_delta",
    "spend_delta_pct",
    "markup_new",
    "markdown_new",
    "markup_delta",
  ];
  for (const row of rows) {
    for (const f of fields) {
      const v = row[f];
      if (typeof v === "number" && (!Number.isFinite(v) || Number.isNaN(v))) {
        (row as unknown as Record<string, unknown>)[f as string] = null;
      }
    }
  }
  return rows;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = DMConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  }

  const t0 = Date.now();
  try {
    const { cells, writeableDates, entityNameMap, context } = await runPipeline(parsed.data);
    const rows = buildPreview(cells, writeableDates, entityNameMap, {
      jobToJg: context.job_to_jg,
      jgToCampaign: context.jg_to_campaign,
      jgBudgets: context.jg_budgets,
    });
    sanitizeFloats(rows);
    console.log(`Preview complete: ${rows.length} rows in ${Date.now() - t0} ms for client=${parsed.data.client_id}`);
    return NextResponse.json(rows);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ detail: err.issues }, { status: 400 });
    }
    console.error("Preview pipeline failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const status = /snowflake|query failed/i.test(msg) ? 502 : 500;
    return NextResponse.json({ detail: status === 502 ? "Database query failed" : "Internal server error" }, { status });
  }
}
