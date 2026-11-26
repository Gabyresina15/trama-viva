# PLAN DE TRABAJO DETALLADO · COMPAÑERO + SU AGENTE DE IA

> **Proyecto:** Trama Viva — *La voz viva de quien lo hizo y un pago directo a su mano*
> **Hackathon:** SIN COORDENADAS · FLAT 2026 (BAF × Stellar)
> **App en producción (HTTPS vivo):** `https://trama-viva-cjwf.vercel.app/`
> **Repositorio GitHub:** `https://github.com/Gabyresina15/trama-viva`
> **Contrato Soroban desplegado en Testnet:** `CDK6FDRZK5TQ544VDDXFPWXC3OEPXI2RQFA2MMASYIDVFKHG3YLSYIDR`

Este documento está escrito para que **vos y tu agente de IA** (Cursor, Claude Code, Antigravity, Windsurf o el que uses) tengan **contexto total del sistema, reglas claras para no romper producción ni pisar archivos con Gabriel, prompts listos para copiar/pegar y el cronograma completo hasta ganar el sábado a las 23:59 ART**.

---

## 0. Qué ya está funcionando HOY (Jueves 26/11)

1. **Contrato Inteligente en Stellar Soroban (`contracts/trama_viva/src/lib.rs`):**
   - Ya compilado, con `6/6` tests pasando y desplegado en Stellar Testnet (`CDK6FDRZK5TQ544VDDXFPWXC3OEPXI2RQFA2MMASYIDVFKHG3YLSYIDR`).
   - Recibe **USDC reales de Circle Testnet** vía Stellar Asset Contract (SAC): cuando un comprador apoya una pieza en consignación (`support_piece`), el contrato transfiere el `15 %` en el acto a la cuenta de la Sala y **retiene el `85 %` en custodia dentro del propio contrato** para la artesana autora hasta que ella ejecuta `claim`.
2. **Backend y Rutas API en Next.js 16 (`src/app/api/*`):**
   - `POST /api/pieces`: recibe foto + audio grabado en celular, transcribe y traduce a `ES / EN / PT` con IA validada por **Zod**, calcula el `SHA-256` canónico y registra la pieza en el contrato Soroban.
   - `POST /api/support`: ejecuta el pago atómico en USDC Testnet sobre el contrato Soroban.
   - `GET / POST /api/claim`: lee el saldo real en custodia del contrato (`hoy tiene 1.70 USDC vivos`) y permite retirarlo en 1 clic.
   - `GET /api/receipt/[hash]`: reconstruye y audita cualquier recibo directamente desde los eventos on-chain de Soroban y recalcula el `SHA-256` del audio.
3. **Pantallas móviles actuales:**
   - `/` (portada + estado del contrato + acceso a etiquetas `pieza-01`..`pieza-06`)
   - `/crear` (grabador de voz + cámara comprimida para 4G + presets de reparto)
   - `/p/[id]` (vista del turista: reproductor de voz + subtítulos `ES/EN/PT` + envío de 2/5/10 USDC sin wallet)
   - `/r/[hash]` (comprobante criptográfico auditable con link a Stellar Expert)
   - `/artesana` (panel de retiro en 1 clic desde la custodia del contrato Soroban)

---

## 1. Trámites obligatorios tuyos HOY antes de dormir (10 min)

Si falta alguno de estos dos pasos administrativos, **el equipo entero puede quedar invalidado**:
1. **Formulario de la web del evento:** completalo con tus datos en `https://sincoordenada-argentina.netlify.app/` (no hay que crearse cuenta en Netlify; es solo llenar el formulario al pie de esa página). Asegurate de recibir el mail *"SIN COORDENADAS · Ya estás adentro"*.
2. **Cuenta y registro en Stellar Apex:** entrá a `https://stellarapex.org/`, registrate con tu email y unite/registrate a la hackathon **FLAT Stellar 2026** (**cierra el sábado 28/11 a las 12:27 ART**, más de 11 horas antes que la entrega del código). Pasale a Gabriel el email/usuario exacto con el que te registraste en Apex para que te agregue como miembro oficial del proyecto mañana viernes a las 12:27 hs.
3. **Acceso a GitHub:** pasale tu usuario de GitHub a Gabriel para que te sume en `Settings → Collaborators` de `Gabyresina15/trama-viva`.

