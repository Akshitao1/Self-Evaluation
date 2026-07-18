import { NextRequest, NextResponse } from "next/server";
import { RunHistoryError, listExecutions } from "@/lib/server/postgres/run-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? "100");

  if (!Number.isFinite(limit) || limit < 1 || limit > 500) {
    return NextResponse.json({ detail: "limit must be between 1 and 500" }, { status: 422 });
  }

  try {
    const rows = await listExecutions({ client_id: clientId, limit });
    return NextResponse.json(rows);
  } catch (err) {
    if (err instanceof RunHistoryError) {
      return NextResponse.json({ detail: err.message }, { status: 503 });
    }
    throw err;
  }
}
