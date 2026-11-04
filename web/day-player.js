// Motor puro de reproducción de un día del schedule (sin DOM, script clásico).
// Reloj, temporizador y notificación son inyectables para poder probarlo.
// shortcut: onUpdate llega por tick de 1 s, no por frame; subir la cadencia solo si la UI lo necesita.

const DAY_PLAYER_TICK_MS = 1000;

const dayPositive = x => Number.isFinite(x) && x > 0;

function checkDayStep(step) {
  if (!step || typeof step !== 'object') throw new Error('Paso no válido');
  const t = step.timing;
  if (t === undefined || t === null) return;
  const basis = t.basis === 'total' || t.basis === 'per_side';
  const valid =
    (t.kind === 'exact' && basis && dayPositive(t.seconds)) ||
    (t.kind === 'range' && basis && dayPositive(t.min_seconds) && Number.isFinite(t.max_seconds) && t.max_seconds >= t.min_seconds) ||
    (t.kind === 'repetitions' && t.basis === 'total' && Number.isInteger(t.count) && t.count > 0);
  if (!valid) throw new Error('Timing no válido: ' + JSON.stringify(t));
}

// per_side: dos pasos con la duración completa por lado; nunca se divide.
function expandDaySteps(steps) {
  return steps.flatMap(step => {
    const t = step.timing;
    if (!t || t.basis !== 'per_side') return [{ ...step }];
    return [{ ...step, side: 'lado 1' }, { ...step, side: 'lado 2' }];
  });
}

// Rango: el override solo temporiza dentro de [min, max]; nunca se promedia.
const dayInRange = (v, t) => Number.isFinite(v) && v >= t.min_seconds && v <= t.max_seconds;

class DayPlayer {
  constructor(steps, opts = {}) {
    if (!Array.isArray(steps) || steps.length === 0) throw new Error('El día no tiene pasos');
    steps.forEach(checkDayStep);
    this.steps = expandDaySteps(steps);
    this.onUpdate = opts.onUpdate || (() => {});
    this.now = opts.now || (() => performance.now());
    this.schedule = opts.schedule || ((fn, ms) => setTimeout(fn, ms));
    this.cancelTimer = opts.cancel || (h => clearTimeout(h));
    this.index = 0;
    this.deadline = null; // instante absoluto de fin mientras corre
    this.pausedMs = null; // ms restantes mientras está pausado
    this.timer = null;
    this.stepCompleted = false; // temporizador agotado en un paso no final: espera next
    this.status = this.entryStatus();
  }

  // Un paso exacto queda listo para start(); el resto espera a que el usuario lo haga a mano.
  entryStatus() {
    const t = this.steps[this.index].timing;
    return t && t.kind === 'exact' ? 'ready' : 'manual';
  }

  getState() {
    return {
      status: this.status,
      index: this.index,
      count: this.steps.length,
      step: { ...this.steps[this.index] },
      remainingSeconds: this.remainingSeconds(),
      stepCompleted: this.stepCompleted,
    };
  }

  remainingSeconds() {
    if (this.status === 'running') {
      return this.stepCompleted ? 0 : Math.max(0, Math.ceil((this.deadline - this.now()) / 1000));
    }
    if (this.status === 'paused') return Math.ceil(this.pausedMs / 1000);
    if (this.status === 'ready') return this.steps[this.index].timing.seconds;
    return null;
  }

  start(secondsOverride) {
    if (this.status !== 'ready' && this.status !== 'manual') return this.getState();
    const t = this.steps[this.index].timing;
    let seconds = null;
    if (t && t.kind === 'exact') seconds = t.seconds;
    else if (t && t.kind === 'range' && dayInRange(secondsOverride, t)) seconds = secondsOverride;
    if (seconds === null) {
      this.status = 'manual';
      return this.emit();
    }
    this.deadline = this.now() + seconds * 1000;
    this.status = 'running';
    this.scheduleTick();
    return this.emit();
  }

  pause() {
    if (this.status !== 'running' || this.stepCompleted) return this.getState();
    this.pausedMs = Math.max(0, this.deadline - this.now());
    this.deadline = null;
    this.cancelPending();
    this.status = 'paused';
    return this.emit();
  }

  resume() {
    if (this.status !== 'paused') return this.getState();
    this.deadline = this.now() + this.pausedMs;
    this.pausedMs = null;
    this.status = 'running';
    this.scheduleTick();
    return this.emit();
  }

  // Nunca arranca el siguiente paso: solo cambia de paso y espera acción.
  next() {
    if (this.status === 'finished') return this.getState();
    if (this.index === this.steps.length - 1) return this.finish();
    return this.goTo(this.index + 1);
  }

  previous() {
    if (this.status === 'finished') return this.goTo(this.index);
    if (this.index === 0) return this.getState();
    return this.goTo(this.index - 1);
  }

  finish() {
    this.cancelPending();
    this.deadline = null;
    this.pausedMs = null;
    this.stepCompleted = false;
    this.status = 'finished';
    return this.emit();
  }

  goTo(index) {
    this.cancelPending();
    this.deadline = null;
    this.pausedMs = null;
    this.stepCompleted = false;
    this.index = index;
    this.status = this.entryStatus();
    return this.emit();
  }

  scheduleTick() {
    this.cancelPending();
    const delay = Math.min(DAY_PLAYER_TICK_MS, Math.max(0, this.deadline - this.now()));
    this.timer = this.schedule(() => this.onTick(), delay);
  }

  onTick() {
    this.timer = null;
    if (this.status !== 'running' || this.stepCompleted) return;
    if (this.deadline - this.now() > 0) {
      this.scheduleTick();
    } else if (this.index === this.steps.length - 1) {
      this.finish(); // último paso temporizado: termina en el límite
      return;
    } else {
      this.deadline = null;
      this.stepCompleted = true; // se queda en 0 hasta que el usuario pulse next
    }
    this.emit();
  }

  cancelPending() {
    if (this.timer !== null) this.cancelTimer(this.timer);
    this.timer = null;
  }

  emit() {
    const state = this.getState();
    this.onUpdate(state);
    return state;
  }
}

if (typeof window !== 'undefined') window.DayPlayer = DayPlayer;
