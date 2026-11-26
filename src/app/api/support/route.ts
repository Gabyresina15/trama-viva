import { NextRequest, NextResponse } from "next/server";
import { supportPieceBridge } from "@/lib/bridge/chain";
import { appendSupportReceipt, getPieceById } from "@/lib/store/pieces-store";
import {
  SPLIT_PRESETS,
  SupportReceiptRecord,
  SupportRequestSchema,
} from "@/lib/types/trama";


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SupportRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Solicitud inválida" },
        { status: 400 }
      );
    }

    const piece = await getPieceById(parsed.data.pieceId);
    if (!piece) {
      return NextResponse.json(
        { error: "La pieza indicada no existe." },
        { status: 404 }
      );
    }

    const preset = SPLIT_PRESETS[piece.splitPresetId];
    const holdInEscrow = preset ? preset.holdArtisanInEscrowDefault : true;

    const txResult = await supportPieceBridge({
      pieceId: piece.id,
      amountUsdc: parsed.data.amountUsdc,
      artisanBps: piece.artisanBps,
      artisanAddress: piece.artisanAddress,
      salaAddress: piece.salaAddress,
      passportHashHex: piece.passportHashHex,
      holdInEscrow,
    });

    const receipt: SupportReceiptRecord = {
      txHash: txResult.txHash,
      pieceId: piece.id,
      createdAt: new Date().toISOString(),
      amountUsdc: parsed.data.amountUsdc,
      totalStroops: txResult.totalStroops,
      artisanStroops: txResult.artisanStroops,
      salaStroops: txResult.salaStroops,
      heldInContractEscrow: txResult.heldInContractEscrow,
      supporterAddress: txResult.supporterAddress,
      contractId: txResult.contractId,
      passportHashHex: piece.passportHashHex,
      explorerTxUrl: txResult.explorerTxUrl,
      chainMode: txResult.chainMode,
      supporterNote: parsed.data.supporterNote,
    };

    await appendSupportReceipt(receipt);

    return NextResponse.json({ receipt }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo procesar el apoyo en USDC";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
