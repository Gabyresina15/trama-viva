"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PieceRecord, SupportReceiptRecord, stroopsToUsdcString } from "@/lib/types/trama";

interface ReceiptApiResponse {
  txHash: string;
  localReceipt: SupportReceiptRecord | null;
  piece: PieceRecord | null;
  liveChain: {
    foundOnTestnet: boolean;
    successful: boolean;
    ledger?: number;
    createdAt?: string;
    sourceAccount?: string;
    explorerTxUrl: string;
  };
  cryptographicProof: {
    recomputedAudioSha256: string | null;
    recomputedPassportHashHex: string | null;
    expectedPassportHashHex: string | null;
    integrityVerified: boolean;
  };
  error?: string;
}

export default function ReceiptVerificationPage() {
  const params = useParams<{ hash: string }>();
  const txHash = params?.hash || "";

  const [data, setData] = useState<ReceiptApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/receipt/${encodeURIComponent(txHash)}`);
        const json = (await res.json()) as ReceiptApiResponse;
        if (active) setData(json);
      } finally {
        if (active) setLoading(false);
      }
    }
    if (txHash) load();
    return () => {
      active = false;
    };
  }, [txHash]);

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-[#6B5B4E]">
        Verificando recibo y recalculando huella SHA-256…
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-3xl border border-[#D8C8B4] bg-[#FBF8F3] p-6 text-center">
          <h1 className="font-serif text-2xl font-semibold text-[#1F1916]">
            Recibo no encontrado
          </h1>
          <p className="mt-2 text-xs text-[#6B5B4E]">
            {data?.error || "No pudimos localizar ese comprobante."}
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full bg-[#A64429] px-5 py-2.5 text-xs font-medium text-white"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const receipt = data.localReceipt;
  const piece = data.piece;
  const artisanUsdc = receipt
    ? stroopsToUsdcString(receipt.artisanStroops)
    : null;
  const salaUsdc = receipt ? stroopsToUsdcString(receipt.salaStroops) : null;
  const totalUsdc = receipt ? stroopsToUsdcString(receipt.totalStroops) : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <div className="rounded-3xl border border-[#2B5B44]/40 bg-[#FBF8F3] p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E9F2EC] px-3 py-1 text-xs font-semibold text-[#1E4432]">
            ✓ Comprobante público verificable
          </span>
          <span className="font-mono text-[11px] text-[#6B5B4E]">
            {data.liveChain.foundOnTestnet
              ? `Ledger #${data.liveChain.ledger} · Stellar Testnet`
              : receipt?.chainMode === "soroban_testnet"
              ? "Stellar Soroban Testnet"
              : "Vista previa local"}
          </span>
        </div>

        <h1 className="mt-4 font-serif text-3xl font-semibold text-[#1F1916]">
          {totalUsdc ? `${totalUsdc} USDC repartidos sin intermediarios` : "Transacción verificada"}
        </h1>

        {piece && (
          <p className="mt-1 text-sm text-[#57493E]">
            Pieza:{" "}
            <Link
              href={`/p/${piece.id}`}
              className="font-semibold text-[#A64429] underline"
            >
              {piece.passport.craftMetadata.title} ({piece.id})
            </Link>
          </p>
        )}

        {/* Desglose atómico */}
        {receipt && (
          <div className="mt-5 space-y-2.5 rounded-2xl border border-[#DFD2C0] bg-white p-4 text-xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#786758]">
              Liquidación ejecutada en una sola transacción
            </p>

            <div className="flex items-start justify-between gap-3 border-b border-[#F2E9DD] pb-2.5">
              <div>
                <p className="font-semibold text-[#1E4432]">
                  Artesana autora ({piece ? Math.round(piece.artisanBps / 100) : 85} %)
                </p>
                <p className="text-[11px] text-[#6B5B4E]">
                  {receipt.heldInContractEscrow
                    ? "Reservado en custodia del contrato Soroban a su nombre exclusivo"
                    : "Transferido directamente a su cuenta"}
                </p>
              </div>
              <span className="font-mono text-sm font-bold text-[#1E4432]">
                {artisanUsdc} USDC
              </span>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#8A5229]">
                  Asociación / Sala ({piece ? Math.round(piece.salaBps / 100) : 15} %)
                </p>
                <p className="text-[11px] text-[#6B5B4E]">
                  Acreditado en el acto en la cuenta de la sala certificadora
                </p>
              </div>
              <span className="font-mono text-sm font-bold text-[#8A5229]">
                {salaUsdc} USDC
              </span>
            </div>
          </div>
        )}

        {/* Prueba criptográfica recalculada en vivo */}
        <div className="mt-4 rounded-2xl border border-[#E3D6C5] bg-[#F5EDE1] p-4 text-xs text-[#4B3E35]">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#1F1916]">
              Integridad de voz y reglas de reparto
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                data.cryptographicProof.integrityVerified
                  ? "bg-[#2B5B44] text-white"
                  : "bg-[#D8C8B4] text-[#2E241E]"
              }`}
            >
              {data.cryptographicProof.integrityVerified
                ? "SHA-256 COINCIDE ✓"
                : "HASH REGISTRADO"}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#645549]">
            Este servidor volvió a leer los bytes originales del archivo de audio y las
            reglas del acuerdo para recalcular su huella digital y compararla con el sello
            inmutable de la pieza.
          </p>
          {data.cryptographicProof.recomputedPassportHashHex && (
            <p className="mt-2 font-mono text-[10px] break-all text-[#57493E]">
              Hash recalculado: {data.cryptographicProof.recomputedPassportHashHex}
            </p>
          )}
          <p className="mt-1 font-mono text-[10px] break-all text-[#57493E]">
            Tx Hash: {data.txHash}
          </p>
          {receipt?.contractId && (
            <p className="mt-1 font-mono text-[10px] break-all text-[#57493E]">
              Contrato Soroban: {receipt.contractId}
            </p>
          )}
        </div>

        {/* Acciones de verificación externa y demo de retiro */}
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <a
            href={data.liveChain.explorerTxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-full bg-[#1F1916] px-5 py-3.5 text-center text-xs font-semibold text-white transition hover:bg-[#382E28]"
          >
            Auditar transacción y eventos en Stellar Expert ↗
          </a>
          <Link
            href="/artesana"
            className="rounded-full border border-[#2B5B44] bg-[#E9F2EC] px-5 py-3.5 text-center text-xs font-semibold text-[#1E4432] transition hover:bg-[#D8E9DE]"
          >
            Demostrar retiro de la artesana →
          </Link>
        </div>
      </div>
    </div>
  );
}
