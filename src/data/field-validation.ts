export interface VerifiedProblemSource {
  id: string;
  actorOrStudy: string;
  finding: string;
  sourceLabel: string;
  sourceUrl: string;
}

export interface PaymentRailComparison {
  rail: string;
  estimatedCostOn10kArs: string;
  netForSplit85_15: string;
  verdict: string;
}

export interface ProductIterationLearning {
  title: string;
  source: string;
  observation: string;
  before: string;
  after: string;
}

export interface ExternalUsabilityCheck {
  id: string;
  profile: string;
  pieceTested: string;
  completedWithoutHelp: boolean;
  secondsElapsed?: number;
  feedbackQuote: string;
  stellarTestnetTxHash: string;
}

export const verifiedProblemSources: VerifiedProblemSource[] = [
  {
    id: "rosa-giron-2026",
    actorOrStudy: "Rosa Girón · 30 años tejedora en el Mercado Artesanal de Salta",
    finding:
      "Señala que vivir exclusivamente de la artesanía hoy no alcanza porque el visitante 'recorre, conoce, pero compra muy poco': el cuello de botella principal es convertir la visita en compra mostrando el valor humano real detrás de la obra.",
    sourceLabel: "Informate Salta (julio 2026)",
    sourceUrl:
      "https://informatesalta.com.ar/sociedad/dia-nacional-de-la-tejedora--la-lucha-de-las-artesanas-saltenas-por-mantener-vivo-el-oficio_a6a55497bf24534712196f194",
  },
  {
    id: "tartagal-margen",
    actorOrStudy: "Artesanas del interior salteño (Tartagal) y redes de comercio justo",
    finding:
      "Viajar a Salta Capital encarece la venta directa, y en esquemas intermediados tradicionales de comercio justo al productor suele llegarle entre 40 % y 60 % del precio final. Un acuerdo 85 % / 15 % registrado mejora su participación por pieza vendida.",
    sourceLabel: "El Tribuno Salta (2024) · La Nación (WFTO)",
    sourceUrl:
      "https://www.eltribuno.com/salta/2024-3-19-14-38-0-en-su-dia-artesanos-afirmaron-que-bajaron-las-ventas",
  },
  {
    id: "renatep-informalidad",
    actorOrStudy: "Registro Nacional de Trabajadores de la Economía Popular (Renatep)",
    finding:
      "En el universo que incluye artesanos y feriantes, solo 10,5 % cuenta con monotributo general y 9,7 % monotributo social (~80 % opera fuera del circuito bancario formal), justificando custodiar fondos en contrato antes del alta financiera.",
    sourceLabel: "SomosPymes (datos Renatep)",
    sourceUrl:
      "https://www.somospymes.com.ar/informes/uno-cada-diez-cartoneros-vendedores-ambulantes-o-artesanos-esta-inscriptos-el-monotributo-n5392319",
  },
  {
    id: "antecedentes-qr",
    actorOrStudy: "Mapeo de antecedentes (Someone Somewhere · CINIA + Fonselp · MP)",
    finding:
      "Ya existen etiquetas QR que cuentan la historia del artesano y ya existe el cobro con QR en pesos, pero ninguno une en la pieza física de un mercado público la voz oral autenticada con el reparto automático 85/15 y contabilidad para la sala.",
    sourceLabel: "CINIA + Fonselp · Gobierno de Salta",
    sourceUrl:
      "https://fonselp.org/es/blog/simplificando-impacto-social-cinia-fonselp",
  },
];

export const paymentRailsComparison: PaymentRailComparison[] = [
  {
    rail: "Mercado Pago QR (dinero en cuenta local)",
    estimatedCostOn10kArs: "~97 ARS (0,97 % IVA inc.)",
    netForSplit85_15: "~9.903 ARS",
    verdict: "Conviene mantenerlo para compradores locales en pesos.",
  },
  {
    rail: "Mercado Pago QR (tarjeta de crédito extranjera)",
    estimatedCostOn10kArs: "~1.090 ARS (~10,9 % con recargo + IVA)",
    netForSplit85_15: "~8.910 ARS",
    verdict: "Castiga el margen en ventas a turistas internacionales.",
  },
  {
    rail: "Stellar USDC directo + rampa/Anchor bajo spread (~0,4 % – 1 %)",
    estimatedCostOn10kArs: "Red < 1 ARS + conversión ~40 a 140 ARS",
    netForSplit85_15: "~9.860 a 9.960 ARS",
    verdict:
      "Ideal para quien ya opera USDC o pagos/aportes desde el exterior, acumulando retiros en el contrato.",
  },
  {
    rail: "Tarjeta vía MoonPay / retiros chicos con mínimo fijo",
    estimatedCostOn10kArs: "No viable en tickets bajos (mínimo US$ 3,99)",
    netForSplit85_15: "Descartado en mostrador chico",
    verdict:
      "Por eso NO forzamos compra cripto con tarjeta en tickets bajos ni prometemos ahorro mágico de comisión.",
  },
];

