import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  RunHistoryError,
  createSavedConfig,
  listSavedConfigs,
} from "@/lib/server/postgres/run-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateBodySchema = z.object({
  label: z.string().min(1).max(200),
  config: z.unknown(),
  client_id: z.string().min(1),
  client_name: z.string().min(1),
  agency_id: z.string().nullish(),
  agency_name: z.string().nullish(),
  status: z.string().nullish(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? "100");

  if (!Number.isFinite(limit) || limit < 1 || limit > 500) {
    return NextResponse.json({ detail: "limit must be between 1 and 500" }, { status: 422 });
  }

  try {
    const rows = await listSavedConfigs({ client_id: clientId, q, limit });
    return NextResponse.json(rows);
  } catch (err) {
    if (err instanceof RunHistoryError) {
      return NextResponse.json({ detail: err.message }, { status: 503 });
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = CreateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues }, { status: 422 });
  }

  try {
    const row = await createSavedConfig({
      label: parsed.data.label,
      client_id: parsed.data.client_id,
      client_name: parsed.data.client_name,
      agency_id: parsed.data.agency_id ?? null,
      agency_name: parsed.data.agency_name ?? null,
      status: parsed.data.status ?? null,
      config: parsed.data.config,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (err instanceof RunHistoryError) {
      return NextResponse.json({ detail: err.message }, { status: 503 });
    }
    throw err;
  }
}
