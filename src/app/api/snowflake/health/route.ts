import { NextResponse } from "next/server";
import { executeQuery } from "@/lib/server/snowflake/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await executeQuery("SELECT 1 AS ok");
    return NextResponse.json({ status: "ok", snowflake: "connected" });
  } catch (err) {
    console.error("Snowflake health check failed:", err);
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
