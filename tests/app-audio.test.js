'use strict';
// Tests de las señales de sonido de web/app.js con DOM mínimo, reloj de 1 s y AudioContext falso.
// Ejecutar: node --test tests/app-audio.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');

// Fixture: A (3 s) → B (2 s) → C (1 s). Sin pausas ni pesos reales.
const SEQUENCE = {
  name: 'Fixture',
  poses: [
    { name: 'A', instruction: '', breath: '', image: 'a', duration: 3 },
    { name: 'B', instruction: '', breath: '', image: 'b', duration: 2 },
    { name: 'C', instruction: '', breath: '', image: 'c', duration: 1 },
  ],
};

function makeEnv({ failAudio = false } = {}) {
  const elements = new Map();
  const byId = id => {
    if (!elements.has(id)) {
      const listeners = {};
      elements.set(id, {
        textContent: '', src: '', alt: '', style: {},
        classList: { toggle() {} },
        addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        click() { (listeners.click || []).forEach(fn => fn()); },
      });
    }
    return elements.get(id);
  };

  const started = []; // { name, loop } por cada start()
  const stopped = []; // nombres de buffers parados
  class FakeAudioContext {
    constructor() { this.currentTime = 0; this.destination = {}; }
    resume() { return Promise.resolve(); }
    decodeAudioData(buf) { return Promise.resolve({ name: buf.name }); }
    createBufferSource() {
      const node = {
        buffer: null, loop: false, onended: null,
        connect(g) { return g; },
        disconnect() {},
        start() { started.push({ name: node.buffer.name, loop: node.loop }); },
        stop() { stopped.push(node.buffer.name); },
      };
      return node;
    }
    createGain() {
      return {
        gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} },
        connect(n) { return n; },
        disconnect() {},
      };
    }
  }

  const fetch = async url => {
    if (url.endsWith('.json')) return { ok: true, json: async () => SEQUENCE };
    if (failAudio) return { ok: false, status: 404 };
    return { ok: true, arrayBuffer: async () => ({ name: url.split('/').pop() }) };
  };

  const timers = [];
  const ctx = {
    document: { getElementById: byId },
    window: { AudioContext: FakeAudioContext },
    navigator: {},
    fetch,
    setInterval(fn) { const t = { fn, live: true }; timers.push(t); return t; },
    clearInterval(t) { if (t) t.live = false; },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);

  return {
    ctx,
    el: byId,
    started,
    stopped,
    // avanza `sec` segundos disparando los intervalos vivos (uno por segundo)
    tick(sec) {
      for (let i = 0; i < sec; i++) {
        for (const t of timers.slice()) if (t.live) t.fn();
      }
    },
    flush: () => new Promise(r => setImmediate(r)),
  };
}

async function boot(opts) {
  const env = makeEnv(opts);
  await env.flush(); // espera la carga inicial de la secuencia
  return env;
}

const cues = env => env.started.filter(s => !s.loop).map(s => s.name);
const loops = env => env.started.filter(s => s.loop).map(s => s.name);

test('control único: el bucle de handpan suena en bucle y se para al silenciar', async () => {
  const env = await boot();
  env.el('music-btn').click();
  await env.flush();
  assert.deepEqual(env.started, [{ name: 'handpan.mp3', loop: true }]);
  assert.equal(env.el('music-btn').textContent, '♫ Música (on)');
  env.el('music-btn').click();
  assert.equal(env.el('music-btn').textContent, '♪ Música');
  assert.deepEqual(env.stopped, ['handpan.mp3']);
  env.el('music-btn').click();
  await env.flush();
  assert.deepEqual(loops(env), ['handpan.mp3', 'handpan.mp3']);
});

test('campanita solo al avanzar automáticamente a la siguiente postura', async () => {
  const env = await boot();
  env.el('music-btn').click();
  await env.flush();
  env.el('play-btn').click();
  env.tick(2);
  assert.deepEqual(cues(env), []);
  env.tick(1); // fin de A
  assert.equal(env.el('pose-name').textContent, 'B');
  assert.deepEqual(cues(env), ['transition.mp3']);
  env.tick(2); // fin de B
  assert.equal(env.el('pose-name').textContent, 'C');
  assert.deepEqual(cues(env), ['transition.mp3', 'transition.mp3']);
});

test('gong una sola vez al terminar naturalmente la última postura', async () => {
  const env = await boot();
  env.el('music-btn').click();
  await env.flush();
  env.el('play-btn').click();
  env.tick(6);
  assert.deepEqual(cues(env), ['transition.mp3', 'transition.mp3', 'gong.mp3']);
  assert.equal(env.el('play-btn').textContent, '▶ Iniciar');
  env.tick(5); // ningún intervalo vivo: no se repite
  assert.deepEqual(cues(env), ['transition.mp3', 'transition.mp3', 'gong.mp3']);
});

test('navegación manual y pausa no emiten señal', async () => {
  const env = await boot();
  env.el('music-btn').click();
  await env.flush();
  env.el('play-btn').click();
  env.el('next-btn').click();
  env.el('prev-btn').click();
  env.el('next-btn').click();
  env.el('play-btn').click(); // pausa
  env.tick(10);
  assert.deepEqual(cues(env), []);
  assert.equal(env.el('pose-name').textContent, 'B');
});

test('sin sonido activado no hay campanita ni gong', async () => {
  const env = await boot();
  env.el('play-btn').click();
  env.tick(6);
  assert.deepEqual(env.started, []);
  assert.equal(env.el('play-btn').textContent, '▶ Iniciar');
});

test('tras terminar, iniciar vuelve a la primera postura y cada sesión suena una vez', async () => {
  const env = await boot();
  env.el('music-btn').click();
  await env.flush();
  env.el('play-btn').click();
  env.tick(6);
  env.el('play-btn').click();
  assert.equal(env.el('pose-name').textContent, 'A');
  env.tick(6);
  assert.deepEqual(cues(env), [
    'transition.mp3', 'transition.mp3', 'gong.mp3',
    'transition.mp3', 'transition.mp3', 'gong.mp3',
  ]);
});

test('si no se pueden cargar los sonidos, el control vuelve a estar apagado', async () => {
  const env = await boot({ failAudio: true });
  env.el('music-btn').click();
  await env.flush();
  assert.equal(env.el('music-btn').textContent, '♪ Música');
  env.el('play-btn').click();
  env.tick(6);
  assert.deepEqual(env.started, []);
});

test('rutas de audio exactas: coinciden con el sitio público y la tabla embebida', async () => {
  const env = await boot();
  const urls = Object.values(vm.runInContext('SOUNDS', env.ctx)).map(String);
  assert.deepEqual(urls.sort(), ['audio/gong.mp3', 'audio/handpan.mp3', 'audio/transition.mp3']);
  const { PUBLIC_ALLOWLIST } = await import('../scripts/build-pages.mjs');
  const table = fs.readFileSync(path.join(ROOT, 'src', 'web_assets.zig'), 'utf8');
  for (const u of urls) {
    assert.ok(PUBLIC_ALLOWLIST.some(e => e.to === u && e.from === `web/${u}`), `${u} fuera de la allowlist pública`);
    assert.ok(table.includes(`.path = "/${u}"`), `${u} no está en la tabla embebida`);
    assert.ok(fs.existsSync(path.join(ROOT, 'web', u)), `${u} no existe`);
  }
});
