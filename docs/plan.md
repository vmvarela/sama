# Plan: Yoga Minimal → Maestro Virtual Completo

## Principio de assets: generados, no sintéticos
Todo audio, música e imágenes debe ser **generado** (IA o herramientas), nunca sintético en runtime ni externo:
- **Imágenes**: generadas con IA (estilo minimalista línea). Ya: 9 posturas.
- **Música**: archivos de audio generados (no drone sintético). Pendiente.
- **Audio (voz)**: archivos TTS generados (no síntesis en runtime). Pendiente.

El drone sintético actual es placeholder hasta tener música generada.
- PWA estática (HTML/CSS/JS) con secuencias de yoga y meditación.
- Servidor Zig embebido (un binario, sin deps).
- Música: drone sintético (placeholder) → reemplazar por música generada.
- Imágenes minimalistas (IA) de 9 posturas.
- Registrado como proyecto opensource.

## Fase 1 — Publicación (siguiente)
- Crear repo remoto GitHub y push inicial.
- CI: build Zig en Ubuntu/macOS/Windows.
- README con screenshots y badges.
- Verificar `zig build` y `zig build test` en CI.

## Fase 2 — Mejora de contenido
- Ampliar biblioteca de posturas (30+ imágenes con estilo consistente).
- Más secuencias: yin, restaurativo, fuerza, flexibilidad.
- Plan semanal integrado en la app (JSON de rutina).
- Adaptaciones por articulación configurables (muñecas/tobillos/espalda).

## Fase 3 — IA integrada
- Generador de secuencias dinámico (backend o WASM).
- Ajuste por nivel, tiempo, foco y limitaciones.
- Sugerencias de progresión (subir/bajar intensidad).

## Fase 4 — Multimedia (assets generados)
- Generar música con IA (archivos de audio), embeber en servidor Zig.
- Generar audio hablado (TTS) para guía de posturas, embeber.
- Reemplazar drone sintético por música generada.
- Control de volumen y mezcla música/voz.

## Fase 5 — Plataforma
- PWA instalable con offline completo (ya parcial).
- Android/iOS (via Capacitor o nativo).
- Sincronización de progreso (opcional, local-first).

## Verificación por fase
- Cada fase termina con build verde + prueba manual en navegador.
- No avanzar de fase sin verificar la anterior.