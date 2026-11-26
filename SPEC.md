# SPEC · Trama Viva (Hackathon FLAT 2026 · BAF × Stellar)

> **Fuente única de verdad entre agentes (Devin + Antigravity).**
> **Regla anti-colisión de archivos:**
> - **Devin** es dueño exclusivo de: `contracts/`, `packages/`, `scripts/` y `src/lib/stellar/`.
> - **Antigravity** es dueño exclusivo de: `src/lib/ai/`, `src/lib/types/`, `src/app/` y `public/`.

---

## 1. Qué construimos
**Trama Viva** conecta piezas reales de artesanos y salas colectivas del **Mercado Artesanal de Salta** con compradores y turistas internacionales:
1. En el puesto o taller, el artesano/referente saca una foto y graba **20 segundos de voz** contando quién hizo la pieza, de qué localidad/paraje viene, técnica y materiales.
2. El pipeline multimodal (Grok STT `grok-voice-transcribe-2.0` + estructuración JSON validada con **Zod**) genera el **Pasaporte Cultural Trilingüe (`ES / EN / PT`)** sin tocar montos ni direcciones financieras.
3. Se calcula el `SHA-256` canónico (`passport_hash`, 32 bytes) del paquete `{ v, pieceId, audioSha256, salaAddress, artisanAddress, artisanBps }` y la Sala certificadora lo registra en el contrato **Soroban (`TramaVivaContract`)**.
4. El turista escanea el QR con cualquier celular (cero extensiones cripto, fees patrocinados en Testnet), escucha la voz real con subtítulos en su idioma y envía apoyo/pago en **USDC**.
5. **Una sola invocación a `TramaVivaContract.support_piece`** reparte de forma atómica usando el **Stellar Asset Contract (SAC)**:
   - Transfiere en el acto el porcentaje de sostén (`ej. 15 %`) a la cuenta `G...` de la **Sala / Asociación**.
   - Custodia en el propio balance del contrato `C...` el porcentaje de la **Artesana autora del interior** (`ej. 85 %`) aunque ella **todavía no tenga trustline de USDC activa**, registrando su saldo reclamable en `persistent` storage y emitiendo eventos observables en **Stellar Expert**.
6. Cuando la artesana activa su cobro, `claim` abre su trustline (si falta) y retira el 100 % de su saldo acumulado desde el contrato `C...` a su cuenta `G...`.

---

## 2. Red, Cuentas y Activos en Stellar Testnet

- **Network:** `testnet`
- **Network Passphrase:** `Test SDF Network ; September 2015`
- **Soroban RPC:** `https://soroban-testnet.stellar.org`
- **Horizon URL:** `https://horizon-testnet.stellar.org`
- **Explorer:** `https://stellar.expert/explorer/testnet`

### Identidades locales creadas en Stellar CLI (`~/.config/stellar/identity/*.toml`)
- **`treasury`** (Admin, pagador de fees / billetera de cortesía demo):
  `GDYGARGZK7ZCUV3ZHRB3CE7MNUKFTUCPS4FOZAT4HYZZLC73EKJRAKBO`
- **`sala`** (Sala / Asociación certificadora del Mercado Artesanal):
  `GDOCBPHEP3JWETL5DUDNHECK4LUAJDMQFH2B7APBET3CAKSWXM3CTVP6`
- **`artesana`** (Artesana autora del interior; arranca SIN trustline USDC para demostrar custodia en el contrato `C...`):
  `GASRK6WN7ZNDXMUYPWGBL4NHMDVWZRNTPTQ75XFK37B3FH6SVNMVAHMY`

