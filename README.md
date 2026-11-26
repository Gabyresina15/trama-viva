# Trama Viva — La voz viva de quien lo hizo y un pago directo a su mano

> **Hackathon SIN COORDENADAS · FLAT 2026 (BAF × Stellar)**
> **Ejes:** Memoria · Territorio · Arte — *Mercado Artesanal de Salta y talleres del interior salteño*

---

## 1. Qué es el proyecto

**Trama Viva** es una aplicación web móvil que vincula cada pieza artesanal auténtica (tejidos en telar criollo, cestería en chaguar/simbol, alfarería y platería) con **la voz real grabada de quien la creó** y un **canal de liquidación y custodia directa en USDC sobre Stellar Soroban**.

En el **Mercado Artesanal de Salta** (Av. San Martín 2555, Salta Capital) conviven salas gestionadas por asociaciones y cooperativas que comercializan por consignación piezas elaboradas por artesanas y artesanos de parajes alejados (Valles Calchaquíes, Puna y Chaco salteño). Cuando la pieza llega al mostrador ocurren dos desconexiones:
1. **Pérdida de memoria oral:** quien compra o recibe la artesanía como regalo nunca escucha la voz, el origen ni el tiempo de labor de su autora.
2. **Fricción de cobro y liquidación:** un turista extranjero sin cuenta bancaria argentina ni CUIT no puede usar alias locales (Mercado Pago), y en ventas intermediadas la artesana del interior suele no contar con cuenta en dólares ni liquidación transparente e inmediata.

Con **Trama Viva**, registrar una pieza toma menos de 45 segundos: una foto y un audio corto de 20 segundos generan un **Pasaporte Cultural Trilingüe (`ES / EN / PT`)** sellado criptográficamente (`SHA-256`) en **Soroban**, enlazado a una etiqueta QR lista para escanear desde cualquier celular sin instalar extensiones.

---

## 2. El modelo de negocio

*(Validado a nivel de problema en campo; monetización planteada como hipótesis de escalabilidad comercial)*:

1. **Comisión transaccional liviana (`2 %` sobre pagos y reconocimientos internacionales en USDC):** descontada de forma transparente y atómica solo cuando ingresa un pago transfronterizo exitoso, muy por debajo del costo y fricción de terminales internacionales o giros tradicionales.
2. **Licencia B2B / SaaS para mercados artesanales, cooperativas y museos (`Suscripción institucional`):** provisión de etiquetas QR pre-seriadas, panel de trazabilidad de salas colectivas y liquidación automática de consignaciones para organismos provinciales de cultura, redes de comercio justo (como cooperativas textiles del Gran Chaco y Valles) y tiendas de museos en toda Latinoamérica.

---

## 3. Por qué blockchain (y qué componentes existentes de Stellar reutilizamos)

Una base de datos tradicional puede almacenar un archivo de audio, pero **no puede liquidar dólares digitales sin fronteras en 5 segundos ni custodiar fondos de forma programable sin que un intermediario toque el dinero**.

### Decisión de arquitectura validada con Stellar Raven (`Trustless Work V1` vs. `Soroban + USDC SAC`)

Consultamos **Stellar Raven** para evaluar si convenía resolver el reparto mediante *Trustless Work V1 (multi-release)* o construir `TramaVivaContract` sobre el **SAC oficial de Circle USDC**. El análisis arrojó dos razones técnicas determinantes para nuestra arquitectura:

1. **Liquidación atómica vs. hitos independientes:** en el mostrador del Mercado Artesanal necesitamos que **una sola transacción atómica** liquide en el acto la parte de la Sala (`15 %`) y asigne la parte de la autora (`85 %`), no hitos separados aprobados manualmente.
2. **Artesanas aún no incorporadas (*un-onboarded artisans* sin trustline USDC):** en Stellar, una transferencia SAC hacia una cuenta clásica `G...` no saltea el requisito de tener abierta la *trustline* de USDC, y *Trustless Work V1* congela los receptores al fondear exigiendo *trustline* previa al pago. Con `TramaVivaContract`, los USDC de la artesana quedan retenidos en el balance del propio contrato (`PendingBalance` en `persistent` storage con `extend_ttl`), y al momento del retiro (`claim`) patrocinamos la apertura de su *trustline* (`beginSponsoringFutureReserves` + `changeTrust` + `endSponsoringFutureReserves`) antes de transferirle los fondos.
3. **Transparencia sobre custodia y modelo de claves:** a nivel contrato, ni el `admin` ni la `sala` pueden retirar ni redirigir el `PendingBalance` de la artesana (`artisan.require_auth()`). En este MVP sobre Testnet las firmas se gestionan en servidor para validar experiencia sin fricción en campo (por lo que no lo describimos como auto-custodia en el cliente actual); la hoja de ruta a Mainnet vincula esa autorización a **Passkeys (WebAuthn Smart Wallets)** en el teléfono de la artesana junto con rampa de salida local (**SEP-24**) a pesos argentinos.

