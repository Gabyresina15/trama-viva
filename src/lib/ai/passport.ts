import {
  CraftCategory,
  CulturalPassport,
  CulturalPassportSchema,
} from "@/lib/types/trama";

interface ExtractPassportInput {
  audioBuffer?: Buffer;
  audioMimeType?: string;
  photoBuffer?: Buffer;
  photoMimeType?: string;
  manualHintTitle?: string;
  manualCategory?: CraftCategory;
  manualLocality?: string;
  manualTranscript?: string;
}

export interface AiDiagnostics {
  hasXaiKey: boolean;
  hasMetaKey: boolean;
  sttAttempted: boolean;
  sttSucceeded: boolean;
  sttErrorHint?: string;
  llmAttempted: boolean;
  llmSucceeded: boolean;
  llmModelUsed?: string;
  llmErrorHint?: string;
}

export interface ExtractPassportOutput {
  passport: CulturalPassport;
  aiSource: "xai_grok" | "meta_ai" | "manual_fallback";
  diagnostics: AiDiagnostics;
}

const SALTA_CRAFT_VOCAB_PROMPT =
  "Vocabulario regional frecuente en Salta y NOA: chaguar, simbol, telar criollo, urdimbre, trama, lana de oveja, fibra de llama, tintes naturales, nogal, cebolla, cochinilla, Seclantás, Cachi, Molinos, Cafayate, Animaná, Puna, Santa Victoria, Mercado Artesanal de Salta, tinaja, engobe, bruñido, alpaca, cincelado.";

