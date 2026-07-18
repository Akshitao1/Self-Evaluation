import { NextResponse } from "next/server";
import { executeQuery } from "@/lib/server/snowflake/client";
import { MONTHLY_REVENUE_DEMO, monthlyRevenueFromTableSql } from "@/lib/server/snowflake/queries/sales";
import { getSettings } from "@/lib/server/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function firstDayMonthsAgo(months: number): string {
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth() + 1;
  for (let i = 0; i < months; i += 1) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const { snowflake } = await getSettings();
    let rows: Record<string, unknown>[];
    if (snowflake.salesFqn) {
      const sql = monthlyRevenueFromTableSql(snowflake.salesFqn);
      rows = await executeQuery(sql, {
        start_date: firstDayMonthsAgo(24),
        end_date: todayYmd(),
      });
    } else {
      rows = await executeQuery(MONTHLY_REVENUE_DEMO, { months: 24 });
    }
    return NextResponse.json({ series: rows });
  } catch (err) {
    console.error("Monthly revenue query failed:", err);
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
