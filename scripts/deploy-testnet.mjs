#!/usr/bin/env node
// Compila, despliega TramaVivaContract en Testnet (admin = treasury, token = USDC SAC),
// guarda NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID en .env.local y regenera los bindings TS.
//   node scripts/deploy-testnet.mjs            → build + deploy + bindings
//   node scripts/deploy-testnet.mjs --bindings → solo bindings del contrato ya desplegado
import { resolve } from "node:path";
import { loadEnvLocal, ROOT, setEnvLocalVar, stellar } from "./lib/cli.mjs";

const env = loadEnvLocal();
const contractsDir = resolve(ROOT, "contracts");
const wasm = resolve(contractsDir, "target", "wasm32v1-none", "release", "trama_viva.wasm");
const bindingsDir = resolve(ROOT, "packages", "trama-viva-client");
const explorer = env.NEXT_PUBLIC_EXPLORER_BASE;
const onlyBindings = process.argv.includes("--bindings");

let contractId = env.NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID;

if (!onlyBindings) {
  console.log("→ stellar contract build");
  stellar(["contract", "build"], { cwd: contractsDir, quiet: false });

  console.log("→ stellar contract deploy (source = treasury)");
  contractId = stellar(
    [
      "contract", "deploy",
      "--wasm", `"${wasm}"`,
      "--source-account", "treasury",
      "--network", "testnet",
      "--alias", "trama_viva",
      "--",
      "--admin", env.TREASURY_PUBLIC_KEY,
      "--token", env.USDC_SAC_CONTRACT_ID,
    ],
    { quiet: false },
  )
    .split(/\s+/)
    .pop();
  if (!/^C[A-Z2-7]{55}$/.test(contractId)) throw new Error(`Contract ID inesperado: ${contractId}`);
  setEnvLocalVar("NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID", contractId);
  console.log(`✔ NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID=${contractId} guardado en .env.local`);
}

if (!contractId) throw new Error("Falta NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID");

console.log("→ stellar contract bindings typescript");
stellar(
  [
    "contract", "bindings", "typescript",
    "--network", "testnet",
    "--contract-id", contractId,
    "--output-dir", `"${bindingsDir}"`,
    "--overwrite",
  ],
  { quiet: false },
);
console.log(`✔ Bindings en ${bindingsDir}`);
console.log(`Contrato: ${explorer}/contract/${contractId}`);
