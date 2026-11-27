import type { Metadata } from "next";
import Link from "next/link";
import { QrCodeSvg } from "@/components/QrCodeSvg";
import { PrintButton } from "./PrintButton";

const PRODUCTION_BASE_URL = "https://trama-viva-cjwf.vercel.app";

const LABEL_IDS = [
  "pieza-01",
  "pieza-02",
  "pieza-03",
  "pieza-04",
  "pieza-05",
  "pieza-06",
] as const;

export const metadata: Metadata = {
  title: "Etiquetas QR A4 · Trama Viva Salta",
  description:
    "Plancha A4 imprimible con 6 etiquetas colgantes QR (pieza-01 a pieza-06) para el Mercado Artesanal de Salta.",
};

export default function EtiquetasPage() {
  return (
    <div className="a4-print-sheet mx-auto max-w-4xl px-4 py-8 sm:py-10">
      {/* Controles de pantalla (ocultos al imprimir) */}
      <section className="no-print mb-8 rounded-3xl border border-[#D8C8B4] bg-[#FBF8F3] p-6 shadow-sm sm:p-8 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="text-xs font-medium text-[#786758] transition hover:text-[#A64429]"
          >
            ← Volver al inicio
          </Link>
          <span className="rounded-full border border-[#D8C8B4] bg-[#EFE6D8] px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-[#6E5B4B]">
            Hoja A4 vertical · 6 etiquetas (2×3)
          </span>
        </div>

        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-[#1F1916] sm:text-4xl">
          Plancha de Etiquetas QR Colgantes
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#57493E]">
          Diseñadas para imprimir en hoja <strong>A4 vertical</strong> (ideal en
          papel mate o cartulina de 180–250 g), recortar por la línea punteada y
          perforar en el círculo superior para pasar hilo de yute o lana. Cada QR
          apunta directamente a la URL en vivo de producción.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <PrintButton />
          <p className="text-xs text-[#6B5B4E]">
            Sugerencia: en el diálogo de impresión dejá{" "}
            <strong>Escala 100 %</strong> y <strong>Vertical (A4)</strong>.
          </p>
        </div>
      </section>

      {/* Plancha imprimible 2x3 calibrada para A4 */}
      <section
        aria-label="Plancha A4 de 6 etiquetas QR colgantes"
        className="a4-print-grid grid grid-cols-1 gap-5 sm:grid-cols-2"
      >
        {LABEL_IDS.map((pieceId) => {
          const pieceUrl = `${PRODUCTION_BASE_URL}/p/${pieceId}`;
          return (
            <article
              key={pieceId}
              className="a4-tag-card relative flex flex-col items-center justify-between rounded-2xl border-2 border-dashed border-[#BFA992] bg-[#FBF8F3] px-5 pt-4 pb-4 text-center shadow-sm"
            >
              {/* Guía de perforación superior para hilo de yute o lana */}
              <div className="flex flex-col items-center">
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#8C5B3E] bg-white"
                  aria-hidden="true"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#CBB8A1]" />
                </div>
                <span className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-[#8C5B3E]">
                  TRAMA VIVA · SALTA
                </span>
              </div>

              {/* Código QR nítido con margen limpio */}
              <div className="my-2.5 flex flex-col items-center">
                <div className="rounded-xl border border-[#DED2C2] bg-white p-2 shadow-[0_1px_2px_rgba(31,25,22,0.06)]">
                  <QrCodeSvg
                    value={pieceUrl}
                    margin={2}
                    errorCorrectionLevel="M"
                    fgColor="#1F1916"
                    bgColor="#FFFFFF"
                    title={`Código QR para ${pieceId} (${pieceUrl})`}
                    className="h-36 w-36 print:h-[36mm] print:w-[36mm]"
                  />
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#D8C8B4] bg-[#F5EDE1] px-3 py-0.5 font-mono text-xs font-semibold tracking-wider text-[#1F1916]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#A64429]" />
                  {pieceId}
                </div>
              </div>

              {/* Leyenda bilingüe + línea editorial */}
              <div className="w-full border-t border-[#E6DACB] pt-2">
                <p className="font-serif text-[12px] leading-snug font-medium text-[#2E241E] print:text-[9.5pt] print:leading-tight">
                  Escaneá con la cámara de tu celular y escuchá la voz de quien
                  hizo esta pieza ·{" "}
                  <span className="italic text-[#6B5B4E]">
                    Scan to hear the artisan&apos;s voice
                  </span>
                </p>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
