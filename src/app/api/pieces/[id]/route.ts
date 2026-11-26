import { NextRequest, NextResponse } from "next/server";
import { getPieceById } from "@/lib/store/pieces-store";


export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const piece = await getPieceById(id);
  if (!piece) {
    return NextResponse.json(
      { error: `La etiqueta "${id}" todavía no tiene una historia grabada.` },
      { status: 404 }
    );
  }
  return NextResponse.json({ piece });
}
