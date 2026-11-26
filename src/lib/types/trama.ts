import crypto from "node:crypto";
import { z } from "zod";

export const CraftCategorySchema = z.enum([
  "textil",
  "ceramica",
  "cesteria",
  "plateria",
  "madera",
  "otro",
]);

export type CraftCategory = z.infer<typeof CraftCategorySchema>;

/**
 * Salida permitida del pipeline de IA.
 * REGLA ESTRICTA: cero campos financieros, cero direcciones Stellar y cero porcentajes.
 */
export const CulturalPassportSchema = z.object({
  transcriptEs: z.string().min(1).max(2000),
  translations: z.object({
    en: z.string().min(1).max(2200),
    pt: z.string().min(1).max(2200),
  }),
  craftMetadata: z.object({
    title: z.string().min(2).max(120),
    artisanMentionedName: z.string().max(80).nullable(),
    localityOrRegion: z.string().max(120).nullable(),
    category: CraftCategorySchema,
    technique: z.string().max(140).nullable(),
    materials: z.array(z.string().max(60)).max(8),
    estimatedMakingTime: z.string().max(80).nullable(),
  }),
  qualityCheck: z.object({
    isRelevantAudio: z.boolean(),
    audioClarity: z.enum(["high", "medium", "low"]),
    missingCriticalInfo: z.array(z.string().max(100)).max(5),
  }),
});

export type CulturalPassport = z.infer<typeof CulturalPassportSchema>;

export const SplitPresetIdSchema = z.enum([
  "sala_colectiva",
  "taller_compartido",
  "artesano_directo",
  "directo_100",
]);

export type SplitPresetId = z.infer<typeof SplitPresetIdSchema>;

export interface SplitPresetDefinition {
  id: SplitPresetId;
  label: string;
  shortDescription: string;
  artisanRoleLabel: string;
  salaRoleLabel: string;
  artisanBps: number;
  salaBps: number;
  holdArtisanInEscrowDefault: boolean;
}

export const SPLIT_PRESETS: Record<SplitPresetId, SplitPresetDefinition> = {
  sala_colectiva: {
    id: "sala_colectiva",
    label: "Sala Colectiva · Consignación (85 % / 15 %)",
    shortDescription:
      "85 % reservado en contrato Soroban directo para la artesana del interior + 15 % a la asociación que sostiene la sala.",
    artisanRoleLabel: "Artesana autora (custodia Soroban sin intermediarios)",
    salaRoleLabel: "Asociación / Sala del Mercado Artesanal",
    artisanBps: 8500,
    salaBps: 1500,
    holdArtisanInEscrowDefault: true,
  },
  taller_compartido: {
    id: "taller_compartido",
    label: "Taller Familiar / Hilado + Tejido (70 % / 30 %)",
    shortDescription:
      "70 % para quien tejió o modeló la pieza + 30 % para quien preparó fibra, tinte natural o horneado.",
    artisanRoleLabel: "Autora principal de la pieza",
    salaRoleLabel: "Hilado, tintes naturales y taller",
    artisanBps: 7000,
    salaBps: 3000,
    holdArtisanInEscrowDefault: true,
  },
  artesano_directo: {
    id: "artesano_directo",
    label: "Puesto Directo + Fondo Común (95 % / 5 %)",
    shortDescription:
      "95 % directo a quien atiende y produce + 5 % al fondo cultural común de etiquetas y feria.",
    artisanRoleLabel: "Artesano/a creador/a",
    salaRoleLabel: "Fondo común de sala y feria",
    artisanBps: 9500,
    salaBps: 500,
    holdArtisanInEscrowDefault: true,
  },
  directo_100: {
    id: "directo_100",
    label: "100 % Directo a Mano de quien lo hizo",
    shortDescription:
      "El 100 % del pago en USDC queda reservado en el contrato a nombre exclusivo de quien creó la obra.",
    artisanRoleLabel: "Artesano/a creador/a",
    salaRoleLabel: "Sin retención de sala (0 %)",
    artisanBps: 10000,
    salaBps: 0,
    holdArtisanInEscrowDefault: true,
  },
};

export const StellarPublicKeySchema = z
  .string()
  .regex(/^G[A-Z2-7]{55}$/, "Dirección pública Stellar inválida");

export const PieceIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9_-]{1,30}$/,
    "El ID de pieza debe tener entre 2 y 31 caracteres (a-z, 0-9, - o _)"
  );