function cleanEnv(val?: string): string {
  return (val || "").trim().replace(/^["']|["']$/g, "");
}

function extFromMime(mime?: string): string {
  if (!mime) return "webm";
  const lower = mime.toLowerCase();
  if (lower.includes("mp4") || lower.includes("m4a")) return "m4a";
  if (lower.includes("mpeg") || lower.includes("mp3")) return "mp3";
  if (lower.includes("wav")) return "wav";
  if (lower.includes("ogg")) return "ogg";
  return "webm";
}

async function transcribeWithGrokStt(
  audioBuffer: Buffer,
  audioMimeType: string,
  apiKey: string
): Promise<{ text: string | null; errorHint?: string }> {
  const model = cleanEnv(process.env.XAI_STT_MODEL) || "grok-voice-transcribe-2.0";
  const ext = extFromMime(audioMimeType);
  const cleanMime = (audioMimeType.split(";")[0] || "audio/webm").trim();

  const endpoints = [
    "https://api.x.ai/v1/stt",
    "https://api.x.ai/v1/audio/transcriptions",
  ];

  const errors: string[] = [];

  for (const url of endpoints) {
    try {
      const form = new FormData();
      const uint8 = new Uint8Array(audioBuffer);
      const blob = new Blob([uint8], { type: cleanMime });
      form.append("file", blob, `relato.${ext}`);
      form.append("model", model);
      form.append("language", "es");

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        errors.push(`${url} -> HTTP ${res.status} ${errBody.slice(0, 120)}`);
        continue;
      }
      const data = (await res.json()) as { text?: string; transcript?: string };
      const text = (data.text || data.transcript || "").trim();
      if (text.length > 0) return { text };
      errors.push(`${url} -> 200 empty text`);
    } catch (e) {
      errors.push(
        `${url} -> ${e instanceof Error ? e.message : "network_error"}`
      );
    }
  }

  return { text: null, errorHint: errors.join(" | ") };
}

async function structurePassportWithLlm(params: {
  transcriptEs: string;
  photoBuffer?: Buffer;
  photoMimeType?: string;
  manualCategory?: CraftCategory;
  manualHintTitle?: string;
  manualLocality?: string;
}): Promise<{
  passport: CulturalPassport | null;
  source?: "xai_grok" | "meta_ai";
  modelUsed?: string;
  errorHint?: string;
}> {
  const xaiKey = cleanEnv(process.env.XAI_API_KEY);
  const metaKey = cleanEnv(process.env.META_API_KEY);

  const useXai = Boolean(xaiKey);
  const apiKey = xaiKey || metaKey;
  if (!apiKey) return { passport: null, errorHint: "missing_api_key" };

  const baseUrl = useXai
    ? "https://api.x.ai/v1/chat/completions"
    : "https://api.meta.ai/v1/chat/completions";

  const configuredModel = useXai
    ? cleanEnv(process.env.XAI_CHAT_MODEL)
    : cleanEnv(process.env.META_CHAT_MODEL);

  const candidateModels = useXai
    ? Array.from(
        new Set(
          [configuredModel, "grok-4.7", "grok-4-fast", "grok-3-mini"].filter(
            Boolean
          )
        )
      )
    : [configuredModel || "muse-spark-1.3"];

  const systemPrompt = `Sos un archivista cultural del Mercado Artesanal de Salta.
A partir del relato oral transcripto de un artesano/a (y opcionalmente la foto de la pieza), devolvé EXCLUSIVAMENTE un objeto JSON válido sin bloques markdown.
${SALTA_CRAFT_VOCAB_PROMPT}

Reglas estrictas:
1. NO inventes datos que no estén en el relato ni se vean claramente en la imagen. Si no menciona su nombre, localidad, técnica o tiempo, poné null en ese campo y agregá qué faltó en qualityCheck.missingCriticalInfo.
2. Mantené transcriptEs fiel a la primera persona del artesano/a.
3. Traducí con calidez y fidelidad a inglés (translations.en) y portugués (translations.pt) para turistas extranjeros, conservando términos propios como "chaguar", "simbol" o nombres de parajes.
4. JAMÁS incluyas precios, montos, wallets ni porcentajes.

Estructura JSON exacta requerida:
{
  "transcriptEs": "string",
  "translations": { "en": "string", "pt": "string" },
  "craftMetadata": {
    "title": "string corto descriptivo de la pieza",
    "artisanMentionedName": "string | null",
    "localityOrRegion": "string | null",
    "category": "textil | ceramica | cesteria | plateria | madera | otro",
    "technique": "string | null",
    "materials": ["string"],
    "estimatedMakingTime": "string | null"
  },
  "qualityCheck": {
    "isRelevantAudio": true,
    "audioClarity": "high | medium | low",
    "missingCriticalInfo": ["string"]
  }
}`;

  const userText = [
    `Relato oral del artesano/a (ES): "${params.transcriptEs}"`,
    params.manualHintTitle ? `Título sugerido en puesto: "${params.manualHintTitle}"` : "",
    params.manualCategory ? `Rubro seleccionado: "${params.manualCategory}"` : "",
    params.manualLocality ? `Origen indicado en puesto: "${params.manualLocality}"` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const contentParts: Array<Record<string, unknown>> = [
    { type: "text", text: userText },
  ];

  const hasPhoto = Boolean(
    params.photoBuffer &&
      params.photoMimeType &&
      params.photoBuffer.byteLength <= 1_800_000
  );

  if (hasPhoto && params.photoBuffer && params.photoMimeType) {
    const b64 = params.photoBuffer.toString("base64");
    const cleanPhotoMime = params.photoMimeType.split(";")[0] || "image/jpeg";
    contentParts.push({
      type: "image_url",
      image_url: {
        url: `data:${cleanPhotoMime};base64,${b64}`,
      },
    });
  }

  const errors: string[] = [];

  for (const model of candidateModels) {
    // Intenta primero texto puro (ultra rápido y compatible con cualquier modelo) o multimodal si es el primero
    const payloads = hasPhoto ? [contentParts, userText] : [userText];
    for (const userContent of payloads) {
      try {
        const res = await fetch(baseUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature: 0.15,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent },
            ],
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          errors.push(`${model} -> HTTP ${res.status} ${errText.slice(0, 90)}`);
          continue;
        }

        const payload = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const rawContent = payload.choices?.[0]?.message?.content?.trim();
        if (!rawContent) continue;

        const cleaned = rawContent
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```$/i, "")
          .trim();

        const parsedJson = JSON.parse(cleaned);
        const validated = CulturalPassportSchema.safeParse(parsedJson);
        if (validated.success) {
          return {
            passport: validated.data,
            source: useXai ? "xai_grok" : "meta_ai",
            modelUsed: model,
          };
        }
        errors.push(`${model} -> zod_validation_failed`);
      } catch (e) {
        errors.push(
          `${model} -> ${e instanceof Error ? e.message : "llm_error"}`
        );
      }
    }
  }

  return { passport: null, errorHint: errors.slice(0, 3).join(" | ") };
}

const CATEGORY_LABELS: Record<
  CraftCategory,
  { es: string; en: string; pt: string }
> = {
  textil: {
    es: "Pieza textil artesanal",
    en: "Handwoven textile piece",
    pt: "Peça têxtil artesanal",
  },
  ceramica: {
    es: "Alfarería y cerámica salteña",
    en: "Handcrafted Salta pottery",
    pt: "Cerâmica artesanal de Salta",
  },
  cesteria: {
    es: "Cestería en fibra vegetal",
    en: "Natural plant-fiber basketry",
    pt: "Cestaria em fibra vegetal",
  },
  plateria: {
    es: "Orfebrería y metales",
    en: "Handcrafted silversmith work",
    pt: "Ourivesaria artesanal",
  },
  madera: {
    es: "Talla y oficio en madera",
    en: "Hand-carved woodcraft",
    pt: "Artesanato em madeira",
  },
  otro: {
    es: "Artesanía auténtica de Salta",
    en: "Authentic Salta handicraft",
    pt: "Artesanato autêntico de Salta",
  },
};

export function buildFallbackPassport(input: {
  transcriptEs?: string | null;
  category?: CraftCategory;
  hintTitle?: string;
  locality?: string;
}): CulturalPassport {
  const category = input.category || "textil";
  const labels = CATEGORY_LABELS[category];
  const locality = input.locality?.trim() || "Salta, Argentina";
  const title = input.hintTitle?.trim() || labels.es;
  const transcriptEs =
    input.transcriptEs?.trim() ||
    `Relato oral grabado directamente junto a la pieza (${title} · ${locality}). Escuchá la grabación original arriba.`;

  return {
    transcriptEs,
    translations: {
      en: input.transcriptEs
        ? `${input.transcriptEs} (${labels.en} · ${locality})`
        : `Original voice story recorded by the creator (${labels.en} · ${locality}). Listen to the authentic recording above.`,
      pt: input.transcriptEs
        ? `${input.transcriptEs} (${labels.pt} · ${locality})`
        : `Relato de voz original gravado por quem criou a peça (${labels.pt} · ${locality}). Ouça a gravação autêntica acima.`,
    },
    craftMetadata: {
      title,
      artisanMentionedName: null,
      localityOrRegion: locality,
      category,
      technique: labels.es,
      materials: [],
      estimatedMakingTime: null,
    },
    qualityCheck: {
      isRelevantAudio: true,
      audioClarity: "medium",
      missingCriticalInfo: [],
    },
  };
}

export async function extractCulturalPassport(
  input: ExtractPassportInput
): Promise<ExtractPassportOutput> {
  const xaiKey = cleanEnv(process.env.XAI_API_KEY);
  const metaKey = cleanEnv(process.env.META_API_KEY);

  const diagnostics: AiDiagnostics = {
    hasXaiKey: xaiKey.length > 5,
    hasMetaKey: metaKey.length > 5,
    sttAttempted: false,
    sttSucceeded: false,
    llmAttempted: false,
    llmSucceeded: false,
  };

  let transcript = input.manualTranscript?.trim() || null;

  if (!transcript && input.audioBuffer && diagnostics.hasXaiKey) {
    diagnostics.sttAttempted = true;
    const sttRes = await transcribeWithGrokStt(
      input.audioBuffer,
      input.audioMimeType || "audio/webm",
      xaiKey
    );
    transcript = sttRes.text;
    diagnostics.sttSucceeded = Boolean(sttRes.text);
    if (sttRes.errorHint) diagnostics.sttErrorHint = sttRes.errorHint;
  }

  if (transcript && (diagnostics.hasXaiKey || diagnostics.hasMetaKey)) {
    diagnostics.llmAttempted = true;
    const structured = await structurePassportWithLlm({
      transcriptEs: transcript,
      photoBuffer: input.photoBuffer,
      photoMimeType: input.photoMimeType,
      manualCategory: input.manualCategory,
      manualHintTitle: input.manualHintTitle,
      manualLocality: input.manualLocality,
    });

    if (structured.passport && structured.source) {
      diagnostics.llmSucceeded = true;
      diagnostics.llmModelUsed = structured.modelUsed;
      return {
        passport: structured.passport,
        aiSource: structured.source,
        diagnostics,
      };
    }
    if (structured.errorHint) diagnostics.llmErrorHint = structured.errorHint;
  }

  return {
    passport: buildFallbackPassport({
      transcriptEs: transcript,
      category: input.manualCategory,
      hintTitle: input.manualHintTitle,
      locality: input.manualLocality,
    }),
    aiSource: "manual_fallback",
    diagnostics,
  };
}
