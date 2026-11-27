export const fieldPieceIds = [
  "pieza-01",
  "pieza-02",
  "pieza-03",
  "pieza-04",
  "pieza-05",
  "pieza-06",
] as const;

export type PieceFieldTest = {
  pieceId: (typeof fieldPieceIds)[number];
  craftOrRoom?: string;
  autonomousRecordingSeconds?: number;
  recordingObstacles?: string;
  perceivedVoiceValue?: string;
  foreignTouristPayments?: string;
  consignmentSettlement?: string;
  qrLeftOnPiece?: boolean;
  stellarTestnetTxHash?: string;
};

export type ProductIterationLearning = {
  title: string;
  observation: string;
  before: string;
  after: string;
};

export type FieldSessionSummary = {
  dateTime: string;
  venue: string;
  address: string;
  participantsSurveyed?: number;
  externalScans?: number;
  pieceTests: PieceFieldTest[];
  learnings: ProductIterationLearning[];
};

export const fieldSession: FieldSessionSummary = {
  dateTime: "Viernes 27/11 · 15:00 hs",
  venue: "Mercado Artesanal de Salta",
  address: "Av. San Martín 2555",
  // Completar solo con datos observados y autorizados para publicar.
  pieceTests: [],
  learnings: [],
};
