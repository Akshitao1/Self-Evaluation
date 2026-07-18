import { NextRequest, NextResponse } from "next/server";
import { RunHistoryError, getExecution } from "@/lib/server/postgres/run-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const row = await getExecution(id);
    if (!row) return NextResponse.json({ detail: "Execution not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof RunHistoryError) {
      return NextResponse.json({ detail: err.message }, { status: 503 });
    }
    throw err;
  }
}
