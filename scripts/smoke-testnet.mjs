// Smoke test end-to-end de TramaVivaContract en Stellar Testnet usando src/lib/stellar/index.ts.
//
// Uso:  node scripts/smoke-testnet.mjs        (Node >= 23.6: importa TypeScript con type stripping)
//
// Si TREASURY no tiene USDC, el flujo corre con el SAC nativo de XLM (set_token), y al final
// restaura set_token al SAC de USDC. Para probar con USDC real:
//   1. Abrí https://faucet.circle.com/
//   2. Elegí "Stellar" + "Testnet" y pegá la dirección de TREASURY:
//      GDYGARGZK7ZCUV3ZHRB3CE7MNUKFTUCPS4FOZAT4HYZZLC73EKJRAKBO
//      (requiere la trustline USDC creada por scripts/setup-trustlines.mjs)
//   3. Volvé a correr este script: usará USDC. Al hacer claim, si la Artesana no tiene
//      trustline USDC, TREASURY se la abre patrocinada (sponsored reserves).
//   4. `--keep-escrow=2` agrega un apoyo de 2 USDC en escrow sin claim (saldo vivo en el contrato).
import { createHash } from "node:crypto";
import { Asset, Horizon } from "@stellar/stellar-sdk";
import { loadEnvLocal, stellar } from "./lib/cli.mjs";

loadEnvLocal();
const lib = await import("../src/lib/stellar/index.ts");

const env = process.env;
const CONTRACT_ID = env.NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID;
const USDC_SAC = env.USDC_SAC_CONTRACT_ID;
const EXPLORER = env.NEXT_PUBLIC_EXPLORER_BASE ?? "https://stellar.expert/explorer/testnet";
const NATIVE_SAC = Asset.native().contractId(env.STELLAR_PASSPHRASE);
const AMOUNT = 10_000_000n; // 1 unidad (7 decimales)
const ARTISAN_BPS = 8500;
// --keep-escrow=2 → apoyo extra de 2 unidades con escrow que queda sin reclamar (demo de retiro en la UI).
const keepArg = process.argv.find((a) => a.startsWith("--keep-escrow="));
const KEEP_ESCROW = keepArg ? BigInt(Math.round(Number(keepArg.split("=")[1]) * 1e7)) : 0n;

if (!CONTRACT_ID) throw new Error("Falta NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID (corré scripts/deploy-testnet.mjs)");

const links = [];
const log = (label, url) => {
  links.push([label, url]);
  console.log(`  ${label}: ${url}`);
};

function invokeAdmin(fn, ...args) {
  const out = stellar(
    ["contract", "invoke", "--id", CONTRACT_ID, "--source-account", "treasury", "--network", "testnet",
      "--send=yes", "--", fn, ...args],
    { quiet: true },
  );
  return out;
}

function readConfig() {
  return JSON.parse(
    stellar(["contract", "invoke", "--id", CONTRACT_ID, "--source-account", "treasury", "--network", "testnet",
      "--send=no", "--", "get_config"]),
  );
}

async function treasuryUsdcBalance() {
  const account = await new Horizon.Server(env.STELLAR_HORIZON_URL).loadAccount(env.TREASURY_PUBLIC_KEY);
  const line = account.balances.find((b) => b.asset_code === "USDC" && b.asset_issuer === env.USDC_ISSUER);
  return line ? Number(line.balance) : 0;
}

console.log(`\nTramaVivaContract: ${CONTRACT_ID}`);
console.log(`  ${EXPLORER}/contract/${CONTRACT_ID}`);

const usdc = await treasuryUsdcBalance();
const useUsdc = usdc >= 1;
const token = useUsdc ? USDC_SAC : NATIVE_SAC;
console.log(`\nTREASURY USDC: ${usdc} → token de prueba: ${useUsdc ? "USDC SAC" : "XLM nativo SAC"} (${token})`);
if (!useUsdc) {
  console.log("  Sin USDC: pedí USDC de Testnet en https://faucet.circle.com/ para");
  console.log(`  ${env.TREASURY_PUBLIC_KEY} y volvé a correr el smoke test.`);
}

