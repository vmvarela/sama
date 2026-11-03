# Yoga Minimal

Minimalist yoga & meditation PWA with an embedded Zig HTTP server.

- **Sequences**: yoga poses (wrist/ankle-friendly) + meditation (box breathing, 4-7-8, mindfulness).
- **Music**: ambient drone via Web Audio API (toggle).
- **Offline**: service worker caches all assets.
- **Server**: single Zig binary serves the embedded frontend (no runtime dependencies).

## Build & Run

Requires Zig 0.17.0.

```sh
zig build
./zig-out/bin/yoga
# open http://localhost:8080
```

## Structure

- `src/main.zig` — HTTP server (thread per connection).
- `src/web_assets.zig` — embedded web assets.
- `web/` — frontend (HTML/CSS/JS/PNG/JSON).
- `yoga_root.zig` — build anchor for `@embedFile` package path.

## License

MIT