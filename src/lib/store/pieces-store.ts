import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { get, list, put } from "@vercel/blob";
import {
  PieceRecord,
  SupportReceiptRecord,
  serializeCanonicalPackage,
  sha256Hex,
} from "@/lib/types/trama";

const DEFAULT_SALA =
  process.env.SALA_PUBLIC_KEY ||
  "GDOCBPHEP3JWETL5DUDNHECK4LUAJDMQFH2B7APBET3CAKSWXM3CTVP6";
const DEFAULT_ARTESANA =
  process.env.ARTESANA_PUBLIC_KEY ||
  "GASRK6WN7ZNDXMUYPWGBL4NHMDVWZRNTPTQ75XFK37B3FH6SVNMVAHMY";
const DEFAULT_CONTRACT_ID =
  process.env.NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID?.trim() ||
  "CDK6FDRZK5TQ544VDDXFPWXC3OEPXI2RQFA2MMASYIDVFKHG3YLSYIDR";

function isVercelBlobEnabled(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
      (process.env.BLOB_STORE_ID?.trim() &&
        process.env.VERCEL_OIDC_TOKEN?.trim())
  );
}

async function readPrivateBlobBuffer(
  pathname: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const res = await get(pathname, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const arr = await new Response(res.stream).arrayBuffer();
    return {
      buffer: Buffer.from(arr),
      contentType: res.blob.contentType || "application/octet-stream",
    };
  } catch {
    return null;
  }
}

let resolvedBaseDir: string | null = null;

async function getStorageRoot(): Promise<string> {
  if (resolvedBaseDir) return resolvedBaseDir;

  const localDir = path.join(process.cwd(), ".data");
  try {
    await fs.mkdir(path.join(localDir, "pieces"), { recursive: true });
    await fs.mkdir(path.join(localDir, "receipts"), { recursive: true });
    resolvedBaseDir = localDir;
    return localDir;
  } catch {
    const tmpDir = path.join(os.tmpdir(), "trama-viva-data");
    await fs.mkdir(path.join(tmpDir, "pieces"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "receipts"), { recursive: true });
    resolvedBaseDir = tmpDir;
    return tmpDir;
  }
}

/**
 * Genera un archivo WAV sintético cálido (acorde acústico suave de 3 segundos)
 * para las piezas semilla de demostración, garantizando que el reproductor
 * y el cálculo SHA-256 real funcionen en cualquier navegador desde el minuto cero.
 */
export function generateSeedDemoWavBuffer(seedFreq = 293.66): Buffer {
  const sampleRate = 16000;
  const durationSeconds = 3;
  const numSamples = sampleRate * durationSeconds;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t * 4) * Math.exp(-t * 0.85);
    const fundamental = Math.sin(2 * Math.PI * seedFreq * t);
    const fifth = 0.45 * Math.sin(2 * Math.PI * (seedFreq * 1.5) * t);
    const octave = 0.25 * Math.sin(2 * Math.PI * (seedFreq * 2) * t);
    const sample = Math.max(
      -1,
      Math.min(1, envelope * 0.45 * (fundamental + fifth + octave))
    );
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }

  return buffer;
}

