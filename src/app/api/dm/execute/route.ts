import { NextRequest, NextResponse } from "next/server";
import { ExecuteRequestSchema } from "@/lib/server/dm/models/dm-config";
import { runPipeline } from "@/lib/server/dm/pipeline";
import { executeCurls } from "@/lib/server/dm/engines/execute-runner";
import { createExecution } from "@/lib/server/postgres/run-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = ExecuteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  }
  const request = parsed.data;
  const t0 = Date.now();

  try {
    console.log(`Execute: running pipeline for client=${request.client_id}`);
    const { cells: pipelineCells } = await runPipeline(request);
    let cells = pipelineCells;

    const extreme = cells.filter((c) => c.flags.includes("EXTREME_NEGATIVE_MARKUP"));
    if (extreme.length > 0 && !request.confirm_extreme_markup) {
      const details = extreme.map((c) => ({
        publisher_id: c.publisher_id,
        date: c.event_publisher_date,
        entity_id: c.entity_id,
        markup_new: c.markup_new,
      }));
      return NextResponse.json(
        {
          detail: {
            message: "Extreme negative markup detected. Set confirm_extreme_markup=true to proceed.",
            cells_requiring_confirmation: details,
          },
        },
        { status: 400 },
      );
    }

    if (extreme.length > 0 && request.confirm_extreme_markup) {
      console.warn(`Execute: user confirmed ${extreme.length} extreme-markup cell(s)`);
      cells = cells.map((c) =>
        c.flags.includes("EXTREME_NEGATIVE_MARKUP") && c.curl_blocked ? { ...c, curl_blocked: false } : c,
      );
    }

    const summary = await executeCurls(cells);

    console.log(
      `Execute complete in ${Date.now() - t0} ms: written=${summary.cells_written} failed=${summary.cells_failed} skipped=${summary.cells_skipped}`,
    );

    // Best-effort: persist execution-history row
    try {
      let totalCdCurrent = 0;
      let totalCdNew = 0;
      let totalVpspend = 0;
      for (const c of cells) {
        totalCdCurrent += c.CDSpend_current;
        totalCdNew += c.CDSpend_NEW ?? 0;
        totalVpspend += c.VPSpend ?? 0;
      }
      const totalAdjustment = totalCdNew - totalCdCurrent;
      const finalMarginPct = totalVpspend > 0 ? (totalCdNew / totalVpspend - 1) * 100 : null;

      const historySummary = {
        total_cells: summary.total_cells,
        cells_written: summary.cells_written,
        cells_failed: summary.cells_failed,
        cells_skipped: summary.cells_skipped,
        total_cd_current: totalCdCurrent,
        total_cd_new: totalCdNew,
        total_vpspend: totalVpspend,
        total_adjustment: totalAdjustment,
        final_margin_pct: finalMarginPct,
        run_timestamp: summary.run_timestamp,
      };
      const {
        confirm_extreme_markup: _ignored,
        client_name,
        agency_id,
        agency_name,
        client_status,
        saved_config_id,
        executed_by_email,
        executed_by_name,
        ...configPayload
      } = request;
      void _ignored;

      // "What payload" — the actual wire body sent per cell, plus its outcome.
      const payloads = summary.results.map((r) => {
        const body: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r.curl_payload)) {
          if (v !== null && v !== undefined) body[k] = v;
        }
        return {
          cell_id: r.cell_id,
          curl_type: "MARKUP",
          http_status: r.http_status,
          success: r.success,
          body,
        };
      });

      await createExecution({
        config: configPayload,
        summary: historySummary,
        payloads,
        client_id: request.client_id,
        client_name: client_name ?? undefined,
        agency_id: agency_id ?? null,
        agency_name: agency_name ?? null,
        status: client_status ?? null,
        saved_config_id: saved_config_id ?? null,
        executed_by_email: executed_by_email ?? null,
        executed_by_name: executed_by_name ?? null,
      });
    } catch (err) {
      console.warn("Execution history persist skipped:", err);
    }

    return NextResponse.json(summary);
  } catch (err) {
    console.error("Execute pipeline failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const status = /snowflake|query failed/i.test(msg) ? 502 : 500;
    return NextResponse.json({ detail: status === 502 ? "Database query failed" : "Internal server error" }, { status });
  }
}
