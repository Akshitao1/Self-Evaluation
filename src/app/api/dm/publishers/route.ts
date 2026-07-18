import { NextRequest, NextResponse } from "next/server";
import { getPublisherMetadata } from "@/lib/server/snowflake/queries/q2-entity-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CachedEntry {
  ts: number;
  rows: { publisher_id: string; publisher_name: string | null; publisher_bid_type: string | null }[];
}
const CACHE_TTL_MS = 120 * 1000;
const cache = new Map<string, CachedEntry>();

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  if (!clientId) {
    return NextResponse.json({ detail: "client_id is required" }, { status: 422 });
  }
  if ((startDate === null) !== (endDate === null)) {
    return NextResponse.json(
      { detail: "start_date and end_date must be provided together." },
      { status: 400 },
    );
  }
  if (startDate && endDate) {
    if (!isYmd(startDate) || !isYmd(endDate)) {
      return NextResponse.json({ detail: "Dates must be YYYY-MM-DD" }, { status: 400 });
    }
    if (startDate > endDate) {
      return NextResponse.json(
        { detail: "start_date must be on or before end_date." },
        { status: 400 },
      );
    }
  }

  const cacheKey = `${clientId}|${startDate ?? ""}|${endDate ?? ""}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && now - hit.ts < CACHE_TTL_MS) {
    return NextResponse.json(hit.rows);
  }

  try {
    const rows = await getPublisherMetadata(clientId, startDate ?? undefined, endDate ?? undefined);
    const result = rows
      .map((r) => ({
        publisher_id: r.publisher_id,
        publisher_name: r.publisher_name,
        publisher_bid_type: r.publisher_bid_type,
      }))
      .sort((a, b) => (a.publisher_name ?? a.publisher_id).toLowerCase().localeCompare((b.publisher_name ?? b.publisher_id).toLowerCase()));
    cache.set(cacheKey, { ts: now, rows: result });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Publisher catalog lookup failed:", err);
    return NextResponse.json(
      { detail: `Publisher lookup failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 503 },
    );
  }
}
