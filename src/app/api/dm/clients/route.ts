import { NextRequest, NextResponse } from "next/server";
import { getClientById, searchClients } from "@/lib/server/snowflake/queries/q9-client-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Single-client lookup by id (used when a client is entered by UUID).
  const clientIdParam = searchParams.get("client_id");
  if (clientIdParam !== null) {
    const trimmed = clientIdParam.trim();
    if (!trimmed) {
      return NextResponse.json({ detail: "client_id must be non-empty" }, { status: 422 });
    }
    try {
      const row = await getClientById(trimmed);
      if (!row) {
        return NextResponse.json({ detail: "Client not found" }, { status: 404 });
      }
      return NextResponse.json(row);
    } catch (err) {
      console.error("Client by-id lookup failed:", err);
      return NextResponse.json(
        { detail: `Client lookup failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 503 },
      );
    }
  }

  const q = searchParams.get("q") ?? "";
  const limit = Number(searchParams.get("limit") ?? "20");

  if (q.length < 2) {
    return NextResponse.json({ detail: "Query must be at least 2 characters" }, { status: 422 });
  }
  if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
    return NextResponse.json({ detail: "limit must be between 1 and 100" }, { status: 422 });
  }

  try {
    const rows = await searchClients(q, limit);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("Client catalog search failed:", err);
    return NextResponse.json(
      { detail: `Client catalog search failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 503 },
    );
  }
}
