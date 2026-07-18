import { NextRequest, NextResponse } from 'next/server';
import {
  getState,
  approveItem,
  dismissItem,
  editItem,
  setRating,
  addEvidence,
  approveSuggestion,
  dismissSuggestion,
  resetState,
} from '@/lib/self-eval/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getState());
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}

/** Action dispatcher. Body: { action, ...args }. Returns the new state. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body as { action: string };
    switch (action) {
      case 'approve':
        return NextResponse.json(await approveItem(body.id));
      case 'dismiss':
        return NextResponse.json(await dismissItem(body.id));
      case 'edit':
        return NextResponse.json(
          await editItem(body.id, {
            title: body.title,
            impact: body.impact,
            cat: body.cat,
          }),
        );
      case 'setRating':
        return NextResponse.json(await setRating(body.id, Number(body.delta)));
      case 'addEvidence':
        return NextResponse.json(await addEvidence(body.id, String(body.text)));
      case 'approveSuggestion':
        return NextResponse.json(
          await approveSuggestion(body.competencyId, body.suggestionId),
        );
      case 'dismissSuggestion':
        return NextResponse.json(
          await dismissSuggestion(body.competencyId, body.suggestionId),
        );
      case 'reset':
        return NextResponse.json(await resetState());
      default:
        return NextResponse.json(
          { error: `unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
