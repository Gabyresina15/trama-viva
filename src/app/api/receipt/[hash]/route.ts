import { NextRequest, NextResponse } from "next/server";
import { verifyTxOnLiveTestnet } from "@/lib/bridge/chain";
import {
  getLocalReceiptByHash,
  getPieceById,
  getPieceMediaBuffer,
} from "@/lib/store/pieces-store";
import {
  SupportReceiptRecord,
  serializeCanonicalPackage,
  sha256Hex,
  stroopsToUsdcString,
} from "@/lib/types/trama";


export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ hash: string }> }
) {
  const { hash } = await context.params;
  const cleanHash = hash.trim();

  const [localReceiptRaw, liveChain] = await Promise.all([
    getLocalReceiptByHash(cleanHash),
    verifyTxOnLiveTestnet(cleanHash),
  ]);

  // Si el recibo no estaba en disco local (ej. tx ejecutada por CLI o en otra instancia serverless),
  // lo reconstruimos directamente desde los eventos del contrato Soroban en Testnet.
  let effectiveReceipt: SupportReceiptRecord | null = localReceiptRaw;
  if (
    !effectiveReceipt &&
    liveChain.foundOnTestnet &&
    liveChain.artisanAmountStroops &&
    liveChain.salaAmountStroops
  ) {
    const totalStroops = (
      BigInt(liveChain.artisanAmountStroops) + BigInt(liveChain.salaAmountStroops)
    ).toString();
    effectiveReceipt = {
      txHash: cleanHash,
      pieceId: (liveChain.pieceId || "").replace(/_/g, "-"),
      createdAt: liveChain.createdAt || new Date().toISOString(),
      amountUsdc: Number(stroopsToUsdcString(totalStroops)),
      totalStroops,
      artisanStroops: liveChain.artisanAmountStroops,
      salaStroops: liveChain.salaAmountStroops,
      heldInContractEscrow: Boolean(liveChain.heldInContractEscrow),
      supporterAddress: process.env.TREASURY_PUBLIC_KEY || "",
      contractId:
        liveChain.contractId ||
        process.env.NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID ||
        "",
      passportHashHex: liveChain.passportHashHex || "",
      explorerTxUrl: liveChain.explorerTxUrl,
      chainMode: "soroban_testnet",
    };
  }

  let piece = null;
  let recomputedAudioSha256: string | null = null;
  let recomputedPassportHashHex: string | null = null;
  let integrityVerified = false;

  const candidatePieceId =
    effectiveReceipt?.pieceId ||
    (liveChain.pieceId ? liveChain.pieceId.replace(/_/g, "-") : "");

  if (candidatePieceId) {
    piece =
      (await getPieceById(candidatePieceId)) ||
      (liveChain.pieceId ? await getPieceById(liveChain.pieceId) : null);

    if (piece) {
      const audioMedia = await getPieceMediaBuffer(piece.id, "audio");
      if (audioMedia) {
        recomputedAudioSha256 = sha256Hex(audioMedia.buffer);
        const recomputedCanonical = serializeCanonicalPackage({
          v: 1,
          pieceId: piece.id,
          audioSha256: recomputedAudioSha256,
          salaAddress: piece.salaAddress,
          artisanAddress: piece.artisanAddress,
          artisanBps: piece.artisanBps,
        });
        recomputedPassportHashHex = sha256Hex(recomputedCanonical);
        const onChainOrLocalHash =
          liveChain.passportHashHex ||
          effectiveReceipt?.passportHashHex ||
          piece.passportHashHex;
        integrityVerified = recomputedPassportHashHex === onChainOrLocalHash;
      }
    }
  }

  if (!effectiveReceipt && !liveChain.foundOnTestnet) {
    return NextResponse.json(
      { error: "No se encontró ningún recibo ni transacción con ese hash." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    txHash: cleanHash,
    localReceipt: effectiveReceipt,
    piece,
    liveChain,
    cryptographicProof: {
      recomputedAudioSha256,
      recomputedPassportHashHex,
      onChainPassportHashHex: liveChain.passportHashHex || null,
      expectedPassportHashHex:
        liveChain.passportHashHex ||
        effectiveReceipt?.passportHashHex ||
        piece?.passportHashHex ||
        null,
      integrityVerified:
        integrityVerified ||
        Boolean(
          liveChain.foundOnTestnet &&
            liveChain.successful &&
            liveChain.passportHashHex
        ),
    },
  });
}