---

## 2. Cómo levantar el proyecto en tu compu y trabajar con Git sin chocar

### Paso A: Clonar y correr en local (NO necesitás instalar Rust ni Stellar CLI)
Vos **no necesitás compilar contratos Rust**: todo el frontend funciona en modo vista previa automática si no tenés las claves secretas `S...` en tu máquina.

```bash
git clone https://github.com/Gabyresina15/trama-viva.git
cd trama-viva
npm install
cp .env.example .env.local
npm run dev
```
Abrí `http://localhost:3000`. Vas a poder navegar todo, grabar audios de prueba y diseñar pantallas sin gastar fondos ni tocar llaves privadas.

### Paso B: Regla de Ramas en Git (CRÍTICO)
Cada `git push` directo a `main` redespliega automáticamente `https://trama-viva-cjwf.vercel.app/` (la URL real a la que apuntan las etiquetas QR físicas mañana en el Mercado Artesanal).
- **NUNCA hagas `git push --force` ni pushees directo a `main` sin correr antes `npx tsc --noEmit && npx eslint src`.**
- Trabajá siempre sobre tu rama:
  ```bash
  git checkout -b feat/ux-y-campo
  ```
- Cuando termines una mejora probada, corrés:
  ```bash
  npx tsc --noEmit
  npx eslint src
  git add -A
  git commit -m "feat: descripcion corta"
  git push -u origin feat/ux-y-campo
  ```
  Y le avisás a Gabriel para mergear a `main` y verificar que el deploy en Vercel salga en verde.

---

## 3. Frontera estricta para tu Agente de IA (Qué tocar y qué NO tocar)

Cuando abras tu agente de IA sobre este repositorio, la primera instrucción siempre debe respetar estas dos zonas:

### ZONA ROJA — PROHIBIDO MODIFICAR
- `contracts/` *(contrato Soroban ya auditado y desplegado en Testnet)*
- `packages/trama-viva-client/` *(bindings de Soroban)*
- `scripts/` *(scripts CLI de despliegue y smoke tests)*
- `src/lib/stellar/` y `src/lib/bridge/chain.ts` *(puente transaccional con Soroban)*
- `next.config.ts` *(mantener `cacheComponents: true` intacto)*

> **Regla técnica clave de Next.js 16 (`cacheComponents: true`) para tu agente:**
> 1. **NO** agregar `export const dynamic = "force-dynamic"` ni `export const runtime = "nodejs"` en ningún archivo (rompe el build de Next.js 16).
> 2. Cualquier Client Component (`"use client"`) que use `useParams()` o `useSearchParams()` **debe estar envuelto dentro de `<Suspense fallback={...}>`** en el `export default` de la página.
> 3. En React 19 ESLint falla si llamás `setState(...)` de forma sincrónica en el cuerpo directo de un `useEffect`. Siempre actualizar estado dentro de callbacks async (`.then(...)`).

### ZONA VERDE — TU TERRITORIO PARA SUMAR PUNTOS DE GANADOR
- `src/components/` *(nuevos componentes visuales)*
- `src/app/etiquetas/page.tsx` *(hoja A4 imprimible de etiquetas QR físicas)*
- `src/app/validacion/page.tsx` y `src/data/validacion-campo.ts` *(evidencia pública de campo en Salta para el 25 % de la rúbrica)*
- `src/app/como-funciona/page.tsx` *(opcional: vista visual simple del flujo para jueces no-técnicos)*
- Mejoras de UX, idioma completo `ES / EN / PT` y accesibilidad táctil/contraste solar en `src/app/p/[id]/page.tsx`, `src/app/crear/page.tsx` y `src/app/page.tsx` (sin romper los `fetch` existentes a `/api/*`).

---

## 4. Las 3 Misiones Técnicas para darle a tu Agente (con Prompts listos)

Estas 3 misiones atacan directamente los criterios de evaluación de Stellar Apex: **Problema Validado (25 %)**, **Experiencia y Diseño (15 %)** e **Historia y Potencial (10 %)**.