function buildSeedRecord(params: {
  id: string;
  sorobanSymbol: string;
  title: string;
  artisanName: string;
  locality: string;
  category: "textil" | "ceramica";
  technique: string;
  materials: string[];
  makingTime: string;
  transcriptEs: string;
  en: string;
  pt: string;
  artisanBps: number;
  freq: number;
  svgAccent: string;
}): PieceRecord {
  const wav = generateSeedDemoWavBuffer(params.freq);
  const audioSha256 = sha256Hex(wav);
  const canonicalPackageJson = serializeCanonicalPackage({
    v: 1,
    pieceId: params.id,
    audioSha256,
    salaAddress: DEFAULT_SALA,
    artisanAddress: DEFAULT_ARTESANA,
    artisanBps: params.artisanBps,
  });
  const passportHashHex = sha256Hex(canonicalPackageJson);
  const contractId = DEFAULT_CONTRACT_ID;
  const explorerBase =
    process.env.NEXT_PUBLIC_EXPLORER_BASE ||
    "https://stellar.expert/explorer/testnet";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#231915"/>
        <stop offset="100%" stop-color="${params.svgAccent}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#bg)"/>
    <g stroke="#e8d8c8" stroke-opacity="0.22" stroke-width="2" fill="none">
      <path d="M0 140 L800 140 M0 460 L800 460"/>
      <polygon points="400,170 490,300 400,430 310,300"/>
      <polygon points="400,210 460,300 400,390 340,300"/>
      <polygon points="220,230 270,300 220,370 170,300"/>
      <polygon points="580,230 630,300 580,370 530,300"/>
    </g>
    <text x="48" y="92" fill="#f5ebe0" font-family="Georgia, serif" font-size="22" letter-spacing="3">PIEZA DE DEMOSTRACIÓN · TESTNET</text>
    <text x="48" y="525" fill="#f5ebe0" font-family="Georgia, serif" font-size="30">${params.title}</text>
    <text x="48" y="562" fill="#d6c2b0" font-family="sans-serif" font-size="18">${params.locality}</text>
  </svg>`;

  return {
    id: params.id,
    sorobanSymbol: params.sorobanSymbol,
    createdAt: "2026-11-26T16:00:00.000Z",
    isDemoSeed: true,
    splitPresetId: "sala_colectiva",
    artisanBps: params.artisanBps,
    salaBps: 10000 - params.artisanBps,
    salaAddress: DEFAULT_SALA,
    artisanAddress: DEFAULT_ARTESANA,
    audioMimeType: "audio/wav",
    photoFallbackSvg: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    audioSha256,
    canonicalPackageJson,
    passportHashHex,
    aiSource: "manual_fallback",
    passport: {
      transcriptEs: params.transcriptEs,
      translations: {
        en: params.en,
        pt: params.pt,
      },
      craftMetadata: {
        title: params.title,
        artisanMentionedName: params.artisanName,
        localityOrRegion: params.locality,
        category: params.category,
        technique: params.technique,
        materials: params.materials,
        estimatedMakingTime: params.makingTime,
      },
      qualityCheck: {
        isRelevantAudio: true,
        audioClarity: "high",
        missingCriticalInfo: [],
      },
    },
    registrationTxHash:
      "6326bc0a7d83f5e3ea51446d85c5adca46be5c578fa02eda24f161f179e9d865",
    contractId,
    explorerTxUrl: `${explorerBase}/tx/6326bc0a7d83f5e3ea51446d85c5adca46be5c578fa02eda24f161f179e9d865`,
    explorerContractUrl: `${explorerBase}/contract/${contractId}`,
    chainMode: "soroban_testnet",
    supports: [],
  };
}

const DEMO_SEEDS: Record<string, () => { record: PieceRecord; audio: Buffer }> = {
  "pieza-demo-telar": () => ({
    record: buildSeedRecord({
      id: "pieza-demo-telar",
      sorobanSymbol: "pieza_demo_telar",
      title: "Camino de mesa en telar criollo y nogal",
      artisanName: "Muestra de Taller (Demo Testnet)",
      locality: "Valles Calchaquíes · Sala Colectiva Salta",
      category: "textil",
      technique: "Telar criollo de pedales y teñido en olla con cáscara de nogal",
      materials: ["Lana de oveja hilada a huso", "Tinte natural de nogal"],
      makingTime: "9 días de urdido y tejido",
      transcriptEs:
        "Pieza de demostración técnica para Testnet: este tapiz representa las piezas que llegan en consignación desde los Valles Calchaquíes a las salas asociativas de Salta Capital, vinculando el relato oral con el reparto directo en USDC.",
      en: "Technical Testnet demonstration piece: this textile represents pieces consigned from the Calchaquí Valleys to cooperative rooms in Salta Capital, linking oral memory with atomic USDC settlement.",
      pt: "Peça de demonstração técnica na Testnet: este tecido representa as obras enviadas em consignação dos Vales Calchaquíes às salas cooperativas de Salta Capital, unindo memória oral e pagamento direto em USDC.",
      artisanBps: 8500,
      freq: 293.66,
      svgAccent: "#5c2c1d",
    }),
    audio: generateSeedDemoWavBuffer(293.66),
  }),
  "pieza-demo-ceramica": () => ({
    record: buildSeedRecord({
      id: "pieza-demo-ceramica",
      sorobanSymbol: "pieza_demo_ceramica",
      title: "Vasija bruñida a piedra con engobe mineral",
      artisanName: "Muestra de Alfarería (Demo Testnet)",
      locality: "Quebrada y Valles · Sala Colectiva Salta",
      category: "ceramica",
      technique: "Modelado a rollo, engobe de arcillas locales y bruñido con canto rodado",
      materials: ["Arcilla roja recolectada", "Pigmentos minerales"],
      makingTime: "6 días entre modelado, secado y horneado a leña",
      transcriptEs:
        "Pieza de demostración técnica para Testnet: alfarería modelada a mano sin torno, con sello criptográfico SHA-256 y custodia en contrato Soroban para creadores sin billetera previa.",
      en: "Technical Testnet demonstration piece: hand-coiled pottery without a wheel, featuring SHA-256 cryptographic sealing and Soroban smart-contract escrow for artisans without a prior wallet.",
      pt: "Peça de demostración técnica na Testnet: cerâmica modelada à mão sem torno, com selo criptográfico SHA-256 e custódia em contrato Soroban para artesãos sem carteira prévia.",
      artisanBps: 8500,
      freq: 349.23,
      svgAccent: "#3f2e21",
    }),
    audio: generateSeedDemoWavBuffer(349.23),
  }),
};

export async function savePieceWithMedia(params: {
  record: PieceRecord;
  audioBuffer: Buffer;
  audioExt: string;
  photoBuffer?: Buffer;
  photoExt?: string;
}): Promise<PieceRecord> {
  const audioFileName = `audio.${params.audioExt}`;
  let photoFileName: string | undefined;
  if (params.photoBuffer && params.photoExt) {
    photoFileName = `photo.${params.photoExt}`;
  }

  const finalRecord: PieceRecord = {
    ...params.record,
    audioFileName,
    photoFileName,
  };

  if (isVercelBlobEnabled()) {
    const id = params.record.id;
    await put(`pieces/${id}/${audioFileName}`, params.audioBuffer, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: params.record.audioMimeType || "audio/webm",
    });

    if (params.photoBuffer && photoFileName) {
      await put(`pieces/${id}/${photoFileName}`, params.photoBuffer, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: params.record.photoMimeType || "image/jpeg",
      });
    }

    await put(
      `pieces/${id}/piece.json`,
      JSON.stringify(finalRecord, null, 2),
      {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      }
    );

    return finalRecord;
  }

  const root = await getStorageRoot();
  const pieceDir = path.join(root, "pieces", params.record.id);
  await fs.mkdir(pieceDir, { recursive: true });
  await fs.writeFile(path.join(pieceDir, audioFileName), params.audioBuffer);

  if (params.photoBuffer && photoFileName) {
    await fs.writeFile(path.join(pieceDir, photoFileName), params.photoBuffer);
  }

  await fs.writeFile(
    path.join(pieceDir, "piece.json"),
    JSON.stringify(finalRecord, null, 2),
    "utf-8"
  );

  return finalRecord;
}

export async function getPieceById(id: string): Promise<PieceRecord | null> {
  const normalized = id.trim().toLowerCase();

  if (isVercelBlobEnabled()) {
    const blobData = await readPrivateBlobBuffer(
      `pieces/${normalized}/piece.json`
    );
    if (blobData) {
      try {
        return JSON.parse(blobData.buffer.toString("utf-8")) as PieceRecord;
      } catch {
        // continúa al fallback
      }
    }
    if (DEMO_SEEDS[normalized]) {
      return DEMO_SEEDS[normalized]().record;
    }
    return null;
  }

  const root = await getStorageRoot();
  const jsonPath = path.join(root, "pieces", normalized, "piece.json");

  try {
    const raw = await fs.readFile(jsonPath, "utf-8");
    return JSON.parse(raw) as PieceRecord;
  } catch {
    if (DEMO_SEEDS[normalized]) {
      return DEMO_SEEDS[normalized]().record;
    }
    return null;
  }
}

export async function getPieceMediaBuffer(
  id: string,
  kind: "audio" | "photo"
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const normalized = id.trim().toLowerCase();
  const piece = await getPieceById(normalized);
  if (!piece) return null;

  if (isVercelBlobEnabled()) {
    if (kind === "audio") {
      if (piece.audioFileName) {
        const media = await readPrivateBlobBuffer(
          `pieces/${normalized}/${piece.audioFileName}`
        );
        if (media) {
          return {
            buffer: media.buffer,
            mimeType: piece.audioMimeType || media.contentType || "audio/webm",
          };
        }
      }
      if (DEMO_SEEDS[normalized]) {
        return {
          buffer: DEMO_SEEDS[normalized]().audio,
          mimeType: "audio/wav",
        };
      }
      return null;
    }

    if (piece.photoFileName) {
      const media = await readPrivateBlobBuffer(
        `pieces/${normalized}/${piece.photoFileName}`
      );
      if (media) {
        return {
          buffer: media.buffer,
          mimeType: piece.photoMimeType || media.contentType || "image/jpeg",
        };
      }
    }
    return null;
  }

  const root = await getStorageRoot();

  if (kind === "audio") {
    if (piece.audioFileName) {
      try {
        const buf = await fs.readFile(
          path.join(root, "pieces", normalized, piece.audioFileName)
        );
        return { buffer: buf, mimeType: piece.audioMimeType || "audio/webm" };
      } catch {
        // Fallback a seed si corresponde
      }
    }
    if (DEMO_SEEDS[normalized]) {
      return {
        buffer: DEMO_SEEDS[normalized]().audio,
        mimeType: "audio/wav",
      };
    }
    return null;
  }

  if (piece.photoFileName) {
    try {
      const buf = await fs.readFile(
        path.join(root, "pieces", normalized, piece.photoFileName)
      );
      return { buffer: buf, mimeType: piece.photoMimeType || "image/jpeg" };
    } catch {
      return null;
    }
  }

  return null;
}

export async function listPieces(): Promise<PieceRecord[]> {
  const records: PieceRecord[] = [];

  if (isVercelBlobEnabled()) {
    try {
      const { blobs } = await list({ prefix: "pieces/" });
      const jsonBlobs = blobs.filter((b) => b.pathname.endsWith("/piece.json"));
      const loaded = await Promise.all(
        jsonBlobs.map(async (b) => {
          const res = await readPrivateBlobBuffer(b.pathname);
          if (!res) return null;
          try {
            return JSON.parse(res.buffer.toString("utf-8")) as PieceRecord;
          } catch {
            return null;
          }
        })
      );
      for (const item of loaded) {
        if (item) records.push(item);
      }
    } catch {
      // Fallback a seeds si el blob está vacío o inicializando
    }
  } else {
    const root = await getStorageRoot();
    const piecesDir = path.join(root, "pieces");
    try {
      const entries = await fs.readdir(piecesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          const raw = await fs.readFile(
            path.join(piecesDir, entry.name, "piece.json"),
            "utf-8"
          );
          records.push(JSON.parse(raw) as PieceRecord);
        } catch {
          // Ignora carpetas incompletas
        }
      }
    } catch {
      // Sin piezas creadas aún
    }
  }

  const existingIds = new Set(records.map((r) => r.id));
  for (const [seedId, build] of Object.entries(DEMO_SEEDS)) {
    if (!existingIds.has(seedId)) {
      records.push(build().record);
    }
  }

  return records.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function appendSupportReceipt(
  receipt: SupportReceiptRecord
): Promise<void> {
  if (isVercelBlobEnabled()) {
    await put(
      `receipts/${receipt.txHash}.json`,
      JSON.stringify(receipt, null, 2),
      {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      }
    );

    const piece = await getPieceById(receipt.pieceId);
    if (piece && !piece.isDemoSeed) {
      piece.supports = [receipt, ...(piece.supports || [])];
      await put(
        `pieces/${piece.id}/piece.json`,
        JSON.stringify(piece, null, 2),
        {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/json",
        }
      );
    } else if (piece && piece.isDemoSeed) {
      const seedAudio =
        DEMO_SEEDS[piece.id]?.().audio || generateSeedDemoWavBuffer();
      await savePieceWithMedia({
        record: {
          ...piece,
          isDemoSeed: false,
          supports: [receipt, ...(piece.supports || [])],
        },
        audioBuffer: seedAudio,
        audioExt: "wav",
      });
    }
    return;
  }

  const root = await getStorageRoot();
  const receiptPath = path.join(root, "receipts", `${receipt.txHash}.json`);
  await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2), "utf-8");

  const piece = await getPieceById(receipt.pieceId);
  if (piece && !piece.isDemoSeed) {
    piece.supports = [receipt, ...(piece.supports || [])];
    const pieceDir = path.join(root, "pieces", piece.id);
    await fs.writeFile(
      path.join(pieceDir, "piece.json"),
      JSON.stringify(piece, null, 2),
      "utf-8"
    );
  } else if (piece && piece.isDemoSeed) {
    const seedAudio = DEMO_SEEDS[piece.id]?.().audio || generateSeedDemoWavBuffer();
    await savePieceWithMedia({
      record: {
        ...piece,
        isDemoSeed: false,
        supports: [receipt, ...(piece.supports || [])],
      },
      audioBuffer: seedAudio,
      audioExt: "wav",
    });
  }
}

export async function getLocalReceiptByHash(
  txHash: string
): Promise<SupportReceiptRecord | null> {
  if (isVercelBlobEnabled()) {
    const blobData = await readPrivateBlobBuffer(`receipts/${txHash}.json`);
    if (!blobData) return null;
    try {
      return JSON.parse(blobData.buffer.toString("utf-8")) as SupportReceiptRecord;
    } catch {
      return null;
    }
  }

  const root = await getStorageRoot();
  try {
    const raw = await fs.readFile(
      path.join(root, "receipts", `${txHash}.json`),
      "utf-8"
    );
    return JSON.parse(raw) as SupportReceiptRecord;
  } catch {
    return null;
  }
}
