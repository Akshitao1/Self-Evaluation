import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  RunHistoryError,
  deleteSavedConfig,
  getSavedConfig,
  updateSavedConfig,
} from "@/lib/server/postgres/run-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchBodySchema = z.object({
  label: z.string().max(200).optional(),
  config: z.unknown().optional(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const row = await getSavedConfig(id);
    if (!row) return NextResponse.json({ detail: "Saved config not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof RunHistoryError) {
      return NextResponse.json({ detail: err.message }, { status: 503 });
    }
    throw err;
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ detail: parsed.error.issues }, { status: 422 });

  const patch: { label?: string; config?: unknown } = {};
  if (parsed.data.label !== undefined) patch.label = parsed.data.label;
  if (parsed.data.config !== undefined) patch.config = parsed.data.config;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ detail: "No fields to update" }, { status: 400 });
  }

  try {
    const row = await updateSavedConfig(id, patch);
    if (!row) return NextResponse.json({ detail: "Saved config not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof RunHistoryError) {
      return NextResponse.json({ detail: err.message }, { status: 503 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const deleted = await deleteSavedConfig(id);
    if (!deleted) return NextResponse.json({ detail: "Saved config not found" }, { status: 404 });
    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    if (err instanceof RunHistoryError) {
      return NextResponse.json({ detail: err.message }, { status: 503 });
    }
    throw err;
  }
}