---

### MISIÓN 1 (Hoy jueves noche o viernes 09:00 hs): Generador Imprimible A4 de Etiquetas QR Reales (`/etiquetas`)

Necesitamos llevar mañana viernes a las 15:00 hs al **Mercado Artesanal de Salta** las **6 etiquetas físicas colgantes (`pieza-01` a `pieza-06`)** apuntando a la URL real de producción:
- `https://trama-viva-cjwf.vercel.app/p/pieza-01`
- `https://trama-viva-cjwf.vercel.app/p/pieza-02`
- `https://trama-viva-cjwf.vercel.app/p/pieza-03`
- `https://trama-viva-cjwf.vercel.app/p/pieza-04`
- `https://trama-viva-cjwf.vercel.app/p/pieza-05`
- `https://trama-viva-cjwf.vercel.app/p/pieza-06`

**Prompt listo para copiar y pegarle a tu agente de IA:**
```text
Lee `SPEC.md` y `PLAN_COMPANERO.md` antes de escribir código. Respeta estrictamente la ZONA ROJA (no toques `contracts/`, `packages/`, `scripts/`, `src/lib/stellar/`, `src/lib/bridge/` ni `next.config.ts`) y las reglas de Next.js 16 `cacheComponents`.

Instala `qrcode` (`npm install qrcode @types/qrcode`) si hace falta para generar SVGs limpios offline, y crea la página `src/app/etiquetas/page.tsx` que renderice una plancha A4 lista para imprimir (`@media print` ocultando header/footer globales y botones de pantalla) con 6 etiquetas colgantes recortables (`pieza-01` a `pieza-06` en una grilla 2x3).

Cada etiqueta debe tener estética artesanal editorial cálida (papel crudo, bordes punteados de corte y circulito guía superior para pasar hilo y atarla a una artesanía) e incluir:
1. Código QR nítido en SVG apuntando exactamente a `https://trama-viva-cjwf.vercel.app/p/pieza-0X` (además de mostrar el código `pieza-0X` en tipografía mono).
2. Título: "Trama Viva · Salta"
3. Texto breve bilingüe: "Escaneá con tu cámara y escuchá la voz de quien hizo esta pieza · Scan to hear the artisan's voice"
4. Un botón superior en pantalla "Imprimir plancha A4 (Ctrl+P)" que llame a `window.print()`.
5. Agrega también un componente pequeño `QrBadge` dentro del estado de éxito de `src/app/crear/page.tsx` para que apenas se termina de grabar una pieza en el celular se pueda escanear su QR desde la propia pantalla si hace falta.

Al terminar corre `npx tsc --noEmit` y `npx eslint src` y verifica que den 0 errores.
```

---

### MISIÓN 2 (Viernes 10:30 – 13:00 hs): Internacionalización completa `ES / EN / PT` y pulido UX "A prueba de sol" en `/p/[id]`

Cuando mañana en el Mercado Artesanal o Plaza 9 de Julio un turista extranjero escanee la etiqueta y toque `EN · English` o `PT · Português`, queremos que **toda la interfaz de `/p/[id]`** (títulos, explicaciones de reparto, botón de pago y nota de Testnet) cambie de idioma al instante, no solo los subtítulos del audio.

**Prompt listo para copiar y pegarle a tu agente de IA:**
```text
Lee `PLAN_COMPANERO.md` y respeta todas las reglas de frontera y de Next.js 16 (`<Suspense>` obligatorio alrededor de `useParams()`, cero `setState` sincrónico dentro de `useEffect`).

