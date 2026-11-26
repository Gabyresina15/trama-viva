"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  PieceRecord,
  SPLIT_PRESETS,
  SupportReceiptRecord,
} from "@/lib/types/trama";

type LangTab = "es" | "en" | "pt";

const AMOUNT_OPTIONS = [2, 5, 10];

function PiecePublicInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pieceId = (params?.id || "").toLowerCase();

  const [piece, setPiece] = useState<PieceRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const [lang, setLang] = useState<LangTab>("es");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [selectedAmount, setSelectedAmount] = useState<number>(5);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/pieces/${encodeURIComponent(pieceId)}`);
        if (res.status === 404) {
          if (active) setNotFound(true);
          return;
        }
        const data = (await res.json()) as { piece?: PieceRecord };
        if (active && data.piece) {
          setPiece(data.piece);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    if (pieceId) load();
    return () => {
      active = false;
    };
  }, [pieceId]);

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }

  async function handleSupport() {
    if (!piece) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pieceId: piece.id,
          amountUsdc: selectedAmount,
        }),
      });
      const data = (await res.json()) as {
        receipt?: SupportReceiptRecord;
        error?: string;
      };
      if (!res.ok || !data.receipt) {
        throw new Error(data.error || "No se pudo completar el envío");
      }
      router.push(`/r/${data.receipt.txHash}`);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Error inesperado");
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-[#6B5B4E]">
        Cargando relato de la pieza…
      </div>
    );
  }

  // Si un artesano o compañero escanea una etiqueta física virgen (ej. pieza-01) en el puesto,
  // le ofrece vincularla en 1 toque sin mostrar error roto.
  if (notFound || !piece) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-3xl border border-[#D8C8B4] bg-[#FBF8F3] p-7 text-center shadow-sm">
          <span className="rounded-full bg-[#EFE6D8] px-3 py-1 font-mono text-xs text-[#5B4C40]">
            Etiqueta {pieceId}
          </span>
          <h1 className="mt-4 font-serif text-3xl font-semibold text-[#1F1916]">
            Esta etiqueta está libre para vincular una pieza
          </h1>
          <p className="mt-2 text-sm text-[#645549]">
            Sacale una foto a la artesanía y grabá 20 segundos con la voz de quien
            la creó para activar este código QR.
          </p>
          <Link
            href={`/crear?id=${encodeURIComponent(pieceId)}`}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#A64429] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8C361E]"
          >
            Grabar la voz de {pieceId} ahora →
          </Link>
        </div>
      </div>
    );
  }

  const preset = SPLIT_PRESETS[piece.splitPresetId] || SPLIT_PRESETS.sala_colectiva;
  const artisanPct = Math.round(piece.artisanBps / 100);
  const salaPct = Math.round(piece.salaBps / 100);
  const artisanSharePreview = ((selectedAmount * piece.artisanBps) / 10000).toFixed(2);
  const salaSharePreview = (selectedAmount - Number(artisanSharePreview)).toFixed(2);

  const imgSrc = piece.photoFileName
    ? `/api/pieces/${piece.id}/media?kind=photo`
    : piece.photoFallbackSvg;
  const audioSrc = `/api/pieces/${piece.id}/media?kind=audio`;

  const displayedCaption =
    lang === "es"
      ? piece.passport.transcriptEs
      : lang === "en"
      ? piece.passport.translations.en
      : piece.passport.translations.pt;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:py-10">
      <article className="overflow-hidden rounded-3xl border border-[#D8C8B4] bg-[#FBF8F3] shadow-sm">
        {/* Imagen principal */}
        <div className="relative aspect-[4/3] w-full bg-[#241B16]">
          {imgSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={piece.passport.craftMetadata.title}
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#19120E]/90 via-[#19120E]/45 to-transparent p-5 pt-14 text-[#FDF9F3]">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-[#E6D3BF]">
              <span>
                {piece.passport.craftMetadata.localityOrRegion || "Salta, Argentina"}
              </span>
              {piece.isDemoSeed && (
                <span className="rounded-full bg-[#A64429] px-2 py-0.5 text-[10px] font-semibold text-white">
                  Demo Testnet
                </span>
              )}
            </div>
            <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight">
              {piece.passport.craftMetadata.title}
            </h1>
            {piece.passport.craftMetadata.artisanMentionedName && (
              <p className="mt-0.5 text-xs text-[#E8DACB]">
                Creada por {piece.passport.craftMetadata.artisanMentionedName}
              </p>
            )}
          </div>
        </div>

        <div className="p-5 sm:p-7">
          {/* Reproductor de Voz Viva */}
          <div className="rounded-2xl border border-[#DECFC0] bg-white p-4 shadow-xs">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#A64429] text-lg text-white shadow-sm transition hover:bg-[#8C361E]"
                aria-label={isPlaying ? "Pausar voz" : "Escuchar voz"}
              >
                {isPlaying ? "❚❚" : "▶"}
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#1F1916]">
                  Escuchá la voz original de quien la hizo
                </p>
                <p className="text-[11px] text-[#786758]">
                  Grabación auténtica sellada con fecha y huella digital
                </p>
                <div className="mt-2 flex h-4 items-end gap-1">
                  {[0.5, 0.9, 0.65, 1, 0.75, 0.45, 0.85, 0.6, 0.95, 0.5, 0.8, 0.6].map(
                    (h, idx) => (
                      <span
                        key={idx}
                        style={{
                          height: `${Math.round(h * 16)}px`,
                          animationDelay: `${idx * 70}ms`,
                        }}
                        className={`w-1.5 rounded-full bg-[#A64429]/75 ${
                          isPlaying ? "voice-bar-active" : "opacity-45"
                        }`}
                      />
                    )
                  )}
                </div>
              </div>
            </div>

            <audio
              ref={audioRef}
              src={audioSrc}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              preload="metadata"
              className="hidden"
            />

            {/* Selector de subtítulos multilingüe para turistas */}
            <div className="mt-4 border-t border-[#EFE6D8] pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#786758]">
                  Relato / Subtítulos
                </span>
                <div className="inline-flex rounded-full border border-[#DED2C2] bg-[#F6F0E6] p-0.5 text-[11px] font-medium">
                  {(
                    [
                      { id: "es", label: "ES · Original" },
                      { id: "en", label: "EN · English" },
                      { id: "pt", label: "PT · Português" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setLang(tab.id)}
                      className={`rounded-full px-2.5 py-1 transition ${
                        lang === tab.id
                          ? "bg-[#1F1916] text-white"
                          : "text-[#5B4C40] hover:text-[#1F1916]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="mt-2.5 text-sm leading-relaxed text-[#2E241E] italic">
                “{displayedCaption}”
              </p>
              {lang !== "es" && (
                <p className="mt-1 text-[10px] text-[#857363]">
                  Traducción automática a partir de la voz original en español.
                </p>
              )}
            </div>
          </div>

          {/* Ficha cultural extraída */}
          {(piece.passport.craftMetadata.technique ||
            piece.passport.craftMetadata.materials.length > 0 ||
            piece.passport.craftMetadata.estimatedMakingTime) && (
            <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
              {piece.passport.craftMetadata.technique && (
                <div className="rounded-2xl border border-[#E5D9C8] bg-[#F6EFE4] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#7D6C5E]">
                    Técnica
                  </p>
                  <p className="mt-0.5 font-medium text-[#2E241E]">
                    {piece.passport.craftMetadata.technique}
                  </p>
                </div>
              )}
              {piece.passport.craftMetadata.estimatedMakingTime && (
                <div className="rounded-2xl border border-[#E5D9C8] bg-[#F6EFE4] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#7D6C5E]">
                    Tiempo de labor
                  </p>
                  <p className="mt-0.5 font-medium text-[#2E241E]">
                    {piece.passport.craftMetadata.estimatedMakingTime}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Bloque de Pago / Reconocimiento directo sin intermediarios */}
          <div className="mt-6 rounded-3xl border border-[#D5C3AD] bg-[#F4ECE0] p-5">
            <h2 className="font-serif text-2xl font-semibold text-[#1F1916]">
              Enviar reconocimiento directo en dólares digitales
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#5B4C40]">
              Sin cuentas bancarias locales ni intermediarios que retengan la plata:
              una sola operación reparte al instante y deja comprobante público.
            </p>

            {/* Montos rápidos */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {AMOUNT_OPTIONS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setSelectedAmount(amt)}
                  className={`rounded-2xl border py-3 text-center text-sm font-semibold transition ${
                    selectedAmount === amt
                      ? "border-[#A64429] bg-[#A64429] text-white shadow-xs"
                      : "border-[#D5C3AD] bg-white text-[#2E241E] hover:border-[#A64429]"
                  }`}
                >
                  {amt} USDC
                </button>
              ))}
            </div>

            {/* Barra transparente de reparto */}
            <div className="mt-4 rounded-2xl bg-white p-3.5 text-xs">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#E6DACB]">
                <div
                  style={{ width: `${artisanPct}%` }}
                  className="bg-[#2B5B44]"
                />
                {salaPct > 0 && (
                  <div
                    style={{ width: `${salaPct}%` }}
                    className="bg-[#C87A3E]"
                  />
                )}
              </div>

              <div className="mt-2.5 space-y-1 text-[11px] text-[#4B3E35]">
                <div className="flex justify-between">
                  <span>
                    <strong className="text-[#1E4432]">{artisanPct} %</strong> ·{" "}
                    {preset.artisanRoleLabel}
                  </span>
                  <span className="font-mono font-semibold text-[#1E4432]">
                    {artisanSharePreview} USDC
                  </span>
                </div>
                {salaPct > 0 && (
                  <div className="flex justify-between">
                    <span>
                      <strong className="text-[#8A5229]">{salaPct} %</strong> ·{" "}
                      {preset.salaRoleLabel}
                    </span>
                    <span className="font-mono font-semibold text-[#8A5229]">
                      {salaSharePreview} USDC
                    </span>
                  </div>
                )}
              </div>
            </div>

            {payError && (
              <div className="mt-3 rounded-xl border border-[#C94A38]/40 bg-[#FDF0ED] p-3 text-xs text-[#8E2B1D]">
                {payError}
              </div>
            )}

            <button
              type="button"
              onClick={handleSupport}
              disabled={paying}
              className="mt-4 w-full rounded-full bg-[#1F1916] px-6 py-4 text-sm font-semibold text-[#FDF9F3] shadow-sm transition hover:bg-[#382E28] disabled:opacity-60"
            >
              {paying
                ? "Liquidando reparto en Stellar…"
                : `Enviar ${selectedAmount} USDC directo →`}
            </button>

            <p className="mt-2 text-center text-[11px] text-[#786758]">
              Demostración gratuita en Stellar Testnet (sin cargos ni billetera previa).
            </p>
          </div>

          {/* Pie de autenticidad pública */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#E6DACB] pt-3 text-[11px] text-[#786758]">
            <span className="font-mono">
              Sello SHA-256: {piece.passportHashHex.slice(0, 10)}…
              {piece.passportHashHex.slice(-8)}
            </span>
            {piece.explorerContractUrl && (
              <a
                href={piece.explorerContractUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#A64429] underline"
              >
                Auditar contrato en Stellar Expert ↗
              </a>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

export default function PiecePublicPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-[#6B5B4E]">
          Cargando relato de la pieza…
        </div>
      }
    >
      <PiecePublicInner />
    </Suspense>
  );
}
