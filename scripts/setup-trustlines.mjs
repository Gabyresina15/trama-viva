#!/usr/bin/env node
// Abre la trustline clásica USDC (Circle Testnet) en `treasury` y `sala`.
// `artesana` queda SIN trustline a propósito: su parte se custodia en el contrato C...
import { Asset, BASE_FEE, Horizon, Keypair, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { loadEnvLocal } from "./lib/cli.mjs";

const env = loadEnvLocal();
const horizon = new Horizon.Server(env.STELLAR_HORIZON_URL);
const usdc = new Asset("USDC", env.USDC_ISSUER);
const explorer = env.NEXT_PUBLIC_EXPLORER_BASE;

const usdcLine = (account) =>
  account.balances.find(
    (b) => b.asset_type !== "native" && b.asset_code === "USDC" && b.asset_issuer === env.USDC_ISSUER,
  );

const targets = [
  { alias: "treasury", secret: env.TREASURY_SECRET_KEY, publicKey: env.TREASURY_PUBLIC_KEY },
  { alias: "sala", secret: env.SALA_SECRET_KEY, publicKey: env.SALA_PUBLIC_KEY },
];

for (const { alias, secret, publicKey } of targets) {
  const kp = Keypair.fromSecret(secret);
  if (kp.publicKey() !== publicKey) throw new Error(`${alias}: el secreto no corresponde a ${publicKey}`);
  const account = await horizon.loadAccount(kp.publicKey());
  const line = usdcLine(account);
  if (line) {
    console.log(`✔ ${alias} ya tiene trustline USDC (balance ${line.balance}) → ${explorer}/account/${publicKey}`);
    continue;
  }
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: env.STELLAR_PASSPHRASE })
    .addOperation(Operation.changeTrust({ asset: usdc }))
    .setTimeout(180)
    .build();
  tx.sign(kp);
  const res = await horizon.submitTransaction(tx);
  console.log(`✔ ${alias} trustline USDC abierta → ${explorer}/tx/${res.hash}`);
}

const artesana = await horizon.loadAccount(env.ARTESANA_PUBLIC_KEY);
if (usdcLine(artesana)) {
  console.warn(`⚠ artesana YA tiene trustline USDC; la demo de custodia en el contrato pierde sentido.`);
} else {
  console.log(`✔ artesana sin trustline USDC (a propósito) → ${explorer}/account/${env.ARTESANA_PUBLIC_KEY}`);
}