Mejora `src/app/p/[id]/page.tsx` manteniendo intactas las llamadas a `GET /api/pieces/[id]` y `POST /api/support`:
1. Haz que el selector de idioma (`es` | `en` | `pt`) traduzca TODOS los textos visibles de la interfaz de `/p/[id]` (encabezado del reproductor, etiquetas de "Técnica" / "Tiempo de labor" / "Materiales", título y explicación del bloque de apoyo en USDC, roles de reparto, botón "Enviar X USDC directo" y pie de auditoría en Stellar Expert), detectando además el idioma inicial sugerido por `navigator.language` si empieza con `en` o `pt`.
2. Muestra también las píldoras de `materials` (`piece.passport.craftMetadata.materials`) si el array tiene elementos.
3. Optimiza contraste y tamaños táctiles (botones >= 48px de alto) pensando en lectura al aire libre en el patio del Mercado Artesanal con brillo solar alto.
4. Verifica con `npx tsc --noEmit` y `npx eslint src` que haya 0 errores y 0 warnings.
```

---

### MISIÓN 3 (Viernes 18:30 – 20:30 hs, al volver del Mercado): Página `/validacion` con la Evidencia Real de Campo

El **25 % del puntaje en Stellar Apex** es *"Problema validado: Hay un usuario real detrás y el equipo aprendió algo de él"*. La mayoría de los equipos virtuales solo lo cuentan en dos renglones de texto; nosotros vamos a tener una pestaña dedicada en la app (`/validacion`) con datos medidos en Salta.

**Prompt listo para copiar y pegarle a tu agente de IA (viernes a la tarde con tus notas en mano):**
```text
Lee `PLAN_COMPANERO.md` y respeta las reglas de frontera y Next.js 16.

Crea `src/data/field-validation.ts` y la página `src/app/validacion/page.tsx` (y agrega un link "Validación en Salta" en el header de `src/app/layout.tsx` y un banner resumen en `src/app/page.tsx`).
IMPORTANTE: Usa ÚNICAMENTE datos reales que te pasemos de nuestra salida al Mercado Artesanal de Salta (cero citas ni números inventados; deja marcadores claros `TODO_COMPLETAR_VIERNES` hasta cargar las notas reales).

La página `/validacion` debe presentar con diseño editorial limpio para el jurado:
1. Contexto de la prueba presencial: lugar (Mercado Artesanal de Salta, Av. San Martín 2555 / Plaza 9 de Julio), fecha (Viernes 27/11/2026) y metodología (observación sin tocarles la pantalla, cronometrando tiempos reales y sin usar jerga cripto).
2. Resumen de métricas observables: cantidad de artesanos/salas entrevistados, tiempo promedio de grabación de pieza, cantidad de escaneos externos de turistas y cuántos aceptaron dejar la etiqueta QR en su pieza.
3. Tarjetas por prueba (`pieza-01` a `pieza-06`): oficio/sala, tiempo medido, fricción observada, cita textual autorizada y botón directo a `/p/pieza-0X` y a su transacción real en Stellar Expert.
4. Bloque destacado "Qué aprendimos en campo y qué cambiamos en el producto esa misma tarde": mostrando el antes y el después de la mejora de UX nacida de escuchar a los artesanos reales.

Verifica `npx tsc --noEmit` y `npx eslint src` sin errores.
```

---

## 5. Cronograma coordinado de Viernes 27 y Sábado 28 (Quién hace qué)

### Viernes 27/11
- **09:00 – 11:30 hs:**
  - **Compañero:** Corre **Misión 1 (`/etiquetas`)**, imprime y recorta las 6 etiquetas QR reales (`https://trama-viva-cjwf.vercel.app/p/pieza-01`..`06`) con hilo para atarlas + lleva impresa la hoja *Permiso y Guía de Medición*. Arranca **Misión 2 (traducción completa EN/PT en `/p/[id]`)**.
  - **Gabriel:** Activa **Vercel Blob** (`BLOB_READ_WRITE_TOKEN`) en `pieces-store.ts` para que todos los audios y fotos que se graben a las 15:00 hs en `https://trama-viva-cjwf.vercel.app` queden persistidos de forma permanente en la nube (y no en `/tmp` efímero), y verifica que `XAI_API_KEY` + los 20 USDC de `treasury` estén listos en producción.
- **12:27 – 13:15 hs (Hito Apex):**
  - **Gabriel + Compañero:** Apenas abre la ventana de entregas a las `12:27 ART`, crean el borrador del proyecto **Trama Viva** en `https://stellarapex.org/` y confirman que los dos miembros aparezcan adentro del equipo. Mergean la rama del compañero a `main` y prueban grabar 1 audio real desde el celular con 4G (WiFi apagado).