### Activo principal: Circle Testnet USDC (vía SAC)
- **Classic Asset:** `USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
- **USDC SAC Contract ID (`C...`):** `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`
- **Nota crítica sobre SAC y cuentas `G...`:** En Soroban, para que una cuenta clásica `G...` (`treasury` o `sala`) reciba o envíe un activo clásico vía SAC (`TokenClient::transfer`), esa cuenta `G...` **debe tener abierta su trustline clásica** (`Operation.changeTrust`). En cambio, el contrato Soroban (`env.current_contract_address()`, dirección `C...`) recibe y custodia USDC en `ContractData` **sin necesitar trustline**, permitiendo retener los fondos de `artesana` antes de que ella abra su trustline.

---

## 3. Contrato Soroban (`contracts/trama_viva`) — Criterios obligatorios del jurado

El contrato debe cumplir explícitamente los 5 puntos de evaluación técnica del evento:
1. **Costo de recursos controlado:** aritmética entera determinística (`i128` y `u32` en basis points `0..=10000`), cero punto flotante, estructuras compactas `#[contracttype]`. **Prohibido guardar datos personales sensibles en cadena** (solo `Symbol`/`String` de ID corto, `Address` y `BytesN<32>`).
2. **Almacenamiento correcto + manejo explícito de TTL (`extend_ttl`):**
   - `instance()`: configuración global (`Admin`, `Token` SAC address) con `extend_ttl`.
   - `persistent()`: `Piece(Symbol)` → `{ sala: Address, artisan: Address, passport_hash: BytesN<32>, artisan_bps: u32, total_supported: i128 }` y `PendingBalance(Address)` → `i128`, llamando siempre a `.extend_ttl(&key, threshold, extend_to)`.
   - `temporary()`: guarda anti-doble-envío reciente `RecentSupport(Address, Symbol)` por pocos ledgers para evitar doble clic accidental desde móvil.
3. **Autorización (`require_auth()`):**
   - `__constructor(env, admin: Address, token: Address)`
   - `set_token(env, new_token: Address)` → exige `admin.require_auth()` (permite alternar entre USDC de Circle y un token SAC de respaldo si el faucet limita).
   - `register_piece(env, sala: Address, piece_id: Symbol, artisan: Address, passport_hash: BytesN<32>, artisan_bps: u32)` → exige `sala.require_auth()`, valida `artisan_bps <= 10000` y que `piece_id` no se sobrescriba sin permiso.
   - `support_piece(env, supporter: Address, piece_id: Symbol, amount: i128, hold_in_escrow: bool) -> (i128, i128)` → exige `supporter.require_auth()`, valida `amount > 0`, calcula `artisan_amount = (amount * artisan_bps) / 10000` y `sala_amount = amount - artisan_amount`. Transfiere `sala_amount` a `piece.sala` (si `> 0`) y, si `hold_in_escrow` es `true`, transfiere `artisan_amount` a `env.current_contract_address()` incrementando `PendingBalance(piece.artisan)` (si es `false`, transfiere directo a `piece.artisan`). Devuelve `(artisan_amount, sala_amount)`.
   - `claim(env, artisan: Address) -> i128` → exige `artisan.require_auth()`, transfiere el `PendingBalance(artisan)` completo desde `env.current_contract_address()` hacia `artisan` y deja el saldo pendiente en `0`.
   - Vistas de lectura: `get_piece(env, piece_id: Symbol)`, `get_pending_balance(env, artisan: Address)`, `get_config(env)`.
4. **Eventos publicados:** emitir eventos claros en `register_piece`, `support_piece` (incluyendo `piece_id`, `supporter`, `artisan_amount`, `sala_amount`, `hold_in_escrow`, `passport_hash`) y `claim`.
5. **Suite de tests (`src/test.rs`):** mínimo 5 tests en `cargo test` verificando constructor/registro, rechazo sin `require_auth`, cálculo exacto de split sin pérdida de stroops, flujo completo de escrow en el contrato + `claim`, y rechazo de doble clic/monto inválido.

---

## 4. Interfaz `src/lib/stellar/index.ts` (Contrato entre Devin y Antigravity)

Devin expondrá funciones server-side limpias en `src/lib/stellar/index.ts` para que las rutas API de Next.js (`src/app/api/*`) las consuman sin lidiar con XDR crudo:

```ts
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
```
