import {
  Address,
  Contract,
  Networks,
  TransactionBuilder,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import {
  claimArtisanEarningsOnChain,
  registerPieceOnChain,
  supportPieceOnChain,
  verifyReceiptFromChain,
  VerifyReceiptResult,
} from "@/lib/stellar";
import {
  calculateDeterministicSplit,
  sha256Hex,
  stroopsToUsdcString,
  toSorobanPieceSymbol,
} from "@/lib/types/trama";

const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_EXPLORER_BASE ||
  "https://stellar.expert/explorer/testnet";

function isLiveSorobanConfigured(): boolean {
  const contractId = process.env.NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID?.trim();
  const treasurySecret = process.env.TREASURY_SECRET_KEY?.trim();
  const salaSecret = process.env.SALA_SECRET_KEY?.trim();
  return Boolean(
    contractId &&
      /^C[A-Z2-7]{55}$/.test(contractId) &&
      treasurySecret &&
      /^S[A-Z2-7]{55}$/.test(treasurySecret) &&
      salaSecret &&
      /^S[A-Z2-7]{55}$/.test(salaSecret)
  );
}

export interface BridgeRegisterInput {
  pieceId: string;
  passportHashHex: string;
  artisanBps: number;
  salaAddress?: string;
  artisanAddress?: string;
}

export interface BridgeRegisterOutput {
  txHash: string;
  contractId: string;
  explorerTxUrl: string;
  explorerContractUrl: string;
  chainMode: "soroban_testnet" | "preview_local";
}

export async function registerPieceBridge(
  input: BridgeRegisterInput
): Promise<BridgeRegisterOutput> {
  if (isLiveSorobanConfigured()) {
    const res = await registerPieceOnChain({
      pieceId: toSorobanPieceSymbol(input.pieceId),
      passportHashHex: input.passportHashHex,
      artisanBps: input.artisanBps,
      salaAddress: input.salaAddress,
      artisanAddress: input.artisanAddress,
    });
    return {
      ...res,
      chainMode: "soroban_testnet",
    };
  }

  const contractId =
    process.env.NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID?.trim() ||
    "PENDIENTE_CONTRACT_ID_EN_ENV";
  const previewHash = sha256Hex(
    `preview_reg:${input.pieceId}:${input.passportHashHex}:${Date.now()}`
  );
  return {
    txHash: previewHash,
    contractId,
    explorerTxUrl: `${EXPLORER_BASE}/tx/${previewHash}`,
    explorerContractUrl: contractId.startsWith("C")
      ? `${EXPLORER_BASE}/contract/${contractId}`
      : EXPLORER_BASE,
    chainMode: "preview_local",
  };
}

export interface BridgeSupportInput {
  pieceId: string;
  amountUsdc: number;
  artisanBps: number;
  artisanAddress: string;
  salaAddress?: string;
  passportHashHex: string;
  holdInEscrow?: boolean;
}

export interface BridgeSupportOutput {
  txHash: string;
  contractId: string;
  supporterAddress: string;
  totalStroops: string;
  artisanStroops: string;
  salaStroops: string;
  heldInContractEscrow: boolean;
  explorerTxUrl: string;
  chainMode: "soroban_testnet" | "preview_local";
}

export async function supportPieceBridge(
  input: BridgeSupportInput
): Promise<BridgeSupportOutput> {
  const split = calculateDeterministicSplit(input.amountUsdc, input.artisanBps);

  if (isLiveSorobanConfigured()) {
    const symbol = toSorobanPieceSymbol(input.pieceId);
    const holdInEscrow = input.holdInEscrow ?? true;
    let res;
    try {
      res = await supportPieceOnChain({
        pieceId: symbol,
        amountStroops: split.totalStroops,
        holdInEscrow,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Si apoyan una pieza semilla de muestra que aún no fue registrada on-chain,
      // la registramos primero y luego ejecutamos el apoyo atómico.
      if (msg.includes("PieceNotFound")) {
        await registerPieceOnChain({
          pieceId: symbol,
          passportHashHex: input.passportHashHex,
          artisanBps: input.artisanBps,
          salaAddress: input.salaAddress,
          artisanAddress: input.artisanAddress,
        });
        res = await supportPieceOnChain({
          pieceId: symbol,
          amountStroops: split.totalStroops,
          holdInEscrow,
        });
      } else {
        throw err;
      }
    }

    const totalBig =
      BigInt(res.artisanAmountStroops) + BigInt(res.salaAmountStroops);

    return {
      txHash: res.txHash,
      contractId: res.contractId,
      supporterAddress: res.supporterAddress,
      totalStroops: totalBig.toString(),
      artisanStroops: res.artisanAmountStroops,
      salaStroops: res.salaAmountStroops,
      heldInContractEscrow: res.heldInContractEscrow,
      explorerTxUrl: res.explorerTxUrl,
      chainMode: "soroban_testnet",
    };
  }

  const contractId =
    process.env.NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID?.trim() ||
    "PENDIENTE_CONTRACT_ID_EN_ENV";
  const defaultTreasuryPk =
    process.env.TREASURY_PUBLIC_KEY ||
    "GDYGARGZK7ZCUV3ZHRB3CE7MNUKFTUCPS4FOZAT4HYZZLC73EKJRAKBO";
  const previewHash = sha256Hex(
    `preview_support:${input.pieceId}:${split.totalStroops.toString()}:${Date.now()}`
  );
  return {
    txHash: previewHash,
    contractId,
    supporterAddress: defaultTreasuryPk,
    totalStroops: split.totalStroops.toString(),
    artisanStroops: split.artisanStroops.toString(),
    salaStroops: split.salaStroops.toString(),
    heldInContractEscrow: true,
    explorerTxUrl: `${EXPLORER_BASE}/tx/${previewHash}`,
    chainMode: "preview_local",
  };
}

export interface PendingEscrowStatus {
  artisanAddress: string;
  contractId: string;
  pendingStroops: string;
  pendingUsdcFormatted: string;
  chainMode: "soroban_testnet" | "preview_local";
}

export async function getArtisanPendingBalanceBridge(): Promise<PendingEscrowStatus> {
  const artisanAddress =
    process.env.ARTESANA_PUBLIC_KEY ||
    "GASRK6WN7ZNDXMUYPWGBL4NHMDVWZRNTPTQ75XFK37B3FH6SVNMVAHMY";
  const contractId =
    process.env.NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID?.trim() || "";
  const rpcUrl =
    process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
  const passphrase = process.env.STELLAR_PASSPHRASE || Networks.TESTNET;

  if (contractId && /^C[A-Z2-7]{55}$/.test(contractId)) {
    try {
      const server = new rpc.Server(rpcUrl);
      const source = await server.getAccount(artisanAddress);
      const contractInstance = new Contract(contractId);
      const tx = new TransactionBuilder(source, {
        fee: "100",
        networkPassphrase: passphrase,
      })
        .addOperation(
          contractInstance.call(
            "get_pending_balance",
            new Address(artisanAddress).toScVal()
          )
        )
        .setTimeout(30)
        .build();

      const sim = await server.simulateTransaction(tx);
      if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
        const val = BigInt(scValToNative(sim.result.retval));
        return {
          artisanAddress,
          contractId,
          pendingStroops: val.toString(),
          pendingUsdcFormatted: stroopsToUsdcString(val),
          chainMode: "soroban_testnet",
        };
      }
    } catch {
      // Fallback limpio si el RPC tarda
    }
  }

  return {
    artisanAddress,
    contractId: contractId || "PENDIENTE_CONTRACT_ID_EN_ENV",
    pendingStroops: "0",
    pendingUsdcFormatted: "0.00",
    chainMode: contractId ? "soroban_testnet" : "preview_local",
  };
}

export interface BridgeClaimOutput {
  txHash: string;
  claimedStroops: string;
  claimedUsdcFormatted: string;
  artisanAddress: string;
  trustlineTxHash?: string;
  explorerTxUrl: string;
  chainMode: "soroban_testnet" | "preview_local";
}

export async function claimArtisanBridge(): Promise<BridgeClaimOutput> {
  if (isLiveSorobanConfigured()) {
    const res = await claimArtisanEarningsOnChain({
      openTrustlineIfMissing: true,
    });
    return {
      txHash: res.txHash,
      claimedStroops: res.claimedStroops,
      claimedUsdcFormatted: stroopsToUsdcString(res.claimedStroops),
      artisanAddress: res.artisanAddress,
      trustlineTxHash: res.trustlineTxHash,
      explorerTxUrl: res.explorerTxUrl,
      chainMode: "soroban_testnet",
    };
  }

  const artisanAddress =
    process.env.ARTESANA_PUBLIC_KEY ||
    "GASRK6WN7ZNDXMUYPWGBL4NHMDVWZRNTPTQ75XFK37B3FH6SVNMVAHMY";
  const previewHash = sha256Hex(`preview_claim:${artisanAddress}:${Date.now()}`);
  return {
    txHash: previewHash,
    claimedStroops: "42500000",
    claimedUsdcFormatted: "4.25",
    artisanAddress,
    explorerTxUrl: `${EXPLORER_BASE}/tx/${previewHash}`,
    chainMode: "preview_local",
  };
}

export interface LiveChainVerification extends Partial<VerifyReceiptResult> {
  foundOnTestnet: boolean;
  successful: boolean;
  explorerTxUrl: string;
}

export async function verifyTxOnLiveTestnet(
  txHash: string
): Promise<LiveChainVerification> {
  const explorerTxUrl = `${EXPLORER_BASE}/tx/${txHash}`;
  if (!/^[a-fA-F0-9]{64}$/.test(txHash)) {
    return {
      foundOnTestnet: false,
      successful: false,
      explorerTxUrl,
    };
  }

  try {
    const verified = await verifyReceiptFromChain(txHash);
    return {
      ...verified,
      foundOnTestnet: true,
    };
  } catch {
    return {
      foundOnTestnet: false,
      successful: false,
      explorerTxUrl,
    };
  }
}
