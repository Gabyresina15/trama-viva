"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { QrCodeSvg } from "@/components/QrCodeSvg";
import {
  CraftCategory,
  PieceRecord,
  SPLIT_PRESETS,
  SplitPresetId,
} from "@/lib/types/trama";

const PRODUCTION_BASE_URL = "https://trama-viva-cjwf.vercel.app";

const STICKER_PRESETS = [
  "pieza-01",
  "pieza-02",
  "pieza-03",
  "pieza-04",
  "pieza-05",
  "pieza-06",
];

const CATEGORIES: Array<{ id: CraftCategory; label: string }> = [
  { id: "textil", label: "Textil / Telar" },
  { id: "ceramica", label: "Cerámica" },
  { id: "cesteria", label: "Cestería / Chaguar" },
  { id: "plateria", label: "Platería / Metal" },
  { id: "madera", label: "Madera" },
  { id: "otro", label: "Otro oficio" },
];

async function compressImageFile(file: File, maxDim = 1100): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob || file),
        "image/jpeg",
        0.82
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function pickSupportedAudioMime(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

function CrearFormInner() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id")?.trim().toLowerCase() || "pieza-01";

  const [pieceId, setPieceId] = useState(initialId);
  const [category, setCategory] = useState<CraftCategory>("textil");
  const [splitPresetId, setSplitPresetId] =
    useState<SplitPresetId>("sala_colectiva");
  const [hintTitle, setHintTitle] = useState("");
  const [locality, setLocality] = useState("");
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPiece, setCreatedPiece] = useState<PieceRecord | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickSupportedAudioMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const finalMime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalMime });
        setAudioBlob(blob);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      recorderRef.current = recorder;
      recorder.start(250);
      setSeconds(0);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev + 1 >= 35) {
            stopRecording();
            return 35;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setError(
        "No se pudo abrir el micrófono del navegador. Usá el botón 'Subir nota de voz' de abajo."
      );
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  }

  function handleAudioFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setAudioBlob(file);
    setAudioPreviewUrl(URL.createObjectURL(file));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const compressed = await compressImageFile(file);
    setPhotoBlob(compressed);
    setPhotoPreviewUrl(URL.createObjectURL(compressed));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!audioBlob) {
      setError("Primero grabá 15–20 segundos de voz (o subí un audio).");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("pieceId", pieceId.trim().toLowerCase());
      form.append("category", category);
      form.append("splitPresetId", splitPresetId);
      if (hintTitle.trim()) form.append("hintTitle", hintTitle.trim());
      if (locality.trim()) form.append("locality", locality.trim());
      form.append("audio", audioBlob, "relato");
      if (photoBlob) {
        form.append("photo", photoBlob, "pieza.jpg");
      }

      const res = await fetch("/api/pieces", {
        method: "POST",
        body: form,
      });

      const data = (await res.json()) as { piece?: PieceRecord; error?: string };
      if (!res.ok || !data.piece) {
        throw new Error(data.error || "No se pudo guardar y sellar la pieza");
      }

      setCreatedPiece(data.piece);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShareOrCopy(piece: PieceRecord, url: string) {
    setShareFeedback(null);
    const shareTitle = `${piece.passport.craftMetadata.title} · Trama Viva`;
    const shareText = `Escuchá la voz de quien hizo esta pieza (${piece.id}) en Trama Viva:`;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url });
        setShareFeedback("Enlace compartido");
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareFeedback("Enlace copiado al portapapeles");
    } catch {
      setShareFeedback(`Copiá este enlace: ${url}`);
    }
  }

  if (createdPiece) {
    const publicPath = `/p/${createdPiece.id}`;
    const publicUrl = `${PRODUCTION_BASE_URL}${publicPath}`;
    return (
      <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
        <div className="rounded-3xl border border-[#2B5B44]/40 bg-[#FBF8F3] p-6 shadow-sm sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#E9F2EC] px-3 py-1 text-xs font-semibold text-[#1E4432]">
            ✓ Relato sellado · Etiqueta {createdPiece.id} lista
          </div>

          <h1 className="mt-3 font-serif text-3xl font-semibold text-[#1F1916]">
            {createdPiece.passport.craftMetadata.title}
          </h1>

          <p className="mt-2 text-xs text-[#6B5B4E]">
            Origen detectado:{" "}
            <strong>
              {createdPiece.passport.craftMetadata.localityOrRegion || "Salta"}
            </strong>{" "}
            · Reparto:{" "}
            <strong>
              {Math.round(createdPiece.artisanBps / 100)} % autora /{" "}
              {Math.round(createdPiece.salaBps / 100)} % sala
            </strong>
          </p>

          <div className="mt-5 flex flex-col items-center rounded-2xl border border-[#DED2C2] bg-white p-5 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C5B3E]">
              Probá el escaneo celular a celular
            </span>
            <div className="mt-3 rounded-xl border border-[#E6DACB] bg-white p-2">
              <QrCodeSvg
                value={publicUrl}
                margin={2}
                errorCorrectionLevel="M"
                fgColor="#1F1916"
                bgColor="#FFFFFF"
                title={`Código QR para ${createdPiece.id}`}
                className="h-44 w-44"
              />
            </div>
            <p className="mt-2.5 break-all font-mono text-[11px] text-[#5B4C40]">
              {publicUrl}
            </p>
            <button
              type="button"
              onClick={() => handleShareOrCopy(createdPiece, publicUrl)}
              className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-[#A64429] bg-[#FDF9F3] px-5 py-2.5 text-xs font-semibold text-[#A64429] transition hover:bg-[#A64429] hover:text-white"
            >
              Copiar enlace / Compartir
            </button>
            {shareFeedback && (
              <p
                role="status"
                className="mt-2 text-xs font-medium text-[#1E4432]"
              >
                {shareFeedback}
              </p>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-[#E3D6C5] bg-white p-4 text-xs leading-relaxed text-[#3E332B]">
            <p className="font-semibold text-[#786758] uppercase tracking-wider text-[10px]">
              Transcripción (ES)
            </p>
            <p className="mt-1 italic">“{createdPiece.passport.transcriptEs}”</p>
            <p className="mt-3 font-semibold text-[#786758] uppercase tracking-wider text-[10px]">
              Traducción automática para turistas (EN)
            </p>
            <p className="mt-1 text-[#57493E]">
              “{createdPiece.passport.translations.en}”
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-[#E3D6C5] bg-[#F5EDE1] p-3.5 font-mono text-[11px] text-[#5B4C40] break-all">
            <p>SHA-256 Pasaporte: {createdPiece.passportHashHex}</p>
            <p className="mt-1">Tx Registro: {createdPiece.registrationTxHash}</p>
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href={publicPath}
              className="flex-1 rounded-full bg-[#A64429] px-5 py-3.5 text-center text-sm font-medium text-white shadow-sm transition hover:bg-[#8C361E]"
            >
              Abrir vista del comprador ({createdPiece.id}) →
            </Link>
            <button
              type="button"
              onClick={() => {
                setCreatedPiece(null);
                setShareFeedback(null);
                setAudioBlob(null);
                setAudioPreviewUrl(null);
                setPhotoBlob(null);
                setPhotoPreviewUrl(null);
              }}
              className="rounded-full border border-[#CBB8A1] bg-white px-5 py-3.5 text-sm font-medium text-[#2E241E]"
            >
              Grabar otra pieza
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 sm:py-10">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-[#D8C8B4] bg-[#FBF8F3] p-5 shadow-sm sm:p-8"
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8C5B3E]">
          Registro rápido en puesto · Menos de 45 segundos
        </span>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-[#1F1916]">
          Vincular la voz a una pieza
        </h1>

        {/* Paso 1: Etiqueta QR física */}
        <div className="mt-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#5B4C40]">
            1. Etiqueta QR de la pieza
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STICKER_PRESETS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setPieceId(id)}
                className={`rounded-full px-3 py-1.5 font-mono text-xs transition ${
                  pieceId === id
                    ? "bg-[#1F1916] text-[#F6F0E6]"
                    : "border border-[#D8C8B4] bg-white text-[#57493E] hover:border-[#1F1916]"
                }`}
              >
                {id}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={pieceId}
            onChange={(e) => setPieceId(e.target.value)}
            placeholder="ej. pieza-01"
            className="mt-2 w-full rounded-2xl border border-[#D8C8B4] bg-white px-3.5 py-2 font-mono text-xs text-[#1F1916] focus:border-[#A64429] focus:outline-none"
          />
        </div>

        {/* Paso 2: Foto de la pieza */}
        <div className="mt-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#5B4C40]">
            2. Foto de la artesanía
          </label>
          <div className="mt-2 flex items-center gap-3">
            <label className="flex-1 cursor-pointer rounded-2xl border border-dashed border-[#BFA992] bg-white px-4 py-3.5 text-center text-xs font-medium text-[#4B3E35] transition hover:border-[#A64429] hover:text-[#A64429]">
              {photoPreviewUrl ? "Cambiar foto de la pieza" : "📷 Sacar o elegir foto"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
            {photoPreviewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreviewUrl}
                alt="Vista previa"
                className="h-14 w-14 rounded-2xl border border-[#D8C8B4] object-cover"
              />
            )}
          </div>
        </div>

        {/* Paso 3: Voz de quien la hizo */}
        <div className="mt-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#5B4C40]">
            3. La voz de quien la hizo (15 a 25 seg)
          </label>
          <p className="mt-1 text-xs text-[#6B5B4E]">
            Guía sugerida:{" "}
            <em>
              “Soy [nombre], de [pueblo/paraje]. Hice esta pieza con [material y
              técnica] y me llevó [días].”
            </em>
          </p>

          <div className="mt-3 rounded-3xl border border-[#DFD2C0] bg-white p-4 text-center">
            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#A64429] text-white shadow-md transition hover:scale-105 hover:bg-[#8C361E]"
              >
                <span className="text-2xl">🎙️</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="mx-auto flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-[#B91C1C] text-white shadow-md"
              >
                <span className="text-sm font-bold">LISTO ■</span>
              </button>
            )}

            <p className="mt-2.5 text-xs font-medium text-[#3E332B]">
              {isRecording
                ? `Grabando relato… 00:${seconds.toString().padStart(2, "0")} (tocá para terminar)`
                : audioPreviewUrl
                ? "Audio grabado listo (podés escucharlo abajo o regrabar)"
                : "Tocá el micrófono para empezar a hablar"}
            </p>

            {audioPreviewUrl && !isRecording && (
              <audio
                controls
                src={audioPreviewUrl}
                className="mt-3 w-full"
              />
            )}

            <div className="mt-3 border-t border-[#EFE6D8] pt-2.5">
              <label className="cursor-pointer text-[11px] font-medium text-[#786758] underline hover:text-[#A64429]">
                ¿Sin permiso de micrófono? Subir nota de voz del celular
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Paso 4: Rubro y Acuerdo de reparto */}
        <div className="mt-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#5B4C40]">
            4. Oficio y acuerdo de cobro directo
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`rounded-full px-3 py-1.5 text-xs transition ${
                  category === cat.id
                    ? "bg-[#5C3A28] text-white"
                    : "border border-[#D8C8B4] bg-white text-[#57493E]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <select
            value={splitPresetId}
            onChange={(e) => setSplitPresetId(e.target.value as SplitPresetId)}
            className="mt-3 w-full rounded-2xl border border-[#D8C8B4] bg-white px-3.5 py-2.5 text-xs font-medium text-[#1F1916] focus:border-[#A64429] focus:outline-none"
          >
            {Object.values(SPLIT_PRESETS).map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-[#6B5B4E]">
            {SPLIT_PRESETS[splitPresetId].shortDescription}
          </p>
        </div>

        {/* Notas manuales opcionales */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowOptionalFields((v) => !v)}
            className="text-xs font-medium text-[#786758] underline"
          >
            {showOptionalFields
              ? "Ocultar datos opcionales"
              : "+ Agregar título o localidad manual (opcional)"}
          </button>
          {showOptionalFields && (
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={hintTitle}
                onChange={(e) => setHintTitle(e.target.value)}
                placeholder="Nombre de la pieza (opcional)"
                className="rounded-xl border border-[#D8C8B4] bg-white px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                placeholder="Paraje / Localidad (ej. Seclantás)"
                className="rounded-xl border border-[#D8C8B4] bg-white px-3 py-2 text-xs"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-[#C94A38]/40 bg-[#FDF0ED] p-3 text-xs text-[#8E2B1D]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || isRecording}
          className="mt-6 w-full rounded-full bg-[#A64429] px-6 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8C361E] disabled:opacity-60"
        >
          {submitting
            ? "Procesando voz y sellando en Stellar…"
            : "Guardar historia y activar etiqueta QR"}
        </button>
      </form>
    </div>
  );
}

export default function CrearPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl px-4 py-12 text-center text-sm text-[#6B5B4E]">
          Cargando grabador…
        </div>
      }
    >
      <CrearFormInner />
    </Suspense>
  );
}