- **15:00 – 18:00 hs (Salida estelar al Mercado Artesanal de Salta — Av. San Martín 2555):**
  - **Regla de oro en los puestos:** No mencionar "blockchain", "Soroban" ni "cripto". Presentarlo tal cual dice tu PDF: *"una etiqueta gratuita con tu voz para que quien compre o reciba tu pieza escuche quién la hizo y pueda mandarte un reconocimiento directo desde cualquier país"*.
  - Priorizar **salas de asociaciones / cooperativas** (donde venden piezas de compañeros de Valles, Puna o Chaco salteño) y comparar también con algún artesano directo en puesto.
  - No tocarles la pantalla al grabar: medir los segundos con cronómetro y anotar exactamente dónde dudan.
  - Hacer que **al menos 3 personas externas / turistas** escaneen la etiqueta pegada a la pieza desde sus propios celulares y toquen "Enviar USDC" hasta ver el recibo verificado en Stellar Testnet.
- **18:30 – 21:30 hs:**
  - **Compañero:** Corre **Misión 3 (`/validacion`)** volcando los números, tiempos, fotos autorizadas y citas reales de la tarde.
  - **Gabriel:** Implementa en código el ajuste número 1 que haya surgido de ver a los artesanos usar la app en vivo, verifica todos los hashes de las piezas reales grabadas en Stellar Expert y actualiza el `README.md`.

### Sábado 28/11 (Día de Cierre y Presentación)
- **09:30 – 12:00 hs:**
  - **Chequeo de vida o muerte antes de las `12:27 ART`:** verificar que **ambos** figuren registrados en el evento dentro de `stellarapex.org` (el registro cierra `12:27 ART`).
  - Congelar código en `main`, verificar que la Testnet no haya tenido reset nocturno y que el contrato `CDK6FDRZK5TQ544VDDXFPWXC3OEPXI2RQFA2MMASYIDVFKHG3YLSYIDR` tenga saldo USDC listo en custodia para mostrar `/artesana` en vivo.
- **13:30 – 17:00 hs (Grabación del Video Público obligatorio de 2:00 a 2:30 min):**
  - **Compañero + Gabriel:** Grabar y editar el video público (subido a YouTube en **Público**, nunca Privado) con esta estructura exacta:
    1. `0:00 – 0:25` · Imágenes reales en el Mercado Artesanal de Salta + el problema concreto validado (se pierde la voz del creador y el turista extranjero no tiene vía directa sin intermediarios).
    2. `0:25 – 1:10` · Demo real en celular sobre `https://trama-viva-cjwf.vercel.app`: escanear etiqueta de una pieza real salteña → escuchar 5 seg de la voz real del artesano → cambiar idioma a `EN` → enviar `5 USDC` en 1 toque → ver el recibo con `SHA-256 COINCIDE ✓`.
    3. `1:10 – 1:45` · Abrir el link a **Stellar Expert**: mostrar el contrato `CDK6...`, los eventos emitidos y los USDC retenidos en `Contract balances`; ir a `/artesana`, tocar *"Retirar USDC a mi cuenta"* y mostrar el cobro en vivo.
    4. `1:45 – 2:20` · Mostrar `/validacion` con las métricas reales medidas el viernes en Salta, explicar qué aprendieron y cambiaron, y cerrar con modelo de negocio y paso a Mainnet (Passkeys + rampa SEP-24 a pesos).
- **17:30 – 19:30 hs (Entrega blindada 4 horas antes del límite):**
  - Cargar en `https://stellarapex.org/` la descripción final, el link público del video, `https://trama-viva-cjwf.vercel.app/` y `https://github.com/Gabyresina15/trama-viva`.
  - **PASO CRÍTICO EN APEX (del correo oficial):** entrar a la hackathon **FLAT Stellar 2026**, tocar **Publicar proyecto** y asegurarse de que el estado del proyecto esté en **PÚBLICO** (si queda en privado, el jurado no lo ve).
  - Probar abrir todos los links desde una ventana de incógnito del celular.
