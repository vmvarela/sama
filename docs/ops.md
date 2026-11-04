# Operación (yoga-minimal)

Notas de operación; sin contenido del libro.

## Servidor

- `zig build` y `./zig-out/bin/yoga` — **siempre desde la raíz del repo**: las imágenes
  se sirven desde `web/images/` con ruta relativa; desde otro directorio dan 404 en silencio.
  Puerto fijo 8080 (editarlo solo en `src/main.zig`).
- Persistente: `nohup ./zig-out/bin/yoga >> /tmp/yoga-server.log 2>&1 &` — los shells
  en background de la sesión mueren al reaprovecharse.

## Service worker

- `CACHE 'yoga-minimal-v9'`. Archivos de la app (`/`, `index.html`, `style.css`,
  `app.js`, `tracker.js`, `tracker.css`, `day-player.js`, `sw.js`) → network-first:
  se actualizan solos tras editar, **no hace falta bump**.
  Datos (`manifest.json`, `sequences.json`,
  `meditation.json`, `week-data.json`, `images-map.json`) → cache-first para offline:
  bump solo si cambian de nombre. Imágenes: nunca precacheadas.
- Si el SW de un navegador queda en estado roto: DevTools → Application → Service
  Workers → Unregister, y recargar.
- `self.skipWaiting()` + `clients.claim()` en el activate: sin eso los SW en cola
  no se activan nunca por sí solos.

## Tracker

- Datos en `web/week-data.json` (300 semanas). Estado en localStorage
  `yogaMinimal.tracker` `{v: 2, current, completed[]}`; cambiar esquema = subir `v` (resetea).
- La vista de inicio es el plan (Semana 1).

## Imágenes

- PNGs servidos desde disco por `src/main.zig` (slug `[a-z0-9-]` + `.png`, máx 16 MB,
  404 si no válido). `web/images-map.json` mapea nombre de postura → slug; si falta el
  PNG, la UI muestra solo texto.
- Algunas salidas del generador son RGBA transparentes aunque se pida fondo blanco;
  algunos visores las muestran sobre negro. Antes de servirlas, compónlas sobre blanco
  y guárdalas como RGB para mantener el fondo uniforme.
- Reanudar generación pendiente: calcular slugs únicos de `images-map.json` menos PNGs
  existentes en `web/images/`; el número pendiente cambia con cada lote.

## Datos de uso personal (NO PUBLICAR)

Contenido derivado de obra con copyright, uso estrictamente personal. Excluidos de git
vía `.git/info/exclude` (no añadir al índice nunca):

- `web/week-data.json`
- `Luz-sobre-el-Yoga.pdf`
- `Luz-sobre-el-Yoga.md`
- `125593660-iyengar-luz-sobre-el-yoga-yoga-dipika-pdf.pdf`
