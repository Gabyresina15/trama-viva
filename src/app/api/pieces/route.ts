import { NextRequest, NextResponse } from "next/server";
import { extractCulturalPassport } from "@/lib/ai/passport";
import { registerPieceBridge } from "@/lib/bridge/chain";
import { listPieces, savePieceWithMedia } from "@/lib/store/pieces-store";
import {
  CraftCategorySchema,
  PieceIdSchema,
  PieceRecord,
  SPLIT_PRESETS,
  SplitPresetIdSchema,
  serializeCanonicalPackage,
  sha256Hex,
  toSorobanPieceSymbol,
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

export async function GET() {
  const pieces = await listPieces();
  return NextResponse.json({ pieces });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const rawPieceId =
      (formData.get("pieceId") as string | null)?.trim().toLowerCase() ||
      `pieza-${Date.now().toString(36).slice(-5)}`;
    const parsedId = PieceIdSchema.safeParse(rawPieceId);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: parsedId.error.issues[0]?.message || "ID de pieza inválido" },
        { status: 400 }
      );
    }

    const rawPreset =
      (formData.get("splitPresetId") as string | null) || "sala_colectiva";
    const parsedPreset = SplitPresetIdSchema.safeParse(rawPreset);
    const preset =
      SPLIT_PRESETS[parsedPreset.success ? parsedPreset.data : "sala_colectiva"];

    const rawCategory = (formData.get("category") as string | null) || "textil";
    const parsedCategory = CraftCategorySchema.safeParse(rawCategory);

    const hintTitle = (formData.get("hintTitle") as string | null)?.trim() || "";
    const locality = (formData.get("locality") as string | null)?.trim() || "";
    const manualTranscript =
      (formData.get("manualTranscript") as string | null)?.trim() || "";

    const audioEntry = formData.get("audio");
    if (!audioEntry || !(audioEntry instanceof Blob) || audioEntry.size === 0) {
      return NextResponse.json(
        { error: "Falta grabar o subir el audio de voz (15–20 segundos)." },
        { status: 400 }
      );
    }

    const audioArrayBuffer = await audioEntry.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);
    const audioMimeType = audioEntry.type || "audio/webm";
    const audioExt = extFromMime(audioMimeType, "webm");

    let photoBuffer: Buffer | undefined;
    let photoMimeType: string | undefined;
    let photoExt: string | undefined;

    const photoEntry = formData.get("photo");
    if (photoEntry && photoEntry instanceof Blob && photoEntry.size > 0) {
      photoBuffer = Buffer.from(await photoEntry.arrayBuffer());
      photoMimeType = photoEntry.type || "image/jpeg";
      photoExt = extFromMime(photoMimeType, "jpg");
    }

    // 1. Extraer Pasaporte Cultural Trilingüe con IA (o fallback instantáneo si no hay API key)
    const { passport, aiSource } = await extractCulturalPassport({
      audioBuffer,
      audioMimeType,
      photoBuffer,
      photoMimeType,
      manualCategory: parsedCategory.success ? parsedCategory.data : "textil",
      manualHintTitle: hintTitle || undefined,
      manualLocality: locality || undefined,
      manualTranscript: manualTranscript || undefined,
    });

    // 2. Calcular SHA-256 del audio crudo y del paquete canónico (cero datos privados en cadena)
    const salaAddress =
      process.env.SALA_PUBLIC_KEY ||
      "GDOCBPHEP3JWETL5DUDNHECK4LUAJDMQFH2B7APBET3CAKSWXM3CTVP6";
    const artisanAddress =
      process.env.ARTESANA_PUBLIC_KEY ||
      "GASRK6WN7ZNDXMUYPWGBL4NHMDVWZRNTPTQ75XFK37B3FH6SVNMVAHMY";

    const audioSha256 = sha256Hex(audioBuffer);
    const canonicalPackageJson = serializeCanonicalPackage({
      v: 1,
      pieceId: parsedId.data,
      audioSha256,
      salaAddress,
      artisanAddress,
      artisanBps: preset.artisanBps,
    });
    const passportHashHex = sha256Hex(canonicalPackageJson);

    // 3. Registrar pieza en Soroban Testnet (o modo preview si falta el Contract ID)
    const chainResult = await registerPieceBridge({
      pieceId: parsedId.data,
      passportHashHex,
      artisanBps: preset.artisanBps,
      salaAddress,
      artisanAddress,
    });

    const record: PieceRecord = {
      id: parsedId.data,
      sorobanSymbol: toSorobanPieceSymbol(parsedId.data),
      createdAt: new Date().toISOString(),
      splitPresetId: preset.id,
      artisanBps: preset.artisanBps,
      salaBps: preset.salaBps,
      salaAddress,
      artisanAddress,
      audioMimeType,
      photoMimeType,
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
      supports: [],
    };

    const saved = await savePieceWithMedia({
      record,
      audioBuffer,
      audioExt,
      photoBuffer,
      photoExt,
    });

    return NextResponse.json({ piece: saved }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error inesperado al sellar la pieza";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
