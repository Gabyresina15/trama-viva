#!/usr/bin/env node
// Genera/actualiza .env.local a partir de .env.example completando los secretos
// S... con `stellar keys secret <alias>`. Nunca imprime los secretos completos.
// Conserva los valores ya presentes en .env.local (ej. NEXT_PUBLIC_TRAMA_VIVA_CONTRACT_ID, GEMINI_API_KEY).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { stellar, mask, ROOT } from "./lib/cli.mjs";

const examplePath = resolve(ROOT, ".env.example");
const localPath = resolve(ROOT, ".env.local");

const SECRETS = {
  TREASURY_SECRET_KEY: "treasury",
  SALA_SECRET_KEY: "sala",
  ARTESANA_SECRET_KEY: "artesana",
};

const parse = (text) => {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
};

const existing = existsSync(localPath) ? parse(readFileSync(localPath, "utf8")) : new Map();
const lines = readFileSync(examplePath, "utf8").split(/\r?\n/);
const seen = new Set();

const out = lines.map((line) => {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) return line;
  const [, key, exampleValue] = m;
  seen.add(key);
  if (SECRETS[key]) {
    const secret = stellar(["keys", "secret", SECRETS[key]]);
    if (!/^S[A-Z2-7]{55}$/.test(secret)) throw new Error(`Secreto inválido para ${SECRETS[key]}`);
    console.log(`${key}=${mask(secret)}`);
    return `${key}=${secret}`;
  }
  const prev = existing.get(key);
  return `${key}=${prev !== undefined && prev !== "" ? prev : exampleValue}`;
});

for (const [key, value] of existing) {
  if (!seen.has(key)) out.push(`${key}=${value}`);
}

writeFileSync(localPath, out.join("\n").replace(/\n*$/, "\n"));
console.log(`.env.local escrito en ${localPath}`);
