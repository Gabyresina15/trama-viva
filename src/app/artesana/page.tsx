"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface PendingStatus {
  artisanAddress: string;
  contractId: string;
  pendingStroops: string;
  pendingUsdcFormatted: string;
  chainMode: "soroban_testnet" | "preview_local";
}

interface ClaimResult {
  txHash: string;
  claimedStroops: string;
  claimedUsdcFormatted: string;
  artisanAddress: string;
  explorerTxUrl: string;
  chainMode: "soroban_testnet" | "preview_local";
}

export default function ArtesanaClaimPage() {
  const [status, setStatus] = useState<PendingStatus | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClaimResult | null>(null);

  async function refreshPendingBalance() {
    setLoadingBalance(true);
    try {
      const res = await fetch("/api/claim", { cache: "no-store" });
      const data = (await res.json()) as { status?: PendingStatus };
      if (data.status) setStatus(data.status);
    } finally {
      setLoadingBalance(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/claim", { cache: "no-store" })
      .then((res) => res.json() as Promise<{ status?: PendingStatus }>)
      .then((data) => {
        if (active && data.status) setStatus(data.status);
      })
      .finally(() => {
        if (active) setLoadingBalance(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleClaim() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/claim", { method: "POST" });
      const data = (await res.json()) as { claim?: ClaimResult; error?: string };
      if (!res.ok || !data.claim) {
        throw new Error(data.error || "No se pudo ejecutar el retiro");
      }
      setResult(data.claim);
      await refreshPendingBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <div className="rounded-3xl border border-[#D8C8B4] bg-[#FBF8F3] p-6 shadow-sm sm:p-8">
        <span className="inline-block rounded-full bg-[#EFE6D8] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-[#6E5B4B]">
          Custodia sin intermediarios · Soroban
        </span>

        <h1 className="mt-3 font-serif text-3xl font-semibold text-[#1F1916]">
          Retiro directo para la artesana
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-[#5B4C40]">
          Cuando un turista compra o envía reconocimiento a una pieza en consignación, el{" "}
          <strong>contrato inteligente Soroban</strong> resguarda el porcentaje de la
          autora en su propio balance (nunca pasa por la cuenta bancaria del local ni de
          terceros).
        </p>

        {/* Tarjeta en vivo del saldo custodiado en el contrato CDK6... */}
        <div className="mt-5 rounded-2xl border border-[#2B5B44]/30 bg-[#EBF4EE] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#2B5B44]">
            Saldo custodiado hoy en el contrato Soroban
          </p>
          <p className="mt-1 font-serif text-4xl font-semibold text-[#1E4432]">
            {loadingBalance
              ? "Consultando red…"
              : `${status?.pendingUsdcFormatted || "0.00"} USDC`}
          </p>
          {status?.artisanAddress && (
            <p className="mt-1.5 font-mono text-[10px] break-all text-[#3B5E4C]">
              Beneficiaria exclusiva: {status.artisanAddress}
            </p>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-[#E3D6C5] bg-[#F5EDE1] p-4 text-xs text-[#57493E]">
          <p className="font-medium text-[#2E241E]">Qué ejecuta este botón en Stellar:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              Verifica que la cuenta de la artesana pueda recibir USDC (y si falta su
              trustline, la abre patrocinando la reserva).
            </li>
            <li>
              Invoca <code>TramaVivaContract.claim(artesana)</code> con su autorización{" "}
              <code>require_auth()</code>.
            </li>
            <li>
              Transfiere el 100 % de sus USDC custodiados en el contrato directo a su mano.
            </li>
          </ol>
        </div>

        <button
          type="button"
          onClick={handleClaim}
          disabled={
            loading ||
            loadingBalance ||
            (status !== null && status.pendingStroops === "0")
          }
          className="mt-6 w-full rounded-full bg-[#2B5B44] px-6 py-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#214735] disabled:opacity-50"
        >
          {loading
            ? "Firmando y retirando desde el contrato Soroban…"
            : status?.pendingStroops === "0"
            ? "Sin saldo pendiente por retirar (0.00 USDC)"
            : `Retirar ${status?.pendingUsdcFormatted || ""} USDC a mi cuenta`}
        </button>

        {error && (
          <div className="mt-4 rounded-2xl border border-[#C94A38]/40 bg-[#FDF0ED] p-3.5 text-xs text-[#8E2B1D]">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 rounded-2xl border border-[#2B5B44]/35 bg-white p-4 text-xs text-[#1E4432]">
            <p className="text-sm font-semibold">
              ✓ Retiro completado: {result.claimedUsdcFormatted} USDC
            </p>
            <p className="mt-1 font-mono text-[11px] break-all">
              Hash Tx: {result.txHash}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a
                href={result.explorerTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full bg-[#2B5B44] px-3.5 py-1.5 text-[11px] font-medium text-white"
              >
                Ver evento claim en Stellar Expert ↗
              </a>
              <Link
                href="/"
                className="inline-flex items-center rounded-full border border-[#2B5B44]/40 px-3.5 py-1.5 text-[11px] font-medium text-[#1E4432]"
              >
                Volver al inicio
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
