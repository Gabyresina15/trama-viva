// Server-side helpers para TramaVivaContract (Soroban, Stellar Testnet).
// Modo demo: TREASURY patrocina fees (fuente de cada tx) y actúa como billetera de
// cortesía del turista en `support_piece`; Sala y Artesana firman solo sus auth entries.
// No importar desde componentes cliente: usa secretos del entorno.
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Operation,
  StrKey,
  TransactionBuilder,
  contract,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import type { Client as TramaVivaBindings } from "../../../packages/trama-viva-client/src";

export interface RegisterPieceOnChainInput {
  pieceId: string;          // ej. "pieza_01" (<= 32 chars alfanuméricos + _)
  passportHashHex: string;  // 64 hex chars (32 bytes SHA-256)
  artisanAddress?: string;  // default: env ARTESANA_PUBLIC_KEY
  salaAddress?: string;     // default: env SALA_PUBLIC_KEY
  artisanBps: number;       // ej. 8500 (85.00 %)
}

export interface RegisterPieceOnChainResult {
  txHash: string;
  contractId: string;
  explorerTxUrl: string;
  explorerContractUrl: string;
}

export interface SupportPieceOnChainInput {
  pieceId: string;
  amountStroops: bigint;    // 1 USDC = 10_000_000n stroops
  holdInEscrow?: boolean;   // default: true si la artesana no tiene trustline activa
}

export interface SupportPieceOnChainResult {
  txHash: string;
  contractId: string;
  supporterAddress: string;
  artisanAmountStroops: string;
  salaAmountStroops: string;
  heldInContractEscrow: boolean;
  explorerTxUrl: string;
}

export interface VerifyReceiptResult {
  txHash: string;
  successful: boolean;
  ledger: number;
  createdAt: string;
  contractId: string;
  pieceId?: string;
  passportHashHex?: string;
  artisanAmountStroops?: string;
  salaAmountStroops?: string;
  heldInContractEscrow?: boolean;
  explorerTxUrl: string;
}

export interface ClaimArtisanEarningsOnChainInput {
  artisanAddress?: string;  // default: env ARTESANA_PUBLIC_KEY
  openTrustlineIfMissing?: boolean; // default: true (trustline patrocinada por TREASURY)
}

export interface ClaimArtisanEarningsOnChainResult {
  txHash: string;
  contractId: string;
  artisanAddress: string;
  claimedStroops: string;
  trustlineTxHash?: string;
  explorerTxUrl: string;
  explorerTrustlineTxUrl?: string;
}

type TramaVivaClient = contract.Client & TramaVivaBindings;

const CONTRACT_ERRORS: Record<number, string> = {
  1: "InvalidBps",
  2: "InvalidAmount",
  3: "PieceNotFound",
  4: "PieceAlreadyRegistered",
  5: "DuplicateSupport",
  6: "NothingToClaim",
  7: "Overflow",
  8: "PendingEscrowNotEmpty",
};

const PIECE_ID_RE = /^[A-Za-z0-9_]{1,32}$/;
const HASH_RE = /^[0-9a-fA-F]{64}$/;
const TX_HASH_RE = /^[0-9a-fA-F]{64}$/;

