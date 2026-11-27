import type { Metadata } from "next";
import Link from "next/link";
import { fieldPieceIds, fieldSession } from "@/data/field-validation";
import type { PieceFieldTest } from "@/data/field-validation";

export const metadata: Metadata = {
  title: "Bitácora de validación en campo · Trama Viva",
  description: "Metodología, pruebas por pieza y aprendizajes del Mercado Artesanal de Salta.",
};

const pending = "Sin datos";
const method = [
  "Explicar la prueba sin jerga cripto.",
  "Observar sin tocar la pantalla de quienes participan.",
  "Cronometrar la grabación autónoma: objetivo de menos de 60 s.",
  "Pedir consentimiento explícito para grabar y publicar.",
];

const labels = [
  ["P1", "Grabación autónoma"],
  ["P2", "Valor de llevarse la voz"],
  ["P3", "Cobros y consignación"],
  ["P4", "Etiqueta en la pieza"],
] as const;

const pieceLinkClass =
  "inline-flex min-h-10 items-center rounded-full border border-[#D4C4B0] px-3 text-xs font-medium text-[#4B3E35] transition hover:border-[#A64429] hover:text-[#A64429]";

function formatSeconds(seconds: number) {
  return `${seconds.toLocaleString("es-AR", { maximumFractionDigits: 1 })} s`;
}