export const SupportRequestSchema = z.object({
  pieceId: PieceIdSchema,
  amountUsdc: z.number().min(0.5).max(250),
  supporterNote: z.string().max(140).optional(),
});

export const STROOPS_PER_USDC = BigInt(10_000_000);

export interface DeterministicSplitResult {
  totalStroops: bigint;
  artisanStroops: bigint;
  salaStroops: bigint;
  artisanUsdcFormatted: string;
  salaUsdcFormatted: string;
  totalUsdcFormatted: string;
}

export function usdcToStroops(amountUsdc: number): bigint {
  const scaled = Math.round(amountUsdc * 10_000_000);
  if (!Number.isSafeInteger(scaled) || scaled <= 0) {
    throw new Error("Monto USDC fuera de rango válido");
  }
  return BigInt(scaled);
}

export function stroopsToUsdcString(stroops: bigint | string): string {
  const value = typeof stroops === "string" ? BigInt(stroops) : stroops;
  const whole = value / STROOPS_PER_USDC;
  const fraction = value % STROOPS_PER_USDC;
  const fractionStr = fraction.toString().padStart(7, "0").replace(/0+$/, "");
  if (!fractionStr) return `${whole.toString()}.00`;
  return `${whole.toString()}.${fractionStr.length === 1 ? `${fractionStr}0` : fractionStr}`;
}

/**
 * Cálculo 100 % determinístico en enteros (BigInt), idéntico a `split_amount` en `lib.rs`.
 */
export function calculateDeterministicSplit(
  amountUsdc: number,
  artisanBps: number
): DeterministicSplitResult {
  if (!Number.isInteger(artisanBps) || artisanBps < 0 || artisanBps > 10000) {
    throw new Error("artisanBps debe ser un entero entre 0 y 10000");
  }
  const totalStroops = usdcToStroops(amountUsdc);
  const artisanStroops = (totalStroops * BigInt(artisanBps)) / BigInt(10000);
  const salaStroops = totalStroops - artisanStroops;

  return {
    totalStroops,
    artisanStroops,
    salaStroops,
    artisanUsdcFormatted: stroopsToUsdcString(artisanStroops),
    salaUsdcFormatted: stroopsToUsdcString(salaStroops),
    totalUsdcFormatted: stroopsToUsdcString(totalStroops),
  };
}

export interface CanonicalOnChainPackage {
  v: 1;
  pieceId: string;
  audioSha256: string;
  salaAddress: string;
  artisanAddress: string;
  artisanBps: number;
}

/**
 * Construye el JSON canónico con orden fijo de claves y sin datos personales privados
 * (cumpliendo el criterio de privacidad on-chain del evento).
 */
export function serializeCanonicalPackage(pkg: CanonicalOnChainPackage): string {
  return JSON.stringify({
    v: 1,
    pieceId: pkg.pieceId,
    audioSha256: pkg.audioSha256.toLowerCase(),
    salaAddress: pkg.salaAddress,
    artisanAddress: pkg.artisanAddress,
    artisanBps: pkg.artisanBps,
  });
}

export function sha256Hex(input: Buffer | Uint8Array | string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function toSorobanPieceSymbol(pieceId: string): string {
  return pieceId.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 32);
}

export interface SupportReceiptRecord {
  txHash: string;
  pieceId: string;
  createdAt: string;
  amountUsdc: number;
  totalStroops: string;
  artisanStroops: string;
  salaStroops: string;
  heldInContractEscrow: boolean;
  supporterAddress: string;
  contractId: string;
  passportHashHex: string;
  explorerTxUrl: string;
  chainMode: "soroban_testnet" | "preview_local";
  supporterNote?: string;
}

export interface PieceRecord {
  id: string;
  sorobanSymbol: string;
  createdAt: string;
  isDemoSeed?: boolean;
  splitPresetId: SplitPresetId;
  artisanBps: number;
  salaBps: number;
  salaAddress: string;
  artisanAddress: string;
  audioMimeType: string;
  audioFileName?: string;
  photoMimeType?: string;
  photoFileName?: string;
  photoFallbackSvg?: string;
  audioSha256: string;
  canonicalPackageJson: string;
  passportHashHex: string;
  aiSource: "xai_grok" | "meta_ai" | "manual_fallback";
  passport: CulturalPassport;
  registrationTxHash: string;
  contractId: string;
  explorerTxUrl: string;
  explorerContractUrl: string;
  chainMode: "soroban_testnet" | "preview_local";
  supports: SupportReceiptRecord[];
}