- **Stellar Asset Contract (SAC — `SEP-41`) oficial de Circle USDC en Testnet** (`CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`): permite a nuestro contrato interactuar nativamente con USDC mediante `soroban_sdk::token::TokenClient`.
- **Contrato Inteligente `TramaVivaContract` en Soroban (Rust / WASM):**
  - **Reparto atómico + Escrow sin intermediarios (`support_piece`):** en una sola transacción transfiere el porcentaje de sostén (`ej. 15 %`) a la cuenta de la Sala/Asociación y, cuando la artesana del interior aún no activó su billetera o *trustline*, **retiene su `85 %` en custodia dentro del propio contrato Soroban (`Contract balances`)** a su nombre exclusivo hasta que ella ejecuta `claim` con su firma (`require_auth()`).
  - **Privacidad e inmutabilidad responsable:** en la cadena jamás se exponen nombres personales ni archivos privados; únicamente se sella la huella `SHA-256` (`BytesN<32>`) del paquete canónico `{ v, pieceId, audioSha256, salaAddress, artisanAddress, artisanBps }`.
  - **Buenas prácticas de recursos y estado en Soroban:** separación de almacenamiento `instance()` (configuración global), `persistent()` (registro de piezas y saldos en custodia con renovación explícita de `extend_ttl`) y `temporary()` (protección anti-doble envío), emisión de eventos indexables y suite de tests unitarios en `cargo test`.
- **Stellar SDK v17 (`@stellar/stellar-sdk`) + Horizon & Soroban RPC:** verificación pública en tiempo real en `/r/[hash]`, recalculando el `SHA-256` de los bytes originales del audio contra el registro en la cadena.
- **Stellar Skills (`stellar/stellar-dev-skill`):** integrado en `.agents/skills/` para garantizar patrones actualizados de seguridad, `TTL` y `SAC`.

---

## 4. Beneficios para el usuario

- **Para la artesana o artesano creador:**
  - Registra su obra hablando 20 segundos con su propia voz, sin llenar formularios complejos ni saber inglés.
  - Su porcentaje queda protegido por código en el contrato Soroban desde el primer segundo, sin depender de planillas manuales ni custodios, listo para retirar cuando quiera (`claim`).
- **Para la Sala Colectiva / Asociación del Mercado Artesanal:**
  - Recibe automáticamente su porcentaje de sostenimiento en el mismo bloque y ofrece un certificado cultural vivo que eleva el valor percibido de cada pieza auténtica frente a imitaciones industriales.
- **Para el comprador o turista extranjero:**
  - Escanea el QR con la cámara normal de su teléfono, escucha la voz original subtitulada en **español, inglés o portugués**, conoce la técnica y materiales reales, y envía USDC en segundos viendo exactamente en un recibo público auditable adónde llegó cada centavo.

---

## 5. Evidencia en Stellar Testnet y Enlaces de Entrega

- **Aplicación en vivo (Testnet):** [`https://trama-viva-cjwf.vercel.app/`](https://trama-viva-cjwf.vercel.app/)
- **Video de demostración (2–3 min, público):** *(completar URL de YouTube / Loom)*
- **Contrato Soroban desplegado en Testnet (`TramaVivaContract`):**
  [`CDK6FDRZK5TQ544VDDXFPWXC3OEPXI2RQFA2MMASYIDVFKHG3YLSYIDR`](https://stellar.expert/explorer/testnet/contract/CDK6FDRZK5TQ544VDDXFPWXC3OEPXI2RQFA2MMASYIDVFKHG3YLSYIDR)
- **Hashes de transacciones reales con Circle USDC verificadas en Stellar Testnet:**
  - Despliegue del contrato (`deploy`): [`44d68a642a2730faec82bc45d9dc3f94f879881e941db0c872f9875dcb5db5f4`](https://stellar.expert/explorer/testnet/tx/44d68a642a2730faec82bc45d9dc3f94f879881e941db0c872f9875dcb5db5f4)
  - Registro de pieza (`register_piece`): [`6326bc0a7d83f5e3ea51446d85c5adca46be5c578fa02eda24f161f179e9d865`](https://stellar.expert/explorer/testnet/tx/6326bc0a7d83f5e3ea51446d85c5adca46be5c578fa02eda24f161f179e9d865)
  - Pago atómico en USDC con custodia en contrato (`support_piece` — 85 % en escrow + 15 % a Sala): [`384d74e672ff3f9ec0271d75108f62f6a253cbce76b1b720645751470783d06d`](https://stellar.expert/explorer/testnet/tx/384d74e672ff3f9ec0271d75108f62f6a253cbce76b1b720645751470783d06d) y [`2a7965b7f44edbe276a049bef49f85c459d4efa08afd7ddb5bd1b407ceeaf856`](https://stellar.expert/explorer/testnet/tx/2a7965b7f44edbe276a049bef49f85c459d4efa08afd7ddb5bd1b407ceeaf856)
  - Apertura patrocinada de trustline USDC para la artesana (`beginSponsoringFutureReserves` + `changeTrust`): [`8642c52ea7c1fdc1f3b0f21a8bc22b1d7be85266dc7df048192151dc5ed067ec`](https://stellar.expert/explorer/testnet/tx/8642c52ea7c1fdc1f3b0f21a8bc22b1d7be85266dc7df048192151dc5ed067ec)
  - Retiro de USDC custodiados en el contrato (`claim`): [`9f97b490a3be4064e3f4c03bc96fa366452e895e0c434a28c5020c9d5bcd8d0d`](https://stellar.expert/explorer/testnet/tx/9f97b490a3be4064e3f4c03bc96fa366452e895e0c434a28c5020c9d5bcd8d0d)

---

## 6. Cómo correr el proyecto localmente

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno y configurar claves Testnet + XAI_API_KEY
cp .env.example .env.local

# 3. Correr tests del contrato Soroban (dentro de contracts/trama_viva)
cargo test

# 4. Iniciar servidor de desarrollo
npm run dev
```

> **Nota transparente:** Proyecto desplegado sobre **Stellar Testnet** utilizando tokens demostrativos sin valor monetario real para validación tecnológica y de experiencia de usuario en campo.
