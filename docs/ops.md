# Operación (SAMA)

Notas de operación; sin contenido del libro.

## Servidor local (binario privado)

- `zig build` produce `zig-out/bin/sama` (~151 MB, ~5 s en build limpio). Ese binario
  **contiene todos los assets** (HTML, CSS, JS, JSON privados, iconos e imágenes):
  se puede copiar y ejecutar desde cualquier directorio, sin `web/` ni carpeta de imágenes.
- Tras editar `web/`, **recompila**: no hay lectura de disco en ejecución.
  `node scripts/gen-web-assets.mjs` regenera `src/web_assets.zig` si cambian los archivos
  de `web/images/` o `web/icons/`; `--check` falla si la tabla está desactualizada.
- Puerto fijo 8080 (editarlo solo en `src/main.zig`). Solo GET y HEAD; rutas exactas;
  cualquier otra cosa da 404.
- Persistente: `nohup ./zig-out/bin/sama >> /tmp/sama-server.log 2>&1 &` — los shells
  en background de la sesión mueren al reaprovecharse.
- Pruebas: `zig build test` (ruta exacta, alias `/`, sin traversal) y
  `node --test tests/build-boundary.test.mjs tests/day-player.test.js`.
  Sonido: `node --test tests/app-audio.test.js` (transiciones, gong y rutas de audio).

## Sitio público (GitHub Pages)

- `node scripts/build-pages.mjs` ensambla `dist/pages/` (ignorado por git) desde una
  **lista explícita** (`PUBLIC_ALLOWLIST` en el script): la app completa, nunca una copia
  recursiva de `web/`. Rechaza symlinks y archivos inesperados, verifica hashes y escribe
  `dist/pages.inventory.json` (con `totalBytes`) fuera del sitio.
- Contenido público: `index.html` (la app completa, desde `web/index.html`), `manifest.json`,
  `sw.js` (desde `web/pages-sw.js`), `style.css`, `tracker.css`, `app.js`, `tracker.js`,
  `day-player.js`, `sequences.json`, `meditation.json`, `images-map.json`,
  `week-data.json` (≈744 KB), los 3 MP3 del sonido, los 3 iconos y las 145 imágenes de
  `web/images/` (~148 MB). Total: **163 archivos, ~149 MiB**; el build avisa en el log si
  supera 200 MB.
- `week-data.json` se publica por **decisión del 2026-11-13** (antes figuraba en la lista
  de datos privados que el sitio excluía).
- Excluido siempre: el libro (PDF/Markdown), código Zig, binarios, fuentes de audio
  (FLAC/OGG en `assets/handpan/`), ficheros de caché y `src/` (regla `FORBIDDEN`).
- El sitio debe funcionar bajo `/sama/`: nada de rutas absolutas `"/…"`; el build
  falla si aparecen. `start_url` del manifiesto debe resolver a un archivo publicado.
- Despliegue: `.github/workflows/pages.yml` en `master` (y manual). Permisos mínimos:
  `contents: read` globales; `pages: write` e `id-token: write` solo en el job de deploy.
  Solo sube `dist/pages`. Requiere en GitHub: Settings → Pages → Source «GitHub Actions».
  Acciones: `checkout@v7`, `setup-node@v7`, `upload-pages-artifact@v5`, `deploy-pages@v5`.
- Verificación local: `node --test tests/build-boundary.test.mjs` y luego el build.
  Para probar la ruta real del proyecto, copia `dist/pages` a `<dir>/sama/` y sirve
  `<dir>` (p. ej. `python3 -m http.server -d <dir> 8099`), y abre `/sama/`.

## Service workers

