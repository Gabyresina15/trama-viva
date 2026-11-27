import type { SplitPresetId } from "@/lib/types/trama";

export const LANGUAGE_OPTIONS = [
  { id: "es", label: "ES · Original" },
  { id: "en", label: "EN · English" },
  { id: "pt", label: "PT · Português" },
] as const;

export type Language = (typeof LANGUAGE_OPTIONS)[number]["id"];

type UiCopy = {
  language: string;
  loading: string;
  loadError: string;
  tag: (id: string) => string;
  unlinkedTitle: string;
  unlinkedDescription: string;
  recordVoice: (id: string) => string;
  createdBy: (name: string) => string;
  demoBadge: string;
  playVoice: string;
  pauseVoice: string;
  voiceTitle: string;
  voiceDescription: string;
  captions: string;
  translationNote: string;
  shareGift: string;
  giftMessage: string;
  giftCopied: string;
  technique: string;
  materials: string;
  makingTime: string;
  supportTitle: string;
  supportDescription: string;
  splitRoles: Record<SplitPresetId, { artisan: string; sala: string }>;
  supportError: string;
  sending: string;
  send: (amount: number) => string;
  testnetNotice: string;
  seal: string;
  audit: string;
};

export const UI_COPY: Record<Language, UiCopy> = {
  es: {
    language: "Idioma de la página",
    loading: "Cargando relato de la pieza…",
    loadError: "No pudimos cargar el relato de esta pieza. Volvé a intentarlo.",
    tag: (id) => `Etiqueta ${id}`,
    unlinkedTitle: "Esta etiqueta está libre para vincular una pieza",
    unlinkedDescription:
      "Sacale una foto a la artesanía y grabá 20 segundos con la voz de quien la creó para activar este código QR.",
    recordVoice: (id) => `Grabar la voz de ${id} ahora →`,
    createdBy: (name) => `Creada por ${name}`,
    demoBadge: "Demo en Testnet",
    playVoice: "Escuchar voz",
    pauseVoice: "Pausar voz",
    voiceTitle: "Escuchá la voz original de quien la hizo",
    voiceDescription: "Grabación auténtica sellada con fecha y huella digital",
    captions: "Relato / Subtítulos",
    translationNote: "Traducción automática a partir de la voz original en español.",
    shareGift: "¿Es para regalar? Compartir historia y voz",
    giftMessage: "Te regalo esta pieza artesanal. Escuchá su historia en la voz de quien la hizo:",
    giftCopied: "Mensaje y enlace copiados. Ya podés compartirlos.",
    technique: "Técnica",
    materials: "Materiales",
    makingTime: "Tiempo de labor",
    supportTitle: "Enviar reconocimiento directo en dólares digitales",
    supportDescription:
      "Sin cuentas bancarias locales ni intermediarios que retengan la plata: una sola operación reparte al instante y deja comprobante público.",
    splitRoles: {
      sala_colectiva: {
        artisan: "Artesana autora (custodia Soroban sin intermediarios)",
        sala: "Asociación / Sala del Mercado Artesanal",
      },
      taller_compartido: {
        artisan: "Autora principal de la pieza",
        sala: "Hilado, tintes naturales y taller",
      },
      artesano_directo: {
        artisan: "Artesano/a creador/a",
        sala: "Fondo común de sala y feria",
      },
      directo_100: { artisan: "Artesano/a creador/a", sala: "Sin retención de sala (0 %)" },
    },
    supportError: "No se pudo completar el envío. Volvé a intentarlo.",
    sending: "Liquidando reparto en Stellar…",
    send: (amount) => `Enviar ${amount} USDC directo →`,
    testnetNotice: "Demostración gratuita en Stellar Testnet (sin cargos ni billetera previa).",
    seal: "Sello SHA-256:",
    audit: "Auditar contrato en Stellar Expert ↗",
  },
  en: {
    language: "Page language",
    loading: "Loading this piece’s story…",
    loadError: "We couldn’t load this piece’s story. Please try again.",
    tag: (id) => `Tag ${id}`,
    unlinkedTitle: "This tag is ready to link to a piece",
    unlinkedDescription:
      "Take a photo of the piece and record 20 seconds of its maker speaking to activate this QR code.",
    recordVoice: (id) => `Record the voice for ${id} now →`,
    createdBy: (name) => `Made by ${name}`,
    demoBadge: "Testnet demo",
    playVoice: "Play voice recording",
    pauseVoice: "Pause voice recording",
    voiceTitle: "Hear the voice of the person who made it",
    voiceDescription: "Original recording sealed with a date and digital fingerprint",
    captions: "Story / Captions",
    translationNote: "Automatically translated from the original Spanish recording.",
    shareGift: "Giving it as a gift? Share the story and voice",
    giftMessage: "This handmade piece is a gift for you. Hear its story in the maker’s own voice:",
    giftCopied: "Message and link copied. They’re ready to share.",
    technique: "Technique",
    materials: "Materials",
    makingTime: "Time to make",
    supportTitle: "Support the maker directly in digital dollars",
    supportDescription:
      "No local bank account or intermediary holding the money: one transaction splits the payment instantly and creates a public receipt.",
    splitRoles: {
      sala_colectiva: {
        artisan: "Maker (held in Soroban escrow without intermediaries)",
        sala: "Association / Artisan Market hall",
      },
      taller_compartido: {
        artisan: "Lead maker",
        sala: "Spinning, natural dyes, and workshop",
      },
      artesano_directo: {
        artisan: "Maker",
        sala: "Shared fund for the market hall and fair",
      },
      directo_100: { artisan: "Maker", sala: "No market hall share (0%)" },
    },
    supportError: "We couldn’t complete the payment. Please try again.",
    sending: "Settling the split on Stellar…",
    send: (amount) => `Send ${amount} USDC directly →`,
    testnetNotice: "Free demo on Stellar Testnet (no fees or existing wallet required).",
    seal: "SHA-256 seal:",
    audit: "Audit the contract on Stellar Expert ↗",
  },
  pt: {
    language: "Idioma da página",
    loading: "Carregando a história da peça…",
    loadError: "Não conseguimos carregar a história desta peça. Tente novamente.",
    tag: (id) => `Etiqueta ${id}`,
    unlinkedTitle: "Esta etiqueta está pronta para vincular a uma peça",
    unlinkedDescription:
      "Tire uma foto da peça e grave 20 segundos da voz de quem a criou para ativar este código QR.",
    recordVoice: (id) => `Gravar agora a voz para ${id} →`,
    createdBy: (name) => `Criada por ${name}`,
    demoBadge: "Demonstração na Testnet",
    playVoice: "Ouvir a gravação",
    pauseVoice: "Pausar a gravação",
    voiceTitle: "Ouça a voz de quem fez esta peça",
    voiceDescription: "Gravação autêntica selada com data e impressão digital",
    captions: "História / Legendas",
    translationNote: "Tradução automática a partir da gravação original em espanhol.",
    shareGift: "É para presente? Compartilhe a história e a voz",
    giftMessage: "Esta peça artesanal é um presente para você. Ouça a história na voz de quem a criou:",
    giftCopied: "Mensagem e link copiados. Já pode compartilhar.",
    technique: "Técnica",
    materials: "Materiais",
    makingTime: "Tempo de produção",
    supportTitle: "Apoie diretamente quem fez a peça em dólares digitais",
    supportDescription:
      "Sem conta bancária local nem intermediários retendo o dinheiro: uma única transação divide o pagamento na hora e gera um comprovante público.",
    splitRoles: {
      sala_colectiva: {
        artisan: "Artesã criadora (custódia no Soroban sem intermediários)",
        sala: "Associação / Sala do Mercado de Artesanato",
      },
      taller_compartido: {
        artisan: "Criadora principal da peça",
        sala: "Fiação, tingimento natural e oficina",
      },
      artesano_directo: {
        artisan: "Artesão ou artesã",
        sala: "Fundo comum da sala e da feira",
      },
      directo_100: { artisan: "Artesão ou artesã", sala: "Sem repasse à sala (0%)" },
    },
    supportError: "Não foi possível concluir o pagamento. Tente novamente.",
    sending: "Efetuando a divisão na Stellar…",
    send: (amount) => `Enviar ${amount} USDC diretamente →`,
    testnetNotice: "Demonstração gratuita na Stellar Testnet (sem taxas nem carteira prévia).",
    seal: "Selo SHA-256:",
    audit: "Auditar o contrato no Stellar Expert ↗",
  },
};
