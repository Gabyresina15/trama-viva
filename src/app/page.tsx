import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { listPieces } from "@/lib/store/pieces-store";

const FIELD_STICKER_IDS = [
  "pieza-01",
  "pieza-02",
  "pieza-03",
  "pieza-04",
  "pieza-05",
  "pieza-06",
];

async function HomeCatalogSection() {
  await connection();
  const pieces = await listPieces();
  const recordedIds = new Set(pieces.map((p) => p.id));
  const contractId =
    process.env.NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID?.trim() || "";
  const explorerBase =
    process.env.NEXT_PUBLIC_EXPLORER_BASE ||
    "https://stellar.expert/explorer/testnet";

  return (
    <>
      {/* Estado On-Chain transparente */}
      <div className="mt-6 rounded-2xl border border-[#E3D6C5] bg-[#F5EDE1] p-3.5 text-xs text-[#5B4C40]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">
            {contractId ? (
              <span className="inline-flex items-center gap-1.5 text-[#23533D]">
                <span className="h-2 w-2 rounded-full bg-[#2B6B4F]" />
                Contrato Soroban activo en Stellar Testnet
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[#8A5229]">
                <span className="h-2 w-2 rounded-full bg-[#C87A3E]" />
                Modo vista previa local (esperando Contract ID en .env.local)
              </span>
            )}
          </span>
          {contractId && (
            <a
              href={`${explorerBase}/contract/${contractId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] underline decoration-[#A64429]/50 underline-offset-2 hover:text-[#A64429]"
            >
              Contrato {contractId.slice(0, 6)}…{contractId.slice(-6)} ↗
            </a>
          )}
        </div>
      </div>

      {/* Grilla rápida de etiquetas físicas de campo (pieza-01 a pieza-06) */}
      <section className="mt-8 rounded-3xl border border-[#DED2C2] bg-[#FBF8F3] p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-2xl font-semibold text-[#1F1916]">
            Etiquetas de Prueba en Campo · Mercado Artesanal
          </h2>
          <span className="text-xs text-[#786758]">
            Tocá una etiqueta libre para grabarla en el puesto
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {FIELD_STICKER_IDS.map((stickerId) => {
            const isRecorded = recordedIds.has(stickerId);
            return (
              <Link
                key={stickerId}
                href={isRecorded ? `/p/${stickerId}` : `/crear?id=${stickerId}`}
                className={`flex items-center justify-between rounded-2xl border px-3.5 py-3 text-xs font-medium transition ${
                  isRecorded
                    ? "border-[#2B5B44]/35 bg-[#E9F2EC] text-[#1E4432] hover:border-[#2B5B44]"
                    : "border-[#D8C8B4] bg-white text-[#57493E] hover:border-[#A64429] hover:text-[#A64429]"
                }`}
              >
                <span className="font-mono">{stickerId}</span>
                <span className="text-[11px]">
                  {isRecorded ? "Activa ✓" : "Grabar +"}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Catálogo vivo de piezas */}
      <section className="mt-8">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl font-semibold text-[#1F1916]">
            Piezas con relato oral ({pieces.length})
          </h2>
          <span className="text-xs text-[#786758]">
            Escaneables sin wallet instalada
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {pieces.map((piece) => {
            const imgSrc = piece.photoFileName
              ? `/api/pieces/${piece.id}/media?kind=photo`
              : piece.photoFallbackSvg;

            return (
              <Link
                key={piece.id}
                href={`/p/${piece.id}`}
                className="group overflow-hidden rounded-3xl border border-[#D8C8B4] bg-[#FBF8F3] shadow-sm transition hover:-translate-y-0.5 hover:border-[#A64429]"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#2A201B]">
                  {imgSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgSrc}
                      alt={piece.passport.craftMetadata.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-serif text-lg text-[#E6D7C5]">
                      {piece.passport.craftMetadata.title}
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className="rounded-full bg-[#1F1916]/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#F6F0E6] backdrop-blur-sm">
                      {piece.id}
                    </span>
                    {piece.isDemoSeed && (
                      <span className="rounded-full bg-[#A64429]/90 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                        Muestra Demo
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#8C5B3E]">
                    {piece.passport.craftMetadata.localityOrRegion || "Salta, Argentina"}
                  </p>
                  <h3 className="mt-1 font-serif text-xl font-semibold leading-snug text-[#1F1916] group-hover:text-[#A64429]">
                    {piece.passport.craftMetadata.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#645549]">
                    “{piece.passport.transcriptEs}”
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-[#E6DACB] pt-2.5 text-[11px] text-[#6B5B4E]">
                    <span>
                      Reparto: {Math.round(piece.artisanBps / 100)} % autora ·{" "}
                      {Math.round(piece.salaBps / 100)} % sala
                    </span>
                    <span className="font-medium text-[#A64429]">
                      Escuchar voz →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      {/* Hero Editorial */}
      <section className="rounded-3xl border border-[#D8C8B4] bg-[#FBF8F3] p-6 shadow-sm sm:p-9">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#D8C8B4] bg-[#EFE6D8] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#6E5B4B]">
          <span className="h-2 w-2 rounded-full bg-[#A64429]" />
          Memoria · Arte · Territorio · Salta
        </div>

        <h1 className="mt-4 font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-[#1F1916] sm:text-5xl">
          La voz viva de quien lo hizo, y un pago directo a su mano.
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#57493E]">
          Cuando una artesanía viaja desde un taller de los Valles Calchaquíes o la Puna
          hasta una sala colectiva en Salta Capital, la historia de su creadora suele perderse
          en el mostrador. <strong>Trama Viva</strong> une una grabación oral de 20 segundos con
          liquidación atómica en <strong>USDC sobre Stellar Soroban</strong>, reservando la parte de
          la artesana aunque todavía no tenga billetera activa.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/crear"
            className="inline-flex items-center justify-center rounded-full bg-[#A64429] px-6 py-3 text-sm font-medium text-[#FDF9F3] shadow-sm transition hover:bg-[#8C361E]"
          >
            Grabar historia de una pieza →
          </Link>
          <Link
            href="/p/pieza-demo-telar"
            className="inline-flex items-center justify-center rounded-full border border-[#CBB8A1] bg-white px-6 py-3 text-sm font-medium text-[#2E241E] transition hover:border-[#A64429] hover:text-[#A64429]"
          >
            Escuchar pieza de muestra
          </Link>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="mt-8 rounded-3xl border border-[#DED2C2] bg-[#FBF8F3] p-6 text-center text-xs text-[#786758]">
            Cargando catálogo de piezas y estado en Stellar Testnet…
          </div>
        }
      >
        <HomeCatalogSection />
      </Suspense>
    </div>
  );
}