- **Privado** (`web/sw.js`): `CACHE 'sama-private-v11'`. Archivos de la app (`/`,
  `index.html`, `style.css`, `tracker.css`, `app.js`, `tracker.js`, `day-player.js`,
  `sw.js`) → network-first: se actualizan solos tras editar, **no hace falta bump**.
  Datos (`manifest.json`, `sequences.json`, `meditation.json`, `week-data.json`,
  `images-map.json`) e iconos → cache-first para offline: sube `CACHE` cuando cambien sus
  bytes, porque el navegador no revalida estos archivos. Solo borra caches con prefijo
  `sama-private-` o el antiguo `yoga-minimal-`.
- **Público** (`web/pages-sw.js` → `sw.js`): `CACHE sama-public-<build>`, donde `<build>`
  es un hash del contenido publicado, así cada despliegue crea caché nueva. Network-first
  con respaldo de caché y precache relativo al scope (`/sama/`): shell, datos (incluido
  `week-data.json`), iconos y MP3. **Las imágenes no se precachean**: se guardan en caché
  bajo demanda al usarse (ver «Imágenes»). Solo borra cachés `sama-public-*`: el mismo
  origen `github.io` puede alojar otros proyectos.
- Si el SW de un navegador queda en estado roto: DevTools → Application → Service
  Workers → Unregister, y recargar.
- `self.skipWaiting()` + `clients.claim()` en el activate: sin eso los SW en cola
  no se activan nunca por sí solos.

## Tracker

- Datos en `web/week-data.json` (300 semanas; en el sitio público desde el 2026-11-13 por
  decisión del usuario). Estado en localStorage `yogaMinimal.tracker` `{v: 2, current, completed[]}`;
  cambiar esquema = subir `v` (resetea). **La clave conserva el nombre antiguo a
  propósito**: renombrarla reiniciaría el progreso guardado en el navegador.
- La vista de inicio es el plan (Semana 1).

## Reproductor diario

- «Practicar este día» usa `day-player.js`, separado del temporizador breve de yoga.
- «Practicar esta semana» aparece en las semanas con posturas listadas y sin horario por días: reproduce
  esas asanas tal cual (sin temporizador inventado, se avanza a mano) y descarta las de lectura OCR dudosa.
  Los tiempos exactos se cronometran; los rangos requieren elegir mínimo o máximo;
  repeticiones y pasos sin tiempo son manuales. `per_side` crea dos pasos completos,
  etiquetados «lado 1/2» sin inferir izquierda/derecha.
- Cerrar una práctica pausada permite reabrirla en el mismo paso. Terminarla no marca
  la semana como completada; cambiar de modo o esconder la pestaña pausa el temporizador.

## Imágenes

- PNGs embebidos en el binario privado; la tabla explícita está en `src/web_assets.zig`
  (generada). `web/images-map.json` mapea nombre de postura → slug; si falta el
  PNG, la UI muestra solo texto.
- Algunas salidas del generador son RGBA transparentes aunque se pida fondo blanco;
  algunos visores las muestran sobre negro. Antes de servirlas, compónlas sobre blanco
  y guárdalas como RGB para mantener el fondo uniforme.
- Reanudar generación pendiente: calcular slugs únicos de `images-map.json` menos PNGs
  existentes en `web/images/`; el número pendiente cambia con cada lote.
- Las imágenes del corpus completo pesan ~148 MB y **se publican todas** en el sitio, pero
  el SW público no las precachea: las guarda en caché bajo demanda al usarse. Recorrer todo
  el plan puede acumular ~148 MB en la caché del navegador; el comentario `shortcut:` de
  `web/pages-sw.js` indica cuándo conviene una política de cuota/LRU.

## Datos de uso personal (NO PUBLICAR)

Contenido derivado de obra con copyright, uso estrictamente personal. Excluidos de git
vía `.git/info/exclude` (no añadir al índice nunca) y del sitio público por `FORBIDDEN`:

- `Luz-sobre-el-Yoga.pdf`
- `Luz-sobre-el-Yoga.md`
- `125593660-iyengar-luz-sobre-el-yoga-yoga-dipika-pdf.pdf`

`web/week-data.json` ya no está en esta lista: se publica en el sitio por decisión del
2026-11-13.
