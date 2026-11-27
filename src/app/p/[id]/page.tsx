"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import type { PieceRecord, SupportReceiptRecord } from "@/lib/types/trama";
import { LANGUAGE_OPTIONS, UI_COPY, type Language } from "./ui-copy";

const AMOUNT_OPTIONS = [2, 5, 10];

type PieceLookup =
  | { status: "loading" | "unlinked" | "error" }
  | { status: "ready"; piece: PieceRecord };

function PieceStatus({ children }: { children: string }) {
  return (
    <p role="status" className="px-4 py-16 text-center text-sm text-[#5B4C40]">
      {children}
    </p>
  );
}

function PiecePublicRoute({ lang }: { lang: Language }) {
  const { id } = useParams<{ id: string }>();
  const pieceId = id.toLowerCase();
  return <PiecePublicInner key={pieceId} pieceId={pieceId} lang={lang} />;
}

function PiecePublicInner({ pieceId, lang }: { pieceId: string; lang: Language }) {
  const router = useRouter();
  const copy = UI_COPY[lang];
  const [lookup, setLookup] = useState<PieceLookup>({ status: "loading" });
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [giftCopied, setGiftCopied] = useState(false);

  const [selectedAmount, setSelectedAmount] = useState<number>(5);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/pieces/${encodeURIComponent(pieceId)}`, { signal: controller.signal })
      .then<PieceLookup>(async (res) => {
        if (res.status === 404) return { status: "unlinked" };
        if (!res.ok) return { status: "error" };
        const { piece } = (await res.json()) as { piece?: PieceRecord };
        return piece ? { status: "ready", piece } : { status: "error" };
      })
      .then((result) => {
        if (!controller.signal.aborted) setLookup(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLookup({ status: "error" });
      });
    return () => controller.abort();
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
    if (lookup.status !== "ready") return;
    setPaying(true);
    setPayError(false);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pieceId: lookup.piece.id,
          amountUsdc: selectedAmount,
        }),
      });
      const data = (await res.json()) as {
        receipt?: SupportReceiptRecord;
        error?: string;
      };
      if (!res.ok || !data.receipt) {
        setPayError(true);
        setPaying(false);
        return;
      }
      router.push(`/r/${data.receipt.txHash}`);
    } catch {
      setPayError(true);
      setPaying(false);
    }
  }

  async function shareGift() {
    if (lookup.status !== "ready") return;
    setGiftCopied(false);
    const url = new URL(`/p/${encodeURIComponent(lookup.piece.id)}`, window.location.origin).href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: lookup.piece.passport.craftMetadata.title,
          text: copy.giftMessage,
          url,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    const message = `${copy.giftMessage} ${url}`;
    try {
      await navigator.clipboard.writeText(message);
      setGiftCopied(true);
    } catch {
      window.location.assign(`https://wa.me/?text=${encodeURIComponent(message)}`);
    }
  }

  if (lookup.status === "loading") return <PieceStatus>{copy.loading}</PieceStatus>;

  // Si un artesano o compañero escanea una etiqueta física virgen (ej. pieza-01) en el puesto,
  // le ofrece vincularla en 1 toque sin mostrar error roto.
  if (lookup.status === "unlinked") {
    return (
      <div className="mx-auto max-w-lg">
        <div className="rounded-3xl border border-[#D8C8B4] bg-[#FBF8F3] p-7 text-center shadow-sm">
          <span className="rounded-full bg-[#EFE6D8] px-3 py-1 font-mono text-xs text-[#5B4C40]">
            {copy.tag(pieceId)}
          </span>
          <h1 className="mt-4 font-serif text-3xl font-semibold text-[#1F1916]">
            {copy.unlinkedTitle}
          </h1>
          <p className="mt-2 text-sm text-[#645549]">
            {copy.unlinkedDescription}
          </p>
          <Link
            href={`/crear?id=${encodeURIComponent(pieceId)}`}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#A64429] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8C361E]"
          >
            {copy.recordVoice(pieceId)}
          </Link>
        </div>
      </div>
    );
  }

  if (lookup.status !== "ready") return <PieceStatus>{copy.loadError}</PieceStatus>;

  const { piece } = lookup;
  const { craftMetadata } = piece.passport;
  const splitRoles = copy.splitRoles[piece.splitPresetId] || copy.splitRoles.sala_colectiva;
  const artisanPct = Math.round(piece.artisanBps / 100);
  const salaPct = Math.round(piece.salaBps / 100);
  const artisanSharePreview = ((selectedAmount * piece.artisanBps) / 10000).toFixed(2);
  const salaSharePreview = (selectedAmount - Number(artisanSharePreview)).toFixed(2);

  const imgSrc = piece.photoFileName
    ? `/api/pieces/${piece.id}/media?kind=photo`
    : piece.photoFallbackSvg;
  const audioSrc = `/api/pieces/${piece.id}/media?kind=audio`;

  const displayedCaption =
    lang === "es" ? piece.passport.transcriptEs : piece.passport.translations[lang];

  return (
    <article className="overflow-hidden rounded-3xl border border-[#D8C8B4] bg-[#FBF8F3] shadow-sm">
      {/* Imagen principal */}
      <div className="relative aspect-[4/3] w-full bg-[#241B16]">
        {imgSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={craftMetadata.title}
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#19120E]/90 via-[#19120E]/45 to-transparent p-5 pt-14 text-[#FDF9F3]">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-[#E6D3BF]">
            <span>
              {craftMetadata.localityOrRegion || "Salta, Argentina"}
            </span>
            {piece.isDemoSeed && (
              <span className="rounded-full bg-[#A64429] px-2 py-0.5 text-[10px] font-semibold text-white">
                {copy.demoBadge}
              </span>
            )}
          </div>
          <h1 lang="es" className="mt-1 font-serif text-3xl font-semibold leading-tight">
            {craftMetadata.title}
          </h1>
          {craftMetadata.artisanMentionedName && (
            <p className="mt-0.5 text-xs text-[#E8DACB]">
              {copy.createdBy(craftMetadata.artisanMentionedName)}
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
              aria-label={isPlaying ? copy.pauseVoice : copy.playVoice}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#1F1916]">
                {copy.voiceTitle}
              </p>
              <p className="text-xs text-[#5B4C40]">
                {copy.voiceDescription}
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
            lang="es"
            className="hidden"
          />

          <div className="mt-4 border-t border-[#EFE6D8] pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5B4C40]">
              {copy.captions}
            </p>

            <p className="mt-2.5 text-sm leading-relaxed text-[#2E241E] italic">
              “{displayedCaption}”
            </p>
            {lang !== "es" && (
              <p className="mt-1 text-xs text-[#5B4C40]">
                {copy.translationNote}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={shareGift}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#A64429] bg-[#F6EFE4] px-4 py-2.5 text-sm font-semibold text-[#78311F] transition hover:bg-[#EFE6D8]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5 shrink-0"
          >
            <rect x="3" y="8" width="18" height="4" rx="1" />
            <path d="M5 12v8h14v-8M12 8v12M12 8H8.5a2.5 2.5 0 1 1 2.4-3.2L12 8Zm0 0h3.5a2.5 2.5 0 1 0-2.4-3.2L12 8Z" />
          </svg>
          <span>{copy.shareGift}</span>
        </button>
        <div role="status" className="text-center text-xs text-[#5B4C40]">
          {giftCopied && <p className="mt-2">{copy.giftCopied}</p>}
        </div>

        {/* Ficha cultural extraída */}
        {(craftMetadata.technique || craftMetadata.materials.length > 0 ||
          craftMetadata.estimatedMakingTime) && (
          <dl className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
            {craftMetadata.technique && (
              <div className="rounded-2xl border border-[#E5D9C8] bg-[#F6EFE4] p-3">
                <dt className="font-semibold uppercase tracking-wider text-[#5B4C40]">
                  {copy.technique}
                </dt>
                <dd lang="es" className="mt-0.5 font-medium text-[#2E241E]">
                  {craftMetadata.technique}
                </dd>
              </div>
            )}
            {craftMetadata.estimatedMakingTime && (
              <div className="rounded-2xl border border-[#E5D9C8] bg-[#F6EFE4] p-3">
                <dt className="font-semibold uppercase tracking-wider text-[#5B4C40]">
                  {copy.makingTime}
                </dt>
                <dd lang="es" className="mt-0.5 font-medium text-[#2E241E]">
                  {craftMetadata.estimatedMakingTime}
                </dd>
              </div>
            )}
            {craftMetadata.materials.length > 0 && (
              <div className="col-span-2 rounded-2xl border border-[#E5D9C8] bg-[#F6EFE4] p-3">
                <dt className="font-semibold uppercase tracking-wider text-[#5B4C40]">
                  {copy.materials}
                </dt>
                <dd lang="es" className="mt-1.5">
                  <ul className="flex flex-wrap gap-1.5">
                    {craftMetadata.materials.map((material, index) => (
                      <li key={`${material}-${index}`} className="rounded-full bg-[#E9DAC5] px-3 py-1 font-medium text-[#2E241E]">
                        {material}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        )}

        {/* Bloque de Pago / Reconocimiento directo sin intermediarios */}
        <div className="mt-6 rounded-3xl border border-[#D5C3AD] bg-[#F4ECE0] p-5">
          <h2 className="font-serif text-2xl font-semibold text-[#1F1916]">
            {copy.supportTitle}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[#5B4C40]">
            {copy.supportDescription}
          </p>

          {/* Montos rápidos */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {AMOUNT_OPTIONS.map((amt) => (
              <button
                key={amt}
                type="button"
                aria-pressed={selectedAmount === amt}
                onClick={() => setSelectedAmount(amt)}
                className={`min-h-12 rounded-2xl border py-3 text-center text-sm font-semibold transition ${
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

            <div className="mt-2.5 space-y-1 text-xs text-[#4B3E35]">
              <div className="flex justify-between gap-2">
                <span>
                  <strong className="text-[#1E4432]">{artisanPct} %</strong> ·{" "}
                  {splitRoles.artisan}
                </span>
                <span className="shrink-0 font-mono font-semibold text-[#1E4432]">
                  {artisanSharePreview} USDC
                </span>
              </div>
              {salaPct > 0 && (
                <div className="flex justify-between gap-2">
                  <span>
                    <strong className="text-[#8A5229]">{salaPct} %</strong> ·{" "}
                    {splitRoles.sala}
                  </span>
                  <span className="shrink-0 font-mono font-semibold text-[#8A5229]">
                    {salaSharePreview} USDC
                  </span>
                </div>
              )}
            </div>
          </div>

          {payError && (
            <div role="alert" className="mt-3 rounded-xl border border-[#C94A38]/40 bg-[#FDF0ED] p-3 text-xs text-[#8E2B1D]">
              {copy.supportError}
            </div>
          )}

          <button
            type="button"
            onClick={handleSupport}
            disabled={paying}
            className="mt-4 min-h-12 w-full rounded-full bg-[#1F1916] px-6 py-4 text-sm font-semibold text-[#FDF9F3] shadow-sm transition hover:bg-[#382E28] disabled:opacity-60"
          >
            {paying ? copy.sending : copy.send(selectedAmount)}
          </button>

          <p className="mt-2 text-center text-xs text-[#5B4C40]">
            {copy.testnetNotice}
          </p>
        </div>

        {/* Pie de autenticidad pública */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-2 border-t border-[#E6DACB] pt-3 text-xs text-[#5B4C40]">
          <span className="font-mono">
            {copy.seal} {piece.passportHashHex.slice(0, 10)}…
            {piece.passportHashHex.slice(-8)}
          </span>
          {piece.explorerContractUrl && (
            <a
              href={piece.explorerContractUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center font-semibold text-[#78311F] underline"
            >
              {copy.audit}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function PiecePublicPage() {
  const [lang, setLang] = useState<Language>("es");
  const copy = UI_COPY[lang];

  return (
    <div lang={lang} className="mx-auto max-w-xl px-4 py-6 sm:py-10">
      <div role="group" aria-label={copy.language} className="mb-3 flex flex-wrap gap-1.5">
        {LANGUAGE_OPTIONS.map((option) => (
          <button
            key={option.id}
            lang={option.id}
            type="button"
            aria-pressed={lang === option.id}
            onClick={() => setLang(option.id)}
            className={`min-h-12 rounded-full border border-[#A79687] px-3 text-xs font-semibold transition ${
              lang === option.id
                ? "border-[#1F1916] bg-[#1F1916] text-white"
                : "bg-[#FBF8F3] text-[#3D2E24] hover:bg-[#EFE6D8]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <Suspense fallback={<PieceStatus>{copy.loading}</PieceStatus>}>
        <PiecePublicRoute lang={lang} />
      </Suspense>
    </div>
  );
}