let switched = false;
try {
  const initial = readConfig();
  if (initial.token !== token) {
    console.log(`\n[1] set_token → ${token}`);
    invokeAdmin("set_token", "--new_token", token);
    switched = true;
    console.log(`  token actual: ${readConfig().token}`);
  } else {
    console.log("\n[1] set_token: el contrato ya usa el token de prueba");
  }

  const pieceId = `smoke_${Date.now().toString(36)}`;
  const passportHashHex = createHash("sha256")
    .update(JSON.stringify({ pieceId, sala: "Sala Colectiva Mercado Artesanal de Salta", tecnica: "telar criollo" }))
    .digest("hex");

  console.log(`\n[2] registerPieceOnChain(${pieceId}, ${ARTISAN_BPS} bps)`);
  const reg = await lib.registerPieceOnChain({ pieceId, passportHashHex, artisanBps: ARTISAN_BPS });
  log("register tx", reg.explorerTxUrl);

  console.log(`\n[3] supportPieceOnChain(${AMOUNT} stroops, holdInEscrow=true)`);
  const sup = await lib.supportPieceOnChain({ pieceId, amountStroops: AMOUNT, holdInEscrow: true });
  console.log(`  artesana=${sup.artisanAmountStroops} sala=${sup.salaAmountStroops} escrow=${sup.heldInContractEscrow}`);
  if (BigInt(sup.artisanAmountStroops) + BigInt(sup.salaAmountStroops) !== AMOUNT) throw new Error("El reparto no suma el total");
  log("support tx", sup.explorerTxUrl);

  console.log("\n[4] doble clic inmediato (debe rechazarse con DuplicateSupport)");
  try {
    await lib.supportPieceOnChain({ pieceId, amountStroops: AMOUNT, holdInEscrow: true });
    console.log("  AVISO: el segundo apoyo pasó (la ventana temporal de 6 ledgers ya había expirado)");
  } catch (err) {
    console.log(`  rechazado: ${err.message}`);
  }

  console.log("\n[5] verifyReceiptFromChain(support tx)");
  const receipt = await lib.verifyReceiptFromChain(sup.txHash);
  console.log(`  ${JSON.stringify(receipt)}`);
  if (!receipt.successful || receipt.pieceId !== pieceId || receipt.passportHashHex !== passportHashHex) {
    throw new Error("El recibo on-chain no coincide con el apoyo");
  }

  console.log("\n[6] claimArtisanEarningsOnChain()");
  const claim = await lib.claimArtisanEarningsOnChain();
  console.log(`  reclamado: ${claim.claimedStroops} stroops`);
  if (claim.explorerTrustlineTxUrl) log("trustline USDC artesana (patrocinada)", claim.explorerTrustlineTxUrl);
  log("claim tx", claim.explorerTxUrl);
  console.log(`  pendiente total en contrato: ${readConfig().total_pending}`);

  if (KEEP_ESCROW > 0n) {
    console.log(`\n[6b] supportPieceOnChain(${KEEP_ESCROW} stroops, holdInEscrow=true) SIN claim`);
    let kept;
    for (let attempt = 0; !kept; attempt++) {
      try {
        kept = await lib.supportPieceOnChain({ pieceId, amountStroops: KEEP_ESCROW, holdInEscrow: true });
      } catch (err) {
        if (!/DuplicateSupport/.test(err.message) || attempt >= 12) throw err;
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    console.log(`  artesana=${kept.artisanAmountStroops} (custodiado) sala=${kept.salaAmountStroops}`);
    log("support escrow tx", kept.explorerTxUrl);
    console.log(`  pendiente artesana en contrato: ${readConfig().total_pending}`);
  }
} finally {
  if (switched) {
    console.log(`\n[7] restaurar set_token → USDC SAC ${USDC_SAC}`);
    invokeAdmin("set_token", "--new_token", USDC_SAC);
  }
  console.log(`  token final: ${readConfig().token}`);
}

console.log(`\nContract ID: ${CONTRACT_ID}`);
console.log(`  contrato: ${EXPLORER}/contract/${CONTRACT_ID}`);
for (const [label, url] of links) console.log(`  ${label}: ${url}`);
console.log(`  treasury: ${EXPLORER}/account/${env.TREASURY_PUBLIC_KEY}`);
console.log(`  artesana: ${EXPLORER}/account/${env.ARTESANA_PUBLIC_KEY}`);
