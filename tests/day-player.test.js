'use strict';
// Tests del motor de reproducción diaria con reloj simulado. Fixtures sintéticas.
// Ejecutar: node --test tests/day-player.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'day-player.js'), 'utf8');
const DayPlayer = new Function('window', `${src}\nreturn window.DayPlayer;`)({});

function fakeClock() {
  let t = 0;
  const timers = [];
  return {
    now: () => t,
    set: ms => { t = ms; },
    schedule(fn, ms) {
      const h = { at: t + ms, fn, live: true };
      timers.push(h);
      return h;
    },
    cancel(h) { if (h) h.live = false; },
    pending: () => timers.filter(h => h.live).length,
    // dispara los timers vencidos en orden y avanza el reloj
    advance(ms) {
      const end = t + ms;
      for (;;) {
        const due = timers.filter(h => h.live && h.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        t = due.at;
        due.live = false;
        due.fn();
      }
      t = end;
    },
  };
}

function make(steps, clock, onUpdate) {
  return new DayPlayer(steps, { now: clock.now, schedule: clock.schedule, cancel: clock.cancel, onUpdate });
}

const SIDE_STEP = { id: 'fixture-lateral', name: 'Sintética lateral', timing: { kind: 'exact', seconds: 20, basis: 'per_side' } };
const SAVASANA = { id: 'fixture-savasana', name: 'Sintética final', timing: { kind: 'exact', seconds: 300, basis: 'total' } };
const DAY = [SIDE_STEP, SAVASANA];

test('expande bilateral en dos pasos de duración completa y no toca la entrada', () => {
  const clock = fakeClock();
  const p = make(DAY, clock);
  let s = p.getState();
  assert.equal(s.count, 3);
  assert.equal(s.status, 'ready');
  assert.equal(s.step.side, 'lado 1');
  assert.equal(s.step.timing.seconds, 20);
  assert.equal(s.remainingSeconds, 20);
  s = p.next();
  assert.equal(s.step.side, 'lado 2');
  assert.equal(s.step.timing.seconds, 20);
  assert.equal(s.status, 'ready');
  s = p.next();
  assert.equal(s.step.side, undefined);
  assert.equal(s.step.name, 'Sintética final');
  assert.equal(DAY[0].side, undefined);
});

test('temporizador: restante derivado del reloj, espera next y no arranca solo', () => {
  const clock = fakeClock();
  const p = make(DAY, clock);
  let s = p.start();
  assert.equal(s.status, 'running');
  assert.equal(s.remainingSeconds, 20);
  clock.advance(19000);
  assert.equal(p.getState().remainingSeconds, 1);
  clock.advance(1000);
  s = p.getState();
  assert.equal(s.status, 'running');
  assert.equal(s.remainingSeconds, 0);
  assert.equal(s.stepCompleted, true);
  clock.advance(5000);
  assert.equal(p.getState().remainingSeconds, 0);
  assert.equal(clock.pending(), 0);
  s = p.next();
  assert.equal(s.index, 1);
  assert.equal(s.status, 'ready');
  assert.equal(s.remainingSeconds, 20);
  assert.equal(clock.pending(), 0);
});

test('paso completado no se reinicia y espera next; start/pause/resume no hacen nada', () => {
  const clock = fakeClock();
  const p = make(DAY, clock);
  p.start();
  clock.advance(20000);
  let s = p.getState();
  assert.equal(s.status, 'running');
  assert.equal(s.stepCompleted, true);
  assert.equal(s.remainingSeconds, 0);
  assert.equal(clock.pending(), 0);
  assert.equal(p.start().remainingSeconds, 0);
  assert.equal(p.pause().status, 'running');
  assert.equal(p.resume().status, 'running');
  clock.advance(5000);
  s = p.getState();
  assert.equal(s.remainingSeconds, 0);
  assert.equal(s.stepCompleted, true);
  assert.equal(s.index, 0);
  assert.equal(clock.pending(), 0);
  s = p.next();
  assert.equal(s.index, 1);
  assert.equal(s.status, 'ready');
  assert.equal(s.stepCompleted, false);
  assert.equal(s.remainingSeconds, 20);
});

test('Savasana 300 s: 299/300, ceil en medio segundo, nunca negativo, último exacto finaliza en el límite', () => {
  const clock = fakeClock();
  const p = make(DAY, clock);
  p.next();
  p.next();
  assert.equal(p.start().remainingSeconds, 300);
  clock.advance(500);
  assert.equal(p.getState().remainingSeconds, 300);
  clock.advance(500);
  assert.equal(p.getState().remainingSeconds, 299);
  clock.advance(298000);
  assert.equal(p.getState().remainingSeconds, 1);
  assert.equal(p.getState().status, 'running');
  clock.advance(1000);
  const s = p.getState();
  assert.equal(s.status, 'finished');
  assert.equal(s.remainingSeconds, null);
  assert.equal(s.stepCompleted, false);
  assert.equal(clock.pending(), 0);
  assert.equal(p.next().status, 'finished');
});

test('cero negativo si el reloj supera el plazo sin disparar timers', () => {
  const clock = fakeClock();
  const p = make([SAVASANA], clock);
  p.start();
  clock.set(10 ** 7);
  assert.equal(p.getState().remainingSeconds, 0);
});

test('pausa y reanudar conserva el restante', () => {
  const clock = fakeClock();
  const p = make([SAVASANA], clock);
  p.start();
  clock.advance(100000);
  let s = p.pause();
  assert.equal(s.status, 'paused');
  assert.equal(s.remainingSeconds, 200);
  assert.equal(clock.pending(), 0);
  clock.advance(500000);
  assert.equal(p.getState().remainingSeconds, 200);
  assert.equal(p.getState().status, 'paused');
  s = p.resume();
  assert.equal(s.status, 'running');
  assert.equal(s.remainingSeconds, 200);
  clock.advance(199000);
  assert.equal(p.getState().remainingSeconds, 1);
  clock.advance(1000);
  assert.equal(p.getState().status, 'finished');
  assert.equal(p.getState().remainingSeconds, null);
});

test('onUpdate recibe el estado en cada cambio y en cada tick', () => {
  const clock = fakeClock();
  const seen = [];
  const p = make([SAVASANA], clock, st => seen.push(st.status + ':' + st.remainingSeconds));
  p.start();
  clock.advance(2000);
  p.pause();
  assert.deepEqual(seen, ['running:300', 'running:299', 'running:298', 'paused:298']);
});

test('rangos y pasos manuales no promedian; override fuera de rango no temporiza', () => {
  const RANGE = { id: 'fixture-rango', name: 'Rango', timing: { kind: 'range', min_seconds: 60, max_seconds: 120, basis: 'total' } };
  const REPS = { id: 'fixture-reps', name: 'Repeticiones', timing: { kind: 'repetitions', count: 10, basis: 'total' } };
  const NONE = { id: 'fixture-sin-tiempo', name: 'Sin tiempo', timing: null };
  const clock = fakeClock();
  const p = make([RANGE, REPS, NONE], clock);
  let s = p.getState();
  assert.equal(s.status, 'manual');
  assert.equal(s.remainingSeconds, null);
  s = p.start();
  assert.equal(s.status, 'manual');
  assert.equal(s.remainingSeconds, null);
  s = p.start(30);
  assert.equal(s.status, 'manual');
  assert.equal(clock.pending(), 0);
  s = p.start(90);
  assert.equal(s.status, 'running');
  assert.equal(s.remainingSeconds, 90);
  p.finish();
  p.previous();
  p.next(); // reps
  s = p.start();
  assert.equal(s.status, 'manual');
  assert.equal(s.remainingSeconds, null);
  assert.equal(clock.pending(), 0);
  p.next(); // sin tiempo
  s = p.start(60);
  assert.equal(s.status, 'manual');
  assert.equal(clock.pending(), 0);
});

test('rango acepta los límites inclusive', () => {
  const RANGE = { id: 'fixture-rango', name: 'Rango', timing: { kind: 'range', min_seconds: 60, max_seconds: 120, basis: 'total' } };
  const clock = fakeClock();
  assert.equal(make([RANGE], clock).start(60).remainingSeconds, 60);
  assert.equal(make([RANGE], clock).start(120).remainingSeconds, 120);
});

test('next/previous no arrancan el paso y previous vuelve sin tocar el temporizador', () => {
  const clock = fakeClock();
  const p = make(DAY, clock);
  let s = p.next();
  assert.equal(s.index, 1);
  assert.equal(s.status, 'ready');
  assert.equal(clock.pending(), 0);
  s = p.previous();
  assert.equal(s.index, 0);
  assert.equal(s.status, 'ready');
  assert.equal(p.previous().index, 0);
  assert.equal(p.getState().status, 'ready');
});

test('finish manual cancela el temporizador y previous reentra en el paso', () => {
  const clock = fakeClock();
  const p = make(DAY, clock);
  p.start();
  clock.advance(5000);
  const s = p.finish();
  assert.equal(s.status, 'finished');
  assert.equal(s.remainingSeconds, null);
  assert.equal(clock.pending(), 0);
  assert.equal(p.next().status, 'finished');
  const back = p.previous();
  assert.equal(back.status, 'ready');
  assert.equal(back.index, 0);
});

test('rechaza pasos con timing inválido o per_side en repeticiones', () => {
  assert.throws(() => new DayPlayer([{ timing: { kind: 'repetitions', count: 3, basis: 'per_side' } }]));
  assert.throws(() => new DayPlayer([{ timing: { kind: 'exact', seconds: 0, basis: 'total' } }]));
  assert.throws(() => new DayPlayer([]));
});

test('repeticiones exigen count entero positivo', () => {
  for (const count of [undefined, null, 0, -1, 2.5, NaN, '10']) {
    assert.throws(() => new DayPlayer([{ timing: { kind: 'repetitions', count, basis: 'total' } }]), /Timing no válido/);
  }
  assert.equal(new DayPlayer([{ timing: { kind: 'repetitions', count: 10, basis: 'total' } }]).getState().status, 'manual');
});
