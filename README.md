# SAMA

PWA minimalista de yoga y meditación con servidor Zig embebido.

- **Secuencias**: posturas de yoga (amables con muñecas y tobillos) + meditación (box breathing, 4-7-8, mindfulness).
- **Música**: bucle de handpan original con Web Audio API; una campanita entre posturas y un gong al terminar (un solo control ♪ Música).
- **Sin conexión**: el service worker guarda los assets de la app.
- **Un binario**: `zig build` genera `zig-out/bin/sama`, que incluye todo el frontend y las imágenes.
- **Web pública**: `node scripts/build-pages.mjs` ensambla el sitio de GitHub Pages (la app completa).

## Build y ejecución local

Requiere Zig 0.17.0.

```sh
zig build
./zig-out/bin/sama
# abre http://localhost:8080
```

El binario (~151 MB) no depende de `web/` en ejecución: puedes copiarlo a cualquier carpeta.

## Sitio público (GitHub Pages)

```sh
node scripts/build-pages.mjs      # genera dist/pages/ (la app completa, ~149 MiB)
node --test tests/build-boundary.test.mjs
```

Se publica en `/sama/` mediante `.github/workflows/pages.yml`. Incluye la app completa,
con el Plan 300 y sus datos (`week-data.json`, decisión del 2026-11-13); no incluye el
libro (PDF/Markdown). Detalles en [docs/ops.md](docs/ops.md).

## Audio

- Bucle de handpan y señales en `web/audio/` (MP3, generados desde muestras CC0).
- Handpan: muestras FreePats «Hang D-minor» (CC0 1.0), Gonzalo y Roberto, Medialab-Prado; interpretación Mar, edición Roberto.
- Campanita de transición y gong: Joseph Sardin / BigSoundBank (CC0 1.0).
- Créditos completos en [`assets/handpan/CREDITS.txt`](assets/handpan/CREDITS.txt) y licencia en `assets/handpan/LICENSE.txt`.

## Estructura

- `src/main.zig` — servidor HTTP (un hilo por conexión).
- `src/web_assets.zig` — tabla de assets embebidos (generada por `scripts/gen-web-assets.mjs`).
- `web/` — frontend (HTML/CSS/JS/PNG/JSON).
- `scripts/` — generación de la tabla embebida y ensamblado del sitio público.
- `tests/` — tests de frontera del build y del reproductor.
- `yoga_root.zig` — ancla de build para `@embedFile` (el paquete debe contener `web/`).

## Licencia

MIT
