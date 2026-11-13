let sequence = [];
let currentIndex = 0;
let timerInterval = null;
let timeLeft = 0;
let isPlaying = false;

const els = {
  sessionName: document.getElementById('session-name'),
  timer: document.getElementById('timer'),
  image: document.getElementById('pose-image'),
  name: document.getElementById('pose-name'),
  instruction: document.getElementById('pose-instruction'),
  breath: document.getElementById('pose-breath'),
  prev: document.getElementById('prev-btn'),
  play: document.getElementById('play-btn'),
  next: document.getElementById('next-btn'),
  bar: document.getElementById('progress-bar'),
  text: document.getElementById('progress-text'),
  modeYoga: document.getElementById('mode-yoga'),
  modeMeditation: document.getElementById('mode-meditation'),
  music: document.getElementById('music-btn'),
};

let mode = 'yoga';

async function loadSequence(m) {
  if (m) mode = m;
  const file = mode === 'meditation' ? 'meditation.json' : 'sequences.json';
  const res = await fetch(file);
  const data = await res.json();
  sequence = data.poses;
  els.sessionName.textContent = data.name;
  showPose(0);
  // actualizar botones de modo
  els.modeYoga.classList.toggle('active', mode === 'yoga');
  els.modeMeditation.classList.toggle('active', mode === 'meditation');
}

function showPose(index) {
  if (index < 0 || index >= sequence.length) return;
  currentIndex = index;
  const pose = sequence[index];
  els.name.textContent = pose.name;
  els.instruction.textContent = pose.instruction;
  els.breath.textContent = pose.breath;
  els.image.src = 'images/' + pose.image + '.png';
  els.image.alt = pose.name;
  timeLeft = pose.duration;
  updateTimer();
  updateProgress();
  if (isPlaying) startTimer();
}

function updateTimer() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  els.timer.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function updateProgress() {
  const pct = ((currentIndex + 1) / sequence.length) * 100;
  els.bar.style.width = pct + '%';
  els.text.textContent = `${currentIndex + 1} / ${sequence.length}`;
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimer();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      // solo el avance automático suena: prev/next/selección manual y pausa son silenciosos
      if (currentIndex < sequence.length - 1) {
        showPose(currentIndex + 1);
        playCue('chime');
      } else {
        isPlaying = false;
        els.play.textContent = '▶ Iniciar';
        playCue('gong');
      }
    }
  }, 1000);
}

els.play.addEventListener('click', () => {
  if (isPlaying) {
    isPlaying = false;
    clearInterval(timerInterval);
    els.play.textContent = '▶ Reanudar';
  } else {
    if (timeLeft <= 0) showPose(0); // sesión terminada: reinicia desde el principio
    isPlaying = true;
    els.play.textContent = '⏸ Pausar';
    startTimer();
  }
});

els.prev.addEventListener('click', () => { showPose(currentIndex - 1); });
els.next.addEventListener('click', () => { showPose(currentIndex + 1); });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// --- Sonido (Web Audio API): bucle de handpan y señales; un solo control para todo ---
// Los MP3 se leen con fetch y se decodifican: bucle sin hueco y sin peticiones Range.
// shortcut: decodificación completa en memoria (~0.5 MB), basta para estas pistas cortas.
const SOUNDS = { loop: 'audio/handpan.mp3', chime: 'audio/transition.mp3', gong: 'audio/gong.mp3' };
let audioCtx = null;
let soundOn = false;
let buffers = null;      // { loop, chime, gong } ya decodificados
let loading = null;      // promesa única de carga (se reintenta si falla)
let loopSrc = null;      // fuente del bucle activo
const voices = new Map(); // fuente -> ganancia, para poder parar todo lo que suena

function loadSounds() {
  if (!loading) {
    loading = Promise.all(Object.entries(SOUNDS).map(async ([key, url]) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      return [key, await audioCtx.decodeAudioData(await res.arrayBuffer())];
    })).then(list => { buffers = Object.fromEntries(list); })
      .catch(err => { loading = null; throw err; });
  }
  return loading;
}

function voice(buffer, { loop = false, gain = 1, fadeIn = 0 } = {}) {
  const now = audioCtx.currentTime;
  const src = audioCtx.createBufferSource();
  const g = audioCtx.createGain();
  src.buffer = buffer;
  src.loop = loop;
  g.gain.setValueAtTime(fadeIn ? 0 : gain, now);
  if (fadeIn) g.gain.linearRampToValueAtTime(gain, now + fadeIn);
  src.connect(g);
  g.connect(audioCtx.destination);
  src.onended = () => { src.disconnect(); g.disconnect(); voices.delete(src); };
  voices.set(src, g);
  src.start();
  return src;
}

function stopAll() {
  const now = audioCtx.currentTime;
  for (const [src, g] of voices) {
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(0, now + 1.5);
    src.stop(now + 1.5);
  }
  voices.clear();
}

function startSound() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  soundOn = true;
  els.music.textContent = '♫ Música (on)';
  if (!audioCtx) audioCtx = new Ctx();
  audioCtx.resume().catch(() => {}); // dentro del gesto del usuario
  loadSounds().then(() => {
    if (soundOn && !loopSrc) loopSrc = voice(buffers.loop, { loop: true, gain: 0.6, fadeIn: 2 });
  }).catch(() => stopSound());
}

function stopSound() {
  soundOn = false;
  loopSrc = null;
  els.music.textContent = '♪ Música';
  if (audioCtx) stopAll();
}

// Señales de transición: solo si el sonido está activo y ya hay buffers.
function playCue(name) {
  if (soundOn && buffers) voice(buffers[name]);
}

els.music.addEventListener('click', () => {
  if (soundOn) stopSound(); else startSound();
});

els.modeYoga.addEventListener('click', () => loadSequence('yoga'));
els.modeMeditation.addEventListener('click', () => loadSequence('meditation'));

loadSequence('yoga');