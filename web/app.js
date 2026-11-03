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
      if (currentIndex < sequence.length - 1) {
        showPose(currentIndex + 1);
      } else {
        isPlaying = false;
        els.play.textContent = '▶ Iniciar';
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

// --- Música ambiental (Web Audio API) ---
let audioCtx = null;
let musicNodes = [];
let musicOn = false;

function startMusic() {
  if (musicOn) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const ctx = audioCtx;
  // Drone suave: tres osciladores con frecuencias armónicas bajas
  const freqs = [110, 164.81, 220];
  const master = ctx.createGain();
  master.gain.value = 0.0;
  master.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2);
  master.connect(ctx.destination);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  filter.connect(master);
  freqs.forEach(f => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.3;
    osc.connect(g);
    g.connect(filter);
    osc.start();
    musicNodes.push(osc, g);
  });
  musicNodes.push(filter, master);
  musicOn = true;
  els.music.textContent = '♫ Música (on)';
}

function stopMusic() {
  if (!musicOn) return;
  const ctx = audioCtx;
  // fade out
  const master = musicNodes[musicNodes.length - 1];
  if (master && master.gain) {
    master.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 1.5);
  }
  setTimeout(() => {
    musicNodes.forEach(n => { try { if (n.stop) n.stop(); } catch(e){} });
    musicNodes = [];
  }, 1600);
  musicOn = false;
  els.music.textContent = '♪ Música';
}

els.music.addEventListener('click', () => {
  if (musicOn) stopMusic(); else startMusic();
});

els.modeYoga.addEventListener('click', () => loadSequence('yoga'));
els.modeMeditation.addEventListener('click', () => loadSequence('meditation'));

loadSequence('yoga');