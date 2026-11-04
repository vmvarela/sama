# SAMA

PWA minimalista de yoga y meditación con servidor Zig embebido.

- **Secuencias**: posturas de yoga (amables con muñecas y tobillos) + meditación (box breathing, 4-7-8, mindfulness).
- **Música**: drone ambiental con Web Audio API (conmutable).
- **Sin conexión**: el service worker guarda los assets de la app.
- **Un binario**: `zig build` genera `zig-out/bin/sama`, que incluye todo el frontend y las imágenes.
- **Web pública**: `node scripts/build-pages.mjs` ensambla el sitio de GitHub Pages (solo contenido público).

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
node scripts/build-pages.mjs      # genera dist/pages/ a partir de una allowlist
node --test tests/build-boundary.test.mjs
```

Se publica en `/sama/` mediante `.github/workflows/pages.yml`. No incluye el material privado
(Plan 300 ni el libro). Detalles en [docs/ops.md](docs/ops.md).

## Estructura

- `src/main.zig` — servidor HTTP (un hilo por conexión).
- `src/web_assets.zig` — tabla de assets embebidos (generada por `scripts/gen-web-assets.mjs`).
- `web/` — frontend (HTML/CSS/JS/PNG/JSON).
- `scripts/` — generación de la tabla embebida y ensamblado del sitio público.
- `tests/` — tests de frontera del build y del reproductor.
- `yoga_root.zig` — ancla de build para `@embedFile` (el paquete debe contener `web/`).

## Licencia

MIT
