import type { Metadata } from "next";
import Link from "next/link";
import {
  externalUsabilityChecks,
  paymentRailsComparison,
  productLearnings,
  verifiedProblemSources,
} from "@/data/field-validation";

export const metadata: Metadata = {
  title: "Validación de Problema, Costos e Iteraciones · Trama Viva",
  description:
    "Evidencia documentada en Salta, comparativa real de costos frente a medios locales, aprendizajes de mentoría y pruebas verificables en Stellar Testnet.",
};

export default function ValidationPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:space-y-10 sm:py-12">
      {/* Encabezado */}
      <section className="rounded-3xl border border-[#D8C8B4] bg-[#FBF8F3] p-6 shadow-sm sm:p-9">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#D8C8B4] bg-[#EFE6D8] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#6E5B4B]">
          <span className="h-2 w-2 rounded-full bg-[#A64429]" aria-hidden="true" />
          Salta · Evidencia Real y Diseño de Incentivos
        </p>

        <h1 className="mt-4 font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-[#1F1916] sm:text-5xl">
          Validación del problema, economía real e iteraciones
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-[#57493E] sm:text-base">
          Sin cifras inventadas ni promesas vacías: esta bitácora reúne las{" "}
          <strong>fuentes reales relevadas sobre el sector artesanal salteño</strong>, el{" "}
          <strong>cálculo honesto de comisiones</strong> frente a medios de pago locales y{" "}
          <strong>los cambios concretos de arquitectura y modelo de negocio</strong> nacidos
          durante la mentoría y las pruebas en Stellar Testnet.
        </p>
      </section>

      {/* 1. Evidencia documentada del problema */}
      <section aria-labelledby="problem-evidence">
        <h2
          id="problem-evidence"
          className="font-serif text-3xl font-semibold text-[#1F1916]"
        >
          1. ¿Es un problema real hoy en Salta?
        </h2>
        <p className="mt-1 text-xs text-[#6B5B4E]">
          Fuentes periodísticas, institucionales y sectoriales verificadas
        </p>

        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          {verifiedProblemSources.map((item) => (
            <article
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-[#DED2C2] bg-[#FBF8F3] p-5"
            >
              <div>
                <h3 className="font-serif text-xl font-semibold leading-snug text-[#1F1916]">
                  {item.actorOrStudy}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#57493E]">
                  {item.finding}
                </p>
              </div>
              <div className="mt-4 border-t border-[#E6DACB] pt-2.5">
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold text-[#A64429] underline underline-offset-2"
                >
                  Fuente: {item.sourceLabel} ↗
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 2. Comparativa honesta de comisiones */}
      <section className="rounded-3xl border border-[#DED2C2] bg-[#FBF8F3] p-5 sm:p-7">
        <h2 className="font-serif text-3xl font-semibold text-[#1F1916]">
          2. ¿Cuándo rinde Stellar y cuándo Mercado Pago?
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-[#57493E]">
          Simulación real sobre una artesanía de <strong>10.000 ARS</strong> (~5,7 USDC).
          No vendemos Stellar por “ahorrar centavos frente a una transferencia local”, sino
          por el <strong>reparto automático 85/15 auditable</strong>, la{" "}
          <strong>custodia sin intermediarios</strong> y el cobro frente a tarjetas
          extranjeras.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#D8C8B4] text-[11px] uppercase tracking-wider text-[#6E5B4B]">
                <th className="py-2.5 pr-3">Medio de pago</th>
                <th className="py-2.5 px-3">Costo estimado</th>
                <th className="py-2.5 px-3">Queda para repartir</th>
                <th className="py-2.5 pl-3">Criterio en Trama Viva</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE0D2] text-[#3E332B]">
              {paymentRailsComparison.map((row) => (
                <tr key={row.rail}>
                  <td className="py-3 pr-3 font-medium">{row.rail}</td>
                  <td className="py-3 px-3 font-mono text-[11px]">
                    {row.estimatedCostOn10kArs}
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] font-semibold text-[#1E4432]">
                    {row.netForSplit85_15}
                  </td>
                  <td className="py-3 pl-3 text-[11px] text-[#57493E]">
                    {row.verdict}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Qué aprendimos y qué cambiamos (Antes / Después) */}
      <section className="rounded-3xl border border-[#DED2C2] bg-[#EFE6D8] p-5 sm:p-7">
        <h2 className="font-serif text-3xl font-semibold leading-tight text-[#1F1916]">
          3. Qué aprendimos → Cambios aplicados al producto
        </h2>

        <div className="mt-5 space-y-6">
          {productLearnings.map((learning) => (
            <article
              key={learning.title}
              className="rounded-2xl border border-[#D8C8B4] bg-[#FBF8F3] p-5"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8C5B3E]">
                {learning.source}
              </span>
              <h3 className="mt-1 font-serif text-2xl font-semibold text-[#1F1916]">
                {learning.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#57493E]">
                {learning.observation}
              </p>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#E3D6C5] bg-[#F5EDE1] p-3.5">
                  <dt className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#786758]">
                    Antes
                  </dt>
                  <dd className="mt-1 text-xs leading-relaxed text-[#4B3E35]">
                    {learning.before}
                  </dd>
                </div>
                <div className="rounded-xl border border-[#2B5B44]/30 bg-[#EBF4EE] p-3.5">
                  <dt className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#1E4432]">
                    Después (implementado)
                  </dt>
                  <dd className="mt-1 text-xs leading-relaxed text-[#1E4432]">
                    {learning.after}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      {/* 4. Evidencia verificable y pruebas de flujo */}
      <section aria-labelledby="usability-evidence">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="usability-evidence"
            className="font-serif text-3xl font-semibold text-[#1F1916]"
          >
            4. Pruebas verificables en Stellar Testnet
          </h2>
          <Link
            href="/p/pieza-demo-telar"
            className="text-xs font-semibold text-[#A64429] underline"
          >
            Probar flujo en vivo ahora →
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {externalUsabilityChecks.map((check) => (
            <div
              key={check.id}
              className="rounded-2xl border border-[#DED2C2] bg-[#FBF8F3] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#1F1916]">
                  {check.profile}
                </p>
                <span className="rounded-full bg-[#E9F2EC] px-2.5 py-0.5 text-[11px] font-semibold text-[#1E4432]">
                  {check.secondsElapsed
                    ? `Completado en ${check.secondsElapsed} s ✓`
                    : "Transacción confirmada ✓"}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#57493E]">
                {check.feedbackQuote}
              </p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <Link
                  href={`/r/${check.stellarTestnetTxHash}`}
                  className="inline-flex items-center rounded-full bg-[#1F1916] px-3.5 py-1.5 text-[11px] font-medium text-white"
                >
                  Abrir recibo verificable →
                </Link>
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${check.stellarTestnetTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full border border-[#CBB8A1] bg-white px-3.5 py-1.5 text-[11px] font-medium text-[#2E241E] hover:border-[#A64429]"
                >
                  Ver en Stellar Expert ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