export const productLearnings: ProductIterationLearning[] = [
  {
    title: "1. Alinear incentivos para que la Sala / Tienda quiera adoptar las etiquetas",
    source: "Mentoría de producto y modelo de negocio con Darío Sánchez (BAF × Stellar)",
    observation:
      "Si el sistema se presenta solo como 'sacarle el dinero al local en el acto para dárselo al productor', el comerciante que administra el mostrador pierde flujo de caja y frena la implementación.",
    before:
      "Enfoque centrado únicamente en reemplazar el cobro del mostrador para acelerar el pago al artesano.",
    after:
      "Modelo de beneficio mutuo (Win-Win): en ventas locales en pesos la sala mantiene su caja habitual, mientras que la etiqueta con voz tracciona más conversión de compra por transparencia demostrada y le genera a la Sala un 15 % automático nuevo en cobros a extranjeros con USDC y reconocimientos/encargos post-venta (incluso cuando la pieza se regala).",
  },
  {
    title: "2. Custodia on-chain real para artesanas aún no incorporadas",
    source: "Auditoría de arquitectura con Stellar Raven (Trustless Work V1 vs. Soroban + SAC)",
    observation:
      "En Stellar, una cuenta clásica G... no puede recibir USDC por SAC sin haber abierto antes su trustline, y Trustless Work V1 congela los receptores al fondear sin ejecutar un split atómico único en mostrador.",
    before:
      "Hipótesis inicial de pago dividido simple o escrow por hitos externos.",
    after:
      "Construcción de TramaVivaContract en Soroban sobre el SAC oficial de Circle USDC: liquida en el acto el 15 % a la Sala y resguarda el 85 % en el propio contrato hasta que la artesana ejecuta claim con apertura patrocinada de reserva y trustline.",
  },
  {
    title: "3. Honestidad económica: trazabilidad y reparto programable por encima de 'comisión cero'",
    source: "Relevamiento tarifario real (Mercado Pago, ARQ, Belo, Ripio, Lemon y Stellar)",
    observation:
      "En tickets chicos en pesos, convertir de pesos a cripto y de vuelta cuesta más que el 0,97 % de Mercado Pago con dinero en cuenta; el ahorro real aparece frente a tarjetas extranjeras (~10,9 %) y al retirar saldos acumulados.",
    before:
      "Discurso genérico de 'pagos cripto siempre más baratos que los medios locales'.",
    after:
      "Posicionamiento honesto: Stellar aporta el reparto automático 85/15 auditable, la custodia sin intermediarios y el canal global en USDC para turistas y diáspora, conviviendo con medios locales para el público nacional.",
  },
];

export const externalUsabilityChecks: ExternalUsabilityCheck[] = [
  {
    id: "tx-verificada-usdc-escrow",
    profile: "Prueba E2E verificada en Stellar Testnet (2,00 USDC reales de Circle)",
    pieceTested: "pieza-demo-telar",
    completedWithoutHelp: true,
    feedbackQuote:
      "Ejecución completa verificada en el Ledger #5940373: 0,30 USDC liquidados a la Sala y 1,70 USDC retenidos en custodia dentro del contrato CDK6…SYIDR con coincidencia exacta de huella SHA-256.",
    stellarTestnetTxHash:
      "2a7965b7f44edbe276a049bef49f85c459d4efa08afd7ddb5bd1b407ceeaf856",
  },
  {
    id: "tx-verificada-claim-artesana",
    profile: "Prueba E2E de retiro de artesana con apertura patrocinada de trustline",
    pieceTested: "smoke_mwy0l3x2",
    completedWithoutHelp: true,
    feedbackQuote:
      "Apertura automática de trustline USDC patrocinada por tesorería (beginSponsoringFutureReserves) seguida de invocación exitosa a claim() transfiriendo el 85 % acumulado a la cuenta de la artesana.",
    stellarTestnetTxHash:
      "9f97b490a3be4064e3f4c03bc96fa366452e895e0c434a28c5020c9d5bcd8d0d",
  },
];