function FieldPieceCard({
  pieceId,
  test,
}: {
  pieceId: PieceFieldTest["pieceId"];
  test?: PieceFieldTest;
}) {
  const answers = [
    [
      `Tiempo: ${test?.autonomousRecordingSeconds === undefined ? pending : formatSeconds(test.autonomousRecordingSeconds)}`,
      `Trabas observadas: ${test?.recordingObstacles ?? pending}`,
    ],
    [test?.perceivedVoiceValue ?? pending],
    [
      `Cobro a turistas extranjeros: ${test?.foreignTouristPayments ?? pending}`,
      `Liquidación de consignaciones: ${test?.consignmentSettlement ?? pending}`,
    ],
    [test?.qrLeftOnPiece === undefined ? pending : test.qrLeftOnPiece ? "Sí, quedó en la pieza" : "No quedó en la pieza"],
  ];

  return (
    <li className="rounded-2xl border border-[#DED2C2] bg-[#FBF8F3] p-4 sm:p-5">
      <h3 className="font-mono text-sm font-medium text-[#A64429]">{pieceId}</h3>
      <p className="mt-1 text-sm text-[#57493E]">Oficio o sala: {test?.craftOrRoom ?? pending}</p>
      <dl className="mt-4 space-y-3 border-t border-[#E3D6C5] pt-4 text-sm">
        {labels.map(([number, label], index) => (
          <div key={number}>
            <dt className="font-medium">
              <span className="mr-1.5 font-mono text-xs text-[#A64429]">{number}</span>
              {label}
            </dt>
            <dd className="mt-0.5 space-y-0.5 text-[#57493E]">
              {answers[index].map((answer, index) => <p key={index}>{answer}</p>)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={`/p/${pieceId}`} className={pieceLinkClass} aria-label={`Ver ${pieceId}`}>
          Ver pieza →
        </Link>
        {test?.stellarTestnetTxHash ? (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${test.stellarTestnetTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className={pieceLinkClass}
            aria-label={`Transacción de ${pieceId} en Stellar Expert (abre en otra pestaña)`}
          >
            Stellar Expert ↗
          </a>
        ) : (
          <span className="px-1 text-xs text-[#6B5B4E]">Sin transacción registrada</span>
        )}
      </div>
    </li>
  );
}

export default function FieldValidationPage() {
  const { dateTime, venue, address, participantsSurveyed, externalScans, pieceTests, learnings } = fieldSession;
  const recordingTimes = pieceTests.flatMap(({ autonomousRecordingSeconds }) =>
    autonomousRecordingSeconds === undefined ? [] : [autonomousRecordingSeconds],
  );
  const qrDecisions = pieceTests.filter(({ qrLeftOnPiece }) => qrLeftOnPiece !== undefined);
  const indicators = [
    { label: "Artesanos/salas relevados", value: participantsSurveyed ?? pending },
    {
      label: "Tiempo medido de grabación autónoma",
      value: recordingTimes.length
        ? formatSeconds(recordingTimes.reduce((sum, seconds) => sum + seconds, 0) / recordingTimes.length)
        : pending,
      detail: recordingTimes.length ? `Promedio de ${recordingTimes.length} mediciones` : undefined,
    },
    { label: "Escaneos externos de turistas/visitantes", value: externalScans ?? pending },
    {
      label: "Etiquetas QR aceptadas en puesto",
      value: qrDecisions.length ? qrDecisions.filter(({ qrLeftOnPiece }) => qrLeftOnPiece).length : pending,
      detail: qrDecisions.length ? `De ${qrDecisions.length} decisiones registradas` : undefined,
    },
  ];
  const hasFieldNotes = pieceTests.length > 0 || learnings.length > 0 ||
    participantsSurveyed !== undefined || externalScans !== undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:space-y-10 sm:py-12">
      <section className="rounded-3xl border border-[#D8C8B4] bg-[#FBF8F3] p-6 shadow-sm sm:p-9">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#D8C8B4] bg-[#EFE6D8] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#6E5B4B]">
          <span className="h-2 w-2 rounded-full bg-[#A64429]" aria-hidden="true" />
          Salta · Trabajo de campo
        </p>
        <h1 className="mt-4 font-serif text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
          Bitácora de validación en campo
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[#57493E]">
          <strong>{hasFieldNotes ? "Jornada de validación:" : "Jornada de validación programada:"}</strong>{" "}
          {dateTime} · {venue}, {address}
        </p>
        {!hasFieldNotes && (
          <p className="mt-2 text-sm leading-relaxed text-[#6B5B4E]">
            Todavía no hay resultados publicados. La bitácora se completará con observaciones reales de la jornada.
          </p>
        )}
        <div className="mt-5 border-t border-[#E3D6C5] pt-4">
          <h2 className="font-serif text-2xl font-semibold">Cómo vamos a observar</h2>
          <ul className="mt-2 grid list-disc gap-x-8 gap-y-1.5 pl-4 text-sm leading-relaxed text-[#57493E] marker:text-[#A64429] sm:grid-cols-2">
            {method.map((step) => <li key={step}>{step}</li>)}
          </ul>
        </div>
      </section>

      <section aria-labelledby="field-indicators">
        <h2 id="field-indicators" className="font-serif text-3xl font-semibold">Indicadores de la jornada</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {indicators.map(({ label, value, detail }) => (
            <div key={label} className="rounded-2xl border border-[#DED2C2] bg-[#EFE6D8] p-3.5 sm:p-4">
              <dt className="text-xs font-medium leading-relaxed text-[#57493E]">{label}</dt>
              <dd className="mt-1 font-serif text-2xl font-semibold leading-tight">{value}</dd>
              {detail && <dd className="mt-1 text-xs text-[#57493E]">{detail}</dd>}
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="field-pieces">
        <h2 id="field-pieces" className="font-serif text-3xl font-semibold">Pruebas por pieza</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {fieldPieceIds.map((pieceId) => (
            <FieldPieceCard
              key={pieceId}
              pieceId={pieceId}
              test={pieceTests.find((test) => test.pieceId === pieceId)}
            />
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#DED2C2] bg-[#EFE6D8] p-5 sm:p-7">
        <h2 className="font-serif text-3xl font-semibold leading-tight">
          Aprendizaje real → Cambio implementado en el producto
        </h2>
        {learnings.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-[#57493E]">
            Todavía no hay cambios documentados a partir de esta jornada.
          </p>
        ) : null}
        <div className="mt-4 space-y-4">
          {(learnings.length ? learnings : [null]).map((learning, index) => (
            <div key={index}>
              {learning && (
                <>
                  <h3 className="font-serif text-2xl font-semibold">{learning.title}</h3>
                  <p className="mt-1 mb-3 text-sm leading-relaxed text-[#57493E]">{learning.observation}</p>
                </>
              )}
              <dl className="grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#DED2C2] bg-[#FBF8F3] p-4">
                  <dt className="font-mono text-xs font-medium uppercase tracking-wide text-[#6B5B4E]">Antes</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed">{learning?.before ?? "Pendiente de observación"}</dd>
                </div>
                <div className="rounded-2xl border border-[#DED2C2] bg-[#FBF8F3] p-4">
                  <dt className="font-mono text-xs font-medium uppercase tracking-wide text-[#A64429]">Después</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed">{learning?.after ?? "Pendiente de documentar el cambio"}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
