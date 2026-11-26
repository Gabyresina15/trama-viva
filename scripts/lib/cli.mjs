// Utilidades compartidas por los scripts: localizar la raíz, cargar .env.local,
// ejecutar Stellar CLI y enmascarar secretos.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const extraPaths = [
  process.env.STELLAR_CLI_DIR,
  "C:\\Program Files (x86)\\Stellar CLI",
  "C:\\Program Files\\Stellar CLI",
  process.env.USERPROFILE && join(process.env.USERPROFILE, ".cargo", "bin"),
  process.env.HOME && join(process.env.HOME, ".cargo", "bin"),
].filter((p) => p && existsSync(p));

const childEnv = {
  ...process.env,
  PATH: [...extraPaths, process.env.PATH ?? process.env.Path ?? ""].join(delimiter),
};
delete childEnv.Path;

export function stellar(args, { quiet = true, cwd = ROOT } = {}) {
  return execFileSync("stellar", args, {
    cwd,
    env: childEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", quiet ? "pipe" : "inherit"],
    shell: process.platform === "win32",
  }).trim();
}

export function mask(secret) {
  return secret ? `${secret.slice(0, 4)}…${secret.slice(-4)}` : "(vacío)";
}

export function loadEnvLocal() {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) throw new Error("Falta .env.local (corré: node scripts/gen-env-local.mjs)");
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (/^".*"$/.test(value)) value = value.slice(1, -1);
    if (process.env[m[1]] === undefined || process.env[m[1]] === "") process.env[m[1]] = value;
  }
  return process.env;
}

export function setEnvLocalVar(key, value) {
  const path = resolve(ROOT, ".env.local");
  const text = readFileSync(path, "utf8");
  const re = new RegExp(`^${key}=.*$`, "m");
  const next = re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.replace(/\n*$/, "\n")}${key}=${value}\n`;
  writeFileSync(path, next);
  process.env[key] = value;
}