function env(name: string, fallback?: string): string {
  const raw = process.env[name] ?? fallback;
  const value = raw?.trim().replace(/^["']|["']$/g, "");
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function config() {
  const explorerBase = env("NEXT_PUBLIC_EXPLORER_BASE", "https://stellar.expert/explorer/testnet");
  return {
    rpcUrl: env("STELLAR_RPC_URL", "https://soroban-testnet.stellar.org"),
    horizonUrl: env("STELLAR_HORIZON_URL", "https://horizon-testnet.stellar.org"),
    networkPassphrase: env("STELLAR_PASSPHRASE", "Test SDF Network ; September 2015"),
    explorerBase,
    contractId: env(
      "NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID",
      "CDK6FDRZK5TQ544VDDXFPWXC3OEPXI2RQFA2MMASYIDVFKHG3YLSYIDR"
    ),
    usdcIssuer: env(
      "USDC_ISSUER",
      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
    ),
    usdcSacId: env(
      "USDC_SAC_CONTRACT_ID",
      "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
    ),
    treasury: Keypair.fromSecret(env("TREASURY_SECRET_KEY")),
    salaPublicKey: env(
      "SALA_PUBLIC_KEY",
      "GDOCBPHEP3JWETL5DUDNHECK4LUAJDMQFH2B7APBET3CAKSWXM3CTVP6"
    ),
    artisanPublicKey: env(
      "ARTESANA_PUBLIC_KEY",
      "GASRK6WN7ZNDXMUYPWGBL4NHMDVWZRNTPTQ75XFK37B3FH6SVNMVAHMY"
    ),
  };
}

const txUrl = (hash: string) => `${config().explorerBase}/tx/${hash}`;
const contractUrl = (id: string) => `${config().explorerBase}/contract/${id}`;

function knownSigners(): Map<string, Keypair> {
  const map = new Map<string, Keypair>();
  for (const name of ["TREASURY_SECRET_KEY", "SALA_SECRET_KEY", "ARTESANA_SECRET_KEY"]) {
    const secret = process.env[name];
    if (secret) {
      const kp = Keypair.fromSecret(secret);
      map.set(kp.publicKey(), kp);
    }
  }
  return map;
}

function signerFor(address: string): Keypair {
  const kp = knownSigners().get(address);
  if (!kp) throw new Error(`No hay clave configurada para firmar como ${address}`);
  return kp;
}

let clientPromise: Promise<TramaVivaClient> | null = null;
let clientKey = "";

function getClient(): Promise<TramaVivaClient> {
  const c = config();
  const key = `${c.contractId}|${c.rpcUrl}|${c.treasury.publicKey()}`;
  if (!clientPromise || key !== clientKey) {
    clientKey = key;
    const { signTransaction } = contract.basicNodeSigner(c.treasury, c.networkPassphrase);
    clientPromise = contract.Client.from<TramaVivaBindings>({
      contractId: c.contractId,
      rpcUrl: c.rpcUrl,
      networkPassphrase: c.networkPassphrase,
      publicKey: c.treasury.publicKey(),
      signTransaction,
    }).catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

function describeError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  const code = message.match(/Error\(Contract, #(\d+)\)/)?.[1];
  if (code && CONTRACT_ERRORS[Number(code)]) {
    return new Error(`TramaVivaContract: ${CONTRACT_ERRORS[Number(code)]} (#${code})`);
  }
  return err instanceof Error ? err : new Error(message);
}

interface ResultLike<T> {
  isErr(): boolean;
  unwrap(): T;
  unwrapErr(): { message: string };
}

type Unwrapped<T> = T extends ResultLike<infer U> ? U : T;

function unwrapResult<T>(value: T): Unwrapped<T> {
  if (value && typeof (value as unknown as ResultLike<unknown>).isErr === "function") {
    const r = value as unknown as ResultLike<Unwrapped<T>>;
    if (r.isErr()) throw new Error(`TramaVivaContract: ${r.unwrapErr().message}`);
    return r.unwrap();
  }
  return value as Unwrapped<T>;
}

function assertSimulationOk<T>(tx: contract.AssembledTransaction<T>) {
  if (tx.simulation && rpc.Api.isSimulationError(tx.simulation)) {
    throw describeError(new Error(tx.simulation.error));
  }
}

async function signAndSend<T>(tx: contract.AssembledTransaction<T>) {
  try {
    assertSimulationOk(tx);
    unwrapResult(tx.result);
    const passphrase = config().networkPassphrase;
    for (const address of tx.needsNonInvokerSigningBy()) {
      const { signAuthEntry } = contract.basicNodeSigner(signerFor(address), passphrase);
      await tx.signAuthEntries({ address, signAuthEntry });
    }
    const sent = await tx.signAndSend();
    const hash =
      sent.sendTransactionResponse?.hash ??
      (sent.getTransactionResponse as { txHash?: string } | undefined)?.txHash;
    if (!hash) throw new Error("No se obtuvo el hash de la transacción");
    return { hash, result: unwrapResult(sent.result) };
  } catch (err) {
    throw describeError(err);
  }
}

async function simulateRead<T>(
  build: () => Promise<contract.AssembledTransaction<T>>,
): Promise<Unwrapped<T>> {
  try {
    const tx = await build();
    assertSimulationOk(tx);
    return unwrapResult(tx.result);
  } catch (err) {
    throw describeError(err);
  }
}

async function hasUsdcTrustline(address: string): Promise<boolean> {
  const c = config();
  try {
    const account = await new Horizon.Server(c.horizonUrl).loadAccount(address);
    return account.balances.some(
      (b) =>
        "asset_code" in b &&
        "asset_issuer" in b &&
        b.asset_code === "USDC" &&
        b.asset_issuer === c.usdcIssuer &&
        ("is_authorized" in b ? b.is_authorized !== false : true),
    );
  } catch (err) {
    if ((err as { response?: { status?: number } }).response?.status === 404) return false;
    throw err;
  }
}

async function canReceiveToken(address: string, tokenId: string): Promise<boolean> {
  const c = config();
  if (address.startsWith("C")) return true;
  if (tokenId === Asset.native().contractId(c.networkPassphrase)) return true;
  if (tokenId === c.usdcSacId) return hasUsdcTrustline(address);
  return false;
}

export async function registerPieceOnChain(
  input: RegisterPieceOnChainInput,
): Promise<RegisterPieceOnChainResult> {
  const c = config();
  if (!PIECE_ID_RE.test(input.pieceId)) throw new Error("pieceId inválido (1-32 chars [A-Za-z0-9_])");
  if (!HASH_RE.test(input.passportHashHex)) throw new Error("passportHashHex debe tener 64 hex chars");
  if (!Number.isInteger(input.artisanBps) || input.artisanBps < 0 || input.artisanBps > 10_000) {
    throw new Error("artisanBps debe ser un entero entre 0 y 10000");
  }
  const client = await getClient();
  const tx = await client
    .register_piece({
      sala: input.salaAddress ?? c.salaPublicKey,
      piece_id: input.pieceId,
      artisan: input.artisanAddress ?? c.artisanPublicKey,
      passport_hash: Buffer.from(input.passportHashHex, "hex"),
      artisan_bps: input.artisanBps,
    })
    .catch((err) => {
      throw describeError(err);
    });
  const { hash } = await signAndSend(tx);
  return {
    txHash: hash,
    contractId: c.contractId,
    explorerTxUrl: txUrl(hash),
    explorerContractUrl: contractUrl(c.contractId),
  };
}

export async function supportPieceOnChain(
  input: SupportPieceOnChainInput,
): Promise<SupportPieceOnChainResult> {
  const c = config();
  if (!PIECE_ID_RE.test(input.pieceId)) throw new Error("pieceId inválido (1-32 chars [A-Za-z0-9_])");
  if (typeof input.amountStroops !== "bigint" || input.amountStroops <= BigInt(0)) {
    throw new Error("amountStroops debe ser un bigint > 0");
  }
  const client = await getClient();
  let holdInEscrow = input.holdInEscrow;
  if (holdInEscrow === undefined) {
    const [piece, cfg] = await Promise.all([
      simulateRead(() => client.get_piece({ piece_id: input.pieceId })),
      simulateRead(() => client.get_config()),
    ]);
    if (!piece) throw new Error(`TramaVivaContract: PieceNotFound (${input.pieceId})`);
    holdInEscrow = !(await canReceiveToken(piece.artisan, cfg.token));
  }
  const supporter = c.treasury.publicKey();
  const tx = await client
    .support_piece({
      supporter,
      piece_id: input.pieceId,
      amount: input.amountStroops,
      hold_in_escrow: holdInEscrow,
    })
    .catch((err) => {
      throw describeError(err);
    });
  const { hash, result } = await signAndSend(tx);
  const [artisanAmount, salaAmount] = result;
  return {
    txHash: hash,
    contractId: c.contractId,
    supporterAddress: supporter,
    artisanAmountStroops: artisanAmount.toString(),
    salaAmountStroops: salaAmount.toString(),
    heldInContractEscrow: holdInEscrow && artisanAmount > BigInt(0),
    explorerTxUrl: txUrl(hash),
  };
}

async function openSponsoredUsdcTrustline(artisan: Keypair): Promise<string> {
  const c = config();
  const horizon = new Horizon.Server(c.horizonUrl);
  const source = await horizon.loadAccount(c.treasury.publicKey());
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: c.networkPassphrase })
    .addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: artisan.publicKey() }))
    .addOperation(
      Operation.changeTrust({ asset: new Asset("USDC", c.usdcIssuer), source: artisan.publicKey() }),
    )
    .addOperation(Operation.endSponsoringFutureReserves({ source: artisan.publicKey() }))
    .setTimeout(180)
    .build();
  tx.sign(c.treasury, artisan);
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}

export async function getArtisanPendingBalanceOnChain(
  artisanAddress?: string
): Promise<{ artisanAddress: string; contractId: string; pendingStroops: string }> {
  const c = config();
  const target = artisanAddress ?? c.artisanPublicKey;
  const client = await getClient();
  const pending = await simulateRead(() =>
    client.get_pending_balance({ artisan: target })
  );
  return {
    artisanAddress: target,
    contractId: c.contractId,
    pendingStroops: pending.toString(),
  };
}

export async function claimArtisanEarningsOnChain(
  input: ClaimArtisanEarningsOnChainInput = {},
): Promise<ClaimArtisanEarningsOnChainResult> {
  const c = config();
  const artisanAddress = input.artisanAddress ?? c.artisanPublicKey;
  const artisanKp = signerFor(artisanAddress);
  const client = await getClient();

  const [pending, cfg] = await Promise.all([
    simulateRead(() => client.get_pending_balance({ artisan: artisanAddress })),
    simulateRead(() => client.get_config()),
  ]);
  if (pending <= BigInt(0)) throw new Error("TramaVivaContract: NothingToClaim (#6)");

  let trustlineTxHash: string | undefined;
  if (
    input.openTrustlineIfMissing !== false &&
    cfg.token === c.usdcSacId &&
    !(await hasUsdcTrustline(artisanAddress))
  ) {
    trustlineTxHash = await openSponsoredUsdcTrustline(artisanKp);
  }

  const tx = await client.claim({ artisan: artisanAddress }).catch((err) => {
    throw describeError(err);
  });
  const { hash, result } = await signAndSend(tx);
  return {
    txHash: hash,
    contractId: c.contractId,
    artisanAddress,
    claimedStroops: result.toString(),
    trustlineTxHash,
    explorerTxUrl: txUrl(hash),
    explorerTrustlineTxUrl: trustlineTxHash ? txUrl(trustlineTxHash) : undefined,
  };
}

interface DecodedEvent {
  name: string;
  topics: unknown[];
  data: Record<string, unknown>;
}

function decodeContractEvents(events: xdr.ContractEvent[], contractId: string): DecodedEvent[] {
  const out: DecodedEvent[] = [];
  for (const ev of events) {
    const id = ev.contractId;
    if (!id || StrKey.encodeContract(Buffer.from(id.toBytes())) !== contractId) continue;
    const body = ev.body.v0;
    const topics = body.topics.map((t) => scValToNative(t));
    const data = scValToNative(body.data);
    out.push({
      name: String(topics[0]),
      topics,
      data: data && typeof data === "object" ? (data as Record<string, unknown>) : {},
    });
  }
  return out;
}

const toHex = (v: unknown) =>
  v instanceof Uint8Array ? Buffer.from(v).toString("hex") : undefined;

export async function verifyReceiptFromChain(txHash: string): Promise<VerifyReceiptResult> {
  const c = config();
  if (!TX_HASH_RE.test(txHash)) throw new Error("txHash inválido (64 hex chars)");
  const hash = txHash.toLowerCase();
  const base = { txHash: hash, contractId: c.contractId, explorerTxUrl: txUrl(hash) };

  const server = new rpc.Server(c.rpcUrl);
  const res = await server.getTransaction(hash);

  if (res.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    // Fuera de la ventana de retención del RPC: datos básicos desde Horizon.
    const tx = await new Horizon.Server(c.horizonUrl).transactions().transaction(hash).call();
    return {
      ...base,
      successful: tx.successful,
      ledger: tx.ledger_attr,
      createdAt: new Date(tx.created_at).toISOString(),
    };
  }

  const receipt: VerifyReceiptResult = {
    ...base,
    successful: res.status === rpc.Api.GetTransactionStatus.SUCCESS,
    ledger: res.ledger,
    createdAt: new Date(Number(res.createdAt) * 1000).toISOString(),
  };

  const events = decodeContractEvents(res.events?.contractEventsXdr?.flat() ?? [], c.contractId);
  const supported = events.find((e) => e.name === "piece_supported");
  const registered = events.find((e) => e.name === "piece_registered");
  const ev = supported ?? registered;
  if (ev) {
    receipt.pieceId = String(ev.topics[1]);
    receipt.passportHashHex = toHex(ev.data.passport_hash);
  }
  if (supported) {
    receipt.artisanAmountStroops = String(supported.data.artisan_amount);
    receipt.salaAmountStroops = String(supported.data.sala_amount);
    receipt.heldInContractEscrow = Boolean(supported.data.hold_in_escrow);
  }
  return receipt;
}
