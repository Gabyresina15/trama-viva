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

export interface ExtractPassportOutput {
  passport: CulturalPassport;
  aiSource: "xai_grok" | "meta_ai" | "manual_fallback";
}

const SALTA_CRAFT_VOCAB_PROMPT =
  "Vocabulario regional frecuente en Salta y NOA: chaguar, simbol, telar criollo, urdimbre, trama, lana de oveja, fibra de llama, tintes naturales, nogal, cebolla, cochinilla, Seclantás, Cachi, Molinos, Cafayate, Animaná, Puna, Santa Victoria, Mercado Artesanal de Salta, tinaja, engobe, bruñido, alpaca, cincelado.";

function extFromMime(mime?: string): string {
  if (!mime) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

async function transcribeWithGrokStt(
  audioBuffer: Buffer,
  audioMimeType: string,
  apiKey: string
): Promise<string | null> {
  const model = process.env.XAI_STT_MODEL || "grok-voice-transcribe-2.0";
  const ext = extFromMime(audioMimeType);
  const cleanMime = audioMimeType.split(";")[0] || "audio/webm";

  const endpoints = [
    "https://api.x.ai/v1/stt",
    "https://api.x.ai/v1/audio/transcriptions",
  ];

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
        signal: AbortSignal.timeout(9000),
      });

      if (!res.ok) continue;
      const data = (await res.json()) as { text?: string; transcript?: string };
      const text = (data.text || data.transcript || "").trim();
      if (text.length > 0) return text;
    } catch {
      // Intenta el endpoint alternativo o cae al fallback sin romper el flujo.
    }
  }
  return null;
}

async function structurePassportWithLlm(params: {
  transcriptEs: string;
  photoBuffer?: Buffer;
  photoMimeType?: string;
  manualCategory?: CraftCategory;
  manualHintTitle?: string;
  manualLocality?: string;
}): Promise<{ passport: CulturalPassport; source: "xai_grok" | "meta_ai" } | null> {
  const xaiKey = process.env.XAI_API_KEY?.trim();
  const metaKey = process.env.META_API_KEY?.trim();

  const useXai = Boolean(xaiKey);
  const apiKey = xaiKey || metaKey;
  if (!apiKey) return null;

  const baseUrl = useXai
    ? "https://api.x.ai/v1/chat/completions"
    : "https://api.meta.ai/v1/chat/completions";
  const model = useXai
    ? process.env.XAI_CHAT_MODEL || "grok-4-fast"
    : process.env.META_CHAT_MODEL || "muse-spark-1.3";

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

  if (
    params.photoBuffer &&
    params.photoMimeType &&
    params.photoBuffer.byteLength <= 1_800_000
  ) {
    const b64 = params.photoBuffer.toString("base64");
    const cleanPhotoMime = params.photoMimeType.split(";")[0] || "image/jpeg";
    contentParts.push({
      type: "image_url",
      image_url: {
        url: `data:${cleanPhotoMime};base64,${b64}`,
      },
    });
  }

  for (let attempt = 0; attempt < 2; attempt++) {
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
            {
              role: "user",
              content: attempt === 0 ? contentParts : userText,
            },
          ],
        }),
        signal: AbortSignal.timeout(9500),
      });

      if (!res.ok) continue;
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
        };
      }
    } catch {
      // Si el primer intento con imagen falla o da timeout, el segundo intenta solo con texto.
    }
  }

  return null;
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
        ? `[Auto-caption ready on live voice] ${labels.en} from ${locality}. Listen to the artisan's original voice above.`
        : `Original voice story recorded by the creator (${labels.en} · ${locality}). Listen to the authentic recording above.`,
      pt: input.transcriptEs
        ? `[Legenda vinculada à voz original] ${labels.pt} de ${locality}. Ouça a voz original de quem fez a peça acima.`
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
  const xaiKey = process.env.XAI_API_KEY?.trim();
  let transcript = input.manualTranscript?.trim() || null;

  if (!transcript && input.audioBuffer && xaiKey) {
    transcript = await transcribeWithGrokStt(
      input.audioBuffer,
      input.audioMimeType || "audio/webm",
      xaiKey
    );
  }

  if (transcript) {
    const structured = await structurePassportWithLlm({
      transcriptEs: transcript,
      photoBuffer: input.photoBuffer,
      photoMimeType: input.photoMimeType,
      manualCategory: input.manualCategory,
      manualHintTitle: input.manualHintTitle,
      manualLocality: input.manualLocality,
    });

    if (structured) {
      return {
        passport: structured.passport,
        aiSource: structured.source,
      };
    }
  }

  return {
    passport: buildFallbackPassport({
      transcriptEs: transcript,
      category: input.manualCategory,
      hintTitle: input.manualHintTitle,
      locality: input.manualLocality,
    }),
    aiSource: "manual_fallback",
  };
}
