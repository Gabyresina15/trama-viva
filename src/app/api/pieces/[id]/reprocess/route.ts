import { NextRequest, NextResponse } from "next/server";
import { extractCulturalPassport } from "@/lib/ai/passport";
import { registerPieceBridge } from "@/lib/bridge/chain";
import {
  getPieceById,
  getPieceMediaBuffer,
  savePieceWithMedia,
} from "@/lib/store/pieces-store";
import {
  PieceRecord,
  serializeCanonicalPackage,
  sha256Hex,
} from "@/lib/types/trama";

function extFromMime(mime: string, fallback: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes("mp4") || lower.includes("m4a")) return "m4a";
  if (lower.includes("webm")) return "webm";
  if (lower.includes("wav")) return "wav";
  if (lower.includes("ogg")) return "ogg";
  if (lower.includes("mpeg") || lower.includes("mp3")) return "mp3";
  if (lower.includes("png")) return "png";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
  return fallback;
}

/**
 * Reprocesa una pieza ya grabada en Vercel Blob:
 * 1. Vuelve a correr transcripción Grok STT + estructuración LLM sobre el audio/foto guardados.
 * 2. Si la pieza había quedado en preview_local, la registra de verdad en el contrato Soroban Testnet.
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const existing = await getPieceById(id);
    if (!existing) {
      return NextResponse.json(
        { error: `No existe la pieza ${id}` },
        { status: 404 }
      );
    }

    const audioMedia = await getPieceMediaBuffer(existing.id, "audio");
    if (!audioMedia) {
      return NextResponse.json(
        { error: `No se encontró el archivo de audio para ${existing.id}` },
        { status: 404 }
      );
    }

    const photoMedia = await getPieceMediaBuffer(existing.id, "photo");

    const { passport, aiSource, diagnostics } = await extractCulturalPassport({
      audioBuffer: audioMedia.buffer,
      audioMimeType: audioMedia.mimeType,
      photoBuffer: photoMedia?.buffer,
      photoMimeType: photoMedia?.mimeType,
      manualCategory: existing.passport.craftMetadata.category,
    });

    const audioSha256 = sha256Hex(audioMedia.buffer);
    const canonicalPackageJson = serializeCanonicalPackage({
      v: 1,
      pieceId: existing.id,
      audioSha256,
      salaAddress: existing.salaAddress,
      artisanAddress: existing.artisanAddress,
      artisanBps: existing.artisanBps,
    });
    const passportHashHex = sha256Hex(canonicalPackageJson);

    const chainResult = await registerPieceBridge({
      pieceId: existing.id,
      passportHashHex,
      artisanBps: existing.artisanBps,
      salaAddress: existing.salaAddress,
      artisanAddress: existing.artisanAddress,
    });

    const updatedRecord: PieceRecord = {
      ...existing,
      audioSha256,
      canonicalPackageJson,
      passportHashHex,
      aiSource,
      passport,
      registrationTxHash: chainResult.txHash,
      contractId: chainResult.contractId,
      explorerTxUrl: chainResult.explorerTxUrl,
      explorerContractUrl: chainResult.explorerContractUrl,
      chainMode: chainResult.chainMode,
    };

    const saved = await savePieceWithMedia({
      record: updatedRecord,
      audioBuffer: audioMedia.buffer,
      audioExt: extFromMime(audioMedia.mimeType, "webm"),
      photoBuffer: photoMedia?.buffer,
      photoExt: photoMedia ? extFromMime(photoMedia.mimeType, "jpg") : undefined,
    });

    return NextResponse.json({
      piece: saved,
      diagnostics,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error reprocesando la pieza";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
