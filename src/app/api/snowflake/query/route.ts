import { NextResponse } from "next/server";
import { executeQuery } from "@/lib/server/snowflake/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await executeQuery(
      "SELECT CURRENT_VERSION() AS version, CURRENT_TIMESTAMP() AS ts",
    );
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("Snowflake sample query failed:", err);
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
