# Plan de producto: SAMA

SAMA ofrece secuencias minimalistas de yoga y meditación en dos formatos: un
ejecutable Zig local, autocontenido, y una PWA pública desplegable en GitHub Pages.
Pages publica solo Yoga y Meditación; el plan personal de 300 semanas no se publica.

## Principio de assets: generados, no sintéticos
Todo audio, música e imágenes debe ser **generado** (IA o herramientas), nunca sintético en runtime ni externo:
- **Imágenes**: ilustraciones generadas con IA en estilo lineal. El binario local
  incluye la biblioteca completa; Pages contiene solo las imágenes de sus secuencias.
- **Música**: archivos de audio generados (no drone sintético). Pendiente.
- **Audio (voz)**: archivos TTS generados (no síntesis en runtime). Pendiente.

El drone sintético actual es placeholder hasta tener música generada.
- PWA estática (HTML/CSS/JS) con secuencias de yoga y meditación.
- Servidor Zig embebido: un ejecutable local que incluye frontend e imágenes.
- Música: drone sintético (placeholder) → reemplazar por música generada.
- Tracker personal de 300 semanas, excluido del sitio público.
- Registrado como proyecto opensource.
- Web pública en GitHub Pages (`/sama/`) con solo el contenido público.

## Fase 1 — Distribución
- [x] Renombrar el proyecto a SAMA.
- [x] Generar el ejecutable local autocontenido.
- [x] Preparar el ensamblador y workflow de GitHub Pages con allowlist pública.
- [ ] Publicar desde GitHub y verificar la instalación desde Safari en un iPhone real.
- [ ] Añadir CI multiplataforma para el ejecutable Zig.

## Fase 2 — Mejora de contenido
- Ampliar biblioteca de posturas (30+ imágenes con estilo consistente).
- Más secuencias: yin, restaurativo, fuerza, flexibilidad.
- Ampliar y revisar el tracker personal sin incorporar ese contenido a Pages.
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
