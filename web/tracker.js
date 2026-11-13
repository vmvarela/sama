// Plan 300: seguimiento semanal del programa. Datos en week-data.json (relativo al documento).
(() => {
  'use strict';

  const KEY = 'yogaMinimal.tracker';
  const TOTAL = 300;
  const byId = id => document.getElementById(id);

  const els = {
    view: byId('tracker-view'),
    modePlan: byId('mode-plan'),
    modeYoga: byId('mode-yoga'),
    modeMeditation: byId('mode-meditation'),
    play: byId('play-btn'),
    title: byId('tracker-title'),
    course: byId('tracker-course'),
    week: byId('tracker-week'),
    prev: byId('tracker-prev'),
    next: byId('tracker-next'),
    done: byId('tracker-done'),
    goto: byId('tracker-goto'),
    bar: byId('tracker-bar'),
    text: byId('tracker-text'),
    reset: byId('tracker-reset'),
    player: {
      card: byId('day-player-card'),
      kicker: byId('day-player-kicker'),
      heading: byId('day-player-heading'),
      close: byId('day-player-close'),
      bar: byId('day-player-bar'),
      counter: byId('day-player-counter'),
      live: byId('day-player-live'),
      poseArea: byId('day-player-pose-area'),
      imgWrap: byId('day-player-image-wrap'),
      poseName: byId('day-player-pose-name'),
      poseFig: byId('day-player-pose-fig'),
      side: byId('day-player-side'),
      instruction: byId('day-player-instruction'),
      notes: byId('day-player-notes'),
      time: byId('day-player-time'),
      timingDesc: byId('day-player-timing-desc'),
      status: byId('day-player-status'),
      rangeOptions: byId('day-player-range-options'),
      rangeMin: byId('day-player-range-min'),
      rangeMax: byId('day-player-range-max'),
      prev: byId('day-player-prev'),
      action: byId('day-player-action'),
      next: byId('day-player-next'),
      finish: byId('day-player-finish'),
      finishedArea: byId('day-player-finished-area'),
      finishedClose: byId('day-player-finished-close'),
    },
  };

  let data = null;
  let imageMap = {}; // nombre de postura → slug | null (images-map.json, clave «poses»)
  let state = loadState();
  let activePlayer = null;
  let activeDay = null; // { schedule, day }
  let lastAnnouncedIndex = -1;
  let lastAnnouncedStatus = null;
  let lastStepCompletedAnnounced = false;

  function freshState() {
    return { v: 2, current: 1, completed: [] };
  }

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 2 && Number.isInteger(s.current) && s.current >= 1 && s.current <= TOTAL) {
        const done = Array.isArray(s.completed) ? s.completed.filter(n => Number.isInteger(n) && n >= 1 && n <= TOTAL) : [];
        return { v: 2, current: s.current, completed: [...new Set(done)] };
      }
    } catch (e) { /* JSON corrupto o localStorage no disponible: empezar de cero */ }
    return freshState();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* sin persistencia */ }
  }

  function goTo(n) {
    state.current = Math.min(TOTAL, Math.max(1, n));
    save();
    render();
  }

  function complete() {
    const n = state.current;
    if (!state.completed.includes(n)) state.completed.push(n);
    goTo(n + 1);
  }

  function resetProgram() {
    if (!confirm('¿Reiniciar el plan? Se borrará el progreso y volverás a la semana 1.')) return;
    state = freshState();
    save();
    render();
  }

  // --- Render (solo textContent: los datos vienen de OCR) ---

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatDuration(p) {
    const s = p.duration_seconds;
    if (typeof s === 'number' && s > 0) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    return p.duration_raw || '';
  }

  function formatTime(totalSeconds) {
    if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function announce(msg) {
    if (els.player.live) {
      els.player.live.textContent = msg;
    }
  }

  // Sin slug, o si el PNG no existe (onerror), queda solo el texto.
  function poseImage(name) {
    const slug = Object.hasOwn(imageMap, name) ? imageMap[name] : null;
    if (!slug) return null;
    const img = el('img', 'tracker-pose-img');
    img.src = `images/${slug}.png`;
    img.alt = name;
    img.loading = 'lazy';
    img.onerror = () => img.remove();
    return img;
  }

  function poseList(poses) {
    const ul = el('ul', 'tracker-poses');
    for (const p of poses) {
      const li = el('li', 'tracker-pose');
      const img = poseImage(p.name);
      if (img) li.append(img);
      li.append(el('span', 'tracker-name', (p.matched === false ? '? ' : '') + p.name));
      if (p.figures && p.figures.length) {
        li.append(' ', el('span', 'tracker-fig', `(${p.figures.length > 1 ? 'figs.' : 'fig.'} ${p.figures.join(', ')})`));
      }
      if (p.is_cycle) li.append(' ', el('span', 'tracker-tag', '(ciclo)'));
      if (p.per_side === true || p.timing?.basis === 'per_side') li.append(' ', el('span', 'tracker-tag', 'ambos lados'));
      const dur = formatDuration(p);
      if (dur) {
        const d = el('span', 'tracker-dur', dur);
        if (p.duration_raw) d.title = p.duration_raw;
        li.append(' — ', d);
      }
      ul.append(li);
    }
    return ul;
  }

  function notesList(notes) {
    const ul = el('ul', 'tracker-notes');
    for (const n of notes) ul.append(el('li', '', n));
    return ul;
  }

  function block(title, node) {
    const wrap = el('div', 'tracker-block');
    wrap.append(el('h3', '', title), node);
    return wrap;
  }

  // Rango «101–108» o «101-108»: cualquier separador no numérico.
  function schedulesFor(n) {
    return data.schedules.filter(s => {
      const m = /^(\d+)\D+(\d+)$/.exec(s.rango || '');
      return m && n >= Number(m[1]) && n <= Number(m[2]);
    });
  }

  function scheduleBlock(s) {
    const det = el('details', 'tracker-block');
    det.append(el('summary', '', `Plan por días · curso ${s.course} · ${s.scope}`));
    for (const d of s.days) {
      if (d.day === 'todos') {
        det.append(el('h4', 'tracker-day', 'Todos los días'));
      } else {
        const dayHeader = el('div', 'tracker-day-header');
        dayHeader.append(el('h4', 'tracker-day', `Día ${d.day}`));
        if (d.poses && d.poses.length) {
          const btn = el('button', 'tracker-practice-btn', '▶ Practicar este día');
          btn.type = 'button';
          btn.setAttribute('aria-label', `Practicar día ${d.day}`);
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            startDayPractice(s, d);
          });
          dayHeader.append(btn);
        }
        det.append(dayHeader);
      }
      if (d.poses && d.poses.length) det.append(poseList(d.poses));
      if (d.notes && d.notes.length) det.append(notesList(d.notes));
    }
    return det;
  }

  // --- Reproductor de práctica diaria ---

  function renderPlayerNotes(step, dayNotes) {
    const box = els.player.notes;
    box.replaceChildren();
    if (!dayNotes || !dayNotes.length) {
      box.hidden = true;
      return;
    }
    const stepBase = (step.name || '').toLowerCase().replace(/\s+[ivx]+$/i, '').trim();
    const stepFull = (step.name || '').toLowerCase();
    const matching = dayNotes.filter(n => {
      const nl = n.toLowerCase();
      return nl.includes(stepFull) || (stepBase.length > 4 && nl.includes(stepBase));
    });
    const others = dayNotes.filter(n => !matching.includes(n));

    if (matching.length) {
      for (const note of matching) {
        box.append(el('p', '', note));
      }
      if (others.length) {
        const det = el('details', '');
        det.append(el('summary', 'day-player-notes-summary', 'Otras notas del día'));
        const ul = el('ul', '');
        for (const o of others) ul.append(el('li', '', o));
        det.append(ul);
        box.append(det);
      }
      box.hidden = false;
    } else {
      const det = el('details', '');
      det.append(el('summary', 'day-player-notes-summary', 'Notas del día / alternativas'));
      const ul = el('ul', '');
      for (const n of dayNotes) ul.append(el('li', '', n));
      det.append(ul);
      box.append(det);
      box.hidden = false;
    }
  }

  function updatePlayerUI(st, isInitial = false) {
    if (!activePlayer || !st) return;
    const { status, index, count, step, remainingSeconds } = st;

    // Al acabar todos los pasos del día: nunca marcar la semana automáticamente
    if (status === 'finished') {
      els.player.poseArea.hidden = true;
      els.player.finishedArea.hidden = false;
      els.player.bar.style.width = '100%';
      els.player.counter.textContent = `Completado (${count} de ${count})`;
      announce('Práctica del día completada.');
      lastAnnouncedStatus = 'finished';
      return;
    }

    els.player.poseArea.hidden = false;
    els.player.finishedArea.hidden = true;

    // Contador y progreso
    els.player.counter.textContent = `Paso ${index + 1} de ${count}`;
    els.player.bar.style.width = `${((index + 1) / count) * 100}%`;

    // Cabecera
    els.player.kicker.textContent = `Práctica diaria · Semana ${state.current}`;
    els.player.heading.textContent = activeDay && activeDay.day ? `Día ${activeDay.day.day}` : 'Día';

    // Postura actual
    const currentStep = step || {};
    els.player.poseName.textContent = currentStep.name || '';
    const figs = currentStep.figures;
    els.player.poseFig.textContent = figs && figs.length ? `(${figs.length > 1 ? 'figs.' : 'fig.'} ${figs.join(', ')})` : '';

    // Lado si aplica (per_side se duplica como lado 1 / lado 2)
    if (currentStep.side) {
      els.player.side.textContent = currentStep.side;
      els.player.side.hidden = false;
    } else {
      els.player.side.hidden = true;
    }

    // Imagen
    els.player.imgWrap.replaceChildren();
    const img = poseImage(currentStep.name);
    if (img) {
      img.className = 'day-player-img';
      els.player.imgWrap.append(img);
    }

    // Instrucción de la postura
    if (currentStep.instruction) {
      els.player.instruction.textContent = currentStep.instruction;
      els.player.instruction.hidden = false;
    } else {
      els.player.instruction.hidden = true;
    }

    // Notas y alternativas del día
    const dayNotes = activeDay && activeDay.day && activeDay.day.notes ? activeDay.day.notes : [];
    renderPlayerNotes(currentStep, dayNotes);

    // Temporizador y controles según tipo de duración
    const timing = currentStep.timing;
    const statusBadge = els.player.status;

    if (timing && timing.kind === 'exact') {
      els.player.rangeOptions.hidden = true;
      els.player.timingDesc.textContent = currentStep.duration_raw || `${timing.seconds} s`;
      const rem = remainingSeconds != null ? remainingSeconds : timing.seconds;
      els.player.time.textContent = formatTime(rem);

      const isCompleted = Boolean(st.stepCompleted);

      if (isCompleted) {
        els.player.time.classList.add('is-done');
        els.player.action.hidden = false;
        els.player.action.textContent = (index >= count - 1) ? 'Terminar práctica ✓' : 'Siguiente postura ▶';
        els.player.action.classList.add('is-next');
        statusBadge.hidden = false;
        statusBadge.textContent = '✓ Tiempo cumplido';
        statusBadge.className = 'day-player-status-badge is-done';
      } else {
        els.player.time.classList.remove('is-done');
        els.player.action.classList.remove('is-next');
        if (status === 'running') {
          els.player.action.hidden = false;
          els.player.action.textContent = '⏸ Pausar';
          statusBadge.hidden = true;
        } else if (status === 'paused') {
          els.player.action.hidden = false;
          els.player.action.textContent = '▶ Reanudar';
          statusBadge.hidden = false;
          statusBadge.textContent = 'Pausado';
          statusBadge.className = 'day-player-status-badge is-paused';
        } else {
          els.player.action.hidden = false;
          els.player.action.textContent = `▶ Iniciar (${formatTime(timing.seconds)})`;
          statusBadge.hidden = true;
        }
      }
    } else if (timing && timing.kind === 'range') {
      const min = timing.min_seconds;
      const max = timing.max_seconds;
      els.player.timingDesc.textContent = currentStep.duration_raw || `De ${min} a ${max} s`;

      const isCompleted = Boolean(st.stepCompleted);

      if (isCompleted) {
        els.player.rangeOptions.hidden = true;
        els.player.action.hidden = false;
        els.player.action.textContent = (index >= count - 1) ? 'Terminar práctica ✓' : 'Siguiente postura ▶';
        els.player.action.classList.add('is-next');
        els.player.time.textContent = '00:00';
        els.player.time.classList.add('is-done');
        statusBadge.hidden = false;
        statusBadge.textContent = '✓ Tiempo cumplido';
        statusBadge.className = 'day-player-status-badge is-done';
      } else {
        els.player.time.classList.remove('is-done');
        els.player.action.classList.remove('is-next');
        if (status === 'running') {
          els.player.rangeOptions.hidden = true;
          els.player.action.hidden = false;
          els.player.action.textContent = '⏸ Pausar';
          els.player.time.textContent = formatTime(remainingSeconds != null ? remainingSeconds : 0);
          statusBadge.hidden = true;
        } else if (status === 'paused') {
          els.player.rangeOptions.hidden = true;
          els.player.action.hidden = false;
          els.player.action.textContent = '▶ Reanudar';
          els.player.time.textContent = formatTime(remainingSeconds != null ? remainingSeconds : 0);
          statusBadge.hidden = false;
          statusBadge.textContent = 'Pausado';
          statusBadge.className = 'day-player-status-badge is-paused';
        } else {
          // ready o manual sin override elegido: opciones explícitas mín/máx (nunca promedio)
          els.player.time.textContent = `${formatTime(min)} – ${formatTime(max)}`;
          els.player.rangeOptions.hidden = false;
          els.player.rangeMin.textContent = `▶ Mín. (${formatTime(min)})`;
          els.player.rangeMax.textContent = `▶ Máx. (${formatTime(max)})`;
          els.player.action.hidden = true;
          statusBadge.hidden = true;
        }
      }
    } else if (timing && timing.kind === 'repetitions') {
      els.player.time.classList.remove('is-done');
      els.player.action.classList.remove('is-next');
      els.player.rangeOptions.hidden = true;
      els.player.action.hidden = true;
      els.player.time.textContent = `${timing.count} rep.`;
      els.player.timingDesc.textContent = currentStep.duration_raw || `${timing.count} repeticiones`;
      statusBadge.hidden = false;
      statusBadge.textContent = 'Manual · a tu ritmo';
      statusBadge.className = 'day-player-status-badge is-manual';
    } else {
      // null / sin timing específico: manual a su ritmo
      els.player.time.classList.remove('is-done');
      els.player.action.classList.remove('is-next');
      els.player.rangeOptions.hidden = true;
      els.player.action.hidden = true;
      els.player.time.textContent = '—:—';
      els.player.timingDesc.textContent = currentStep.duration_raw || 'Manual · a tu ritmo';
      statusBadge.hidden = false;
      statusBadge.textContent = 'Manual · a tu ritmo';
      statusBadge.className = 'day-player-status-badge is-manual';
    }

    // Botones de paso: transiciones confirmadas por el usuario
    els.player.prev.disabled = (index <= 0);
    els.player.next.disabled = false;
    els.player.next.textContent = (index >= count - 1) ? 'Terminar ✓' : 'Siguiente ▶';

    // Notificaciones discretas para lectores de pantalla
    if (isInitial || index !== lastAnnouncedIndex) {
      const sideText = currentStep.side ? `, ${currentStep.side}` : '';
      const durText = currentStep.duration_raw ? `. ${currentStep.duration_raw}` : '';
      announce(`${currentStep.name || 'Postura'}${sideText}. Paso ${index + 1} de ${count}${durText}`);
      lastAnnouncedIndex = index;
      lastStepCompletedAnnounced = false;
    } else if (st.stepCompleted && !lastStepCompletedAnnounced) {
      announce(`Tiempo cumplido para ${currentStep.name || 'la postura'}. Pulsa siguiente para continuar.`);
      lastStepCompletedAnnounced = true;
    } else if (status !== lastAnnouncedStatus) {
      if (status === 'paused') announce('Práctica pausada.');
      else if (status === 'running' && lastAnnouncedStatus === 'paused') announce('Práctica reanudada.');
    }
    lastAnnouncedStatus = status;
  }

  function startDayPractice(s, d) {
    if (typeof window.DayPlayer !== 'function') {
      alert('El motor de práctica diaria (DayPlayer) no está disponible.');
      return;
    }
    if (activePlayer) {
      const st = activePlayer.getState();
      const isSameDay = activeDay &&
        activeDay.day && activeDay.day.day === d.day &&
        activeDay.schedule &&
        (activeDay.schedule === s || (activeDay.schedule.course === s.course && activeDay.schedule.rango === s.rango && activeDay.schedule.scope === s.scope));

      if (st && st.status !== 'finished') {
        if (isSameDay) {
          // Reabre el reproductor existente conservando el paso actual y tiempo restante
          if (els.play && els.play.textContent.startsWith('⏸')) els.play.click();
          els.player.card.hidden = false;
          els.player.card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          els.player.card.focus();
          updatePlayerUI(st, false);
          announce(`Continuando práctica de día ${d.day}. Paso ${st.index + 1} de ${st.count}: ${st.step?.name || ''}`);
          return;
        }
        if (!confirm('Ya hay una práctica en curso. ¿Deseas detenerla para iniciar este día?')) return;
        activePlayer.finish();
      }
    }
    // Pausa el timer corto si estuviera activo
    if (els.play && els.play.textContent.startsWith('⏸')) els.play.click();

    activeDay = { schedule: s, day: d };
    lastAnnouncedIndex = -1;
    lastAnnouncedStatus = null;
    lastStepCompletedAnnounced = false;

    try {
      activePlayer = new window.DayPlayer(d.poses, {
        onUpdate: (st) => updatePlayerUI(st, false),
        now: () => Date.now(),
        schedule: (fn, ms) => setTimeout(fn, ms),
        cancel: id => clearTimeout(id),
      });
    } catch (err) {
      console.error(err);
      alert('No se pudo inicializar la práctica del día.');
      return;
    }

    els.player.card.hidden = false;
    els.player.card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    els.player.card.focus();
    updatePlayerUI(activePlayer.getState(), true);
  }

  function pauseActiveDailyPlayer() {
    if (activePlayer) {
      try {
        const st = activePlayer.getState();
        if (st && st.status === 'running') {
          activePlayer.pause();
        }
      } catch (e) { /* ignore */ }
    }
  }

  function bindPlayerEvents() {
    els.player.action.addEventListener('click', () => {
      if (!activePlayer) return;
      const st = activePlayer.getState();
      const isCompleted = Boolean(st.stepCompleted);
      if (isCompleted) {
        if (st.index >= st.count - 1) activePlayer.finish();
        else activePlayer.next();
      } else if (st.status === 'running') {
        activePlayer.pause();
      } else if (st.status === 'paused') {
        activePlayer.resume();
      } else {
        activePlayer.start();
      }
    });

    els.player.rangeMin.addEventListener('click', () => {
      if (!activePlayer) return;
      const st = activePlayer.getState();
      if (st.step && st.step.timing && st.step.timing.min_seconds != null) {
        activePlayer.start(st.step.timing.min_seconds);
      }
    });

    els.player.rangeMax.addEventListener('click', () => {
      if (!activePlayer) return;
      const st = activePlayer.getState();
      if (st.step && st.step.timing && st.step.timing.max_seconds != null) {
        activePlayer.start(st.step.timing.max_seconds);
      }
    });

    els.player.prev.addEventListener('click', () => {
      if (activePlayer) activePlayer.previous();
    });

    els.player.next.addEventListener('click', () => {
      if (!activePlayer) return;
      const st = activePlayer.getState();
      if (st.index >= st.count - 1) {
        activePlayer.finish();
      } else {
        activePlayer.next();
      }
    });

    els.player.finish.addEventListener('click', () => {
      if (!activePlayer) return;
      if (confirm('¿Terminar la práctica de hoy?')) {
        activePlayer.finish();
      }
    });

    els.player.close.addEventListener('click', () => {
      if (!activePlayer) {
        els.player.card.hidden = true;
        return;
      }
      const st = activePlayer.getState();
      if (st.status === 'running') {
        if (!confirm('La práctica está en curso. ¿Deseas pausar y salir?')) return;
        activePlayer.pause();
      }
      els.player.card.hidden = true;
    });

    els.player.finishedClose.addEventListener('click', () => {
      els.player.card.hidden = true;
      activePlayer = null;
      activeDay = null;
    });
  }

  function apuntesBlock(course, list) {
    const det = el('details', 'tracker-block');
    det.append(el('summary', '', `Apuntes del curso ${course}`));
    for (const a of list) {
      if (a.type) det.append(el('h4', 'tracker-day', a.type));
      det.append(el('p', 'tracker-apunte', a.text));
    }
    return det;
  }

  function renderWeek(week) {
    const box = els.week;
    box.replaceChildren();
    if (week.consejo) box.append(el('p', 'tracker-consejo', week.consejo));
    if (week.poses.length) box.append(poseList(week.poses));
    else if (week.kind === 'program') box.append(el('p', 'tracker-empty', 'Sin asanas listadas esta semana; revisa el plan por días si aplica.'));
    if (week.notes.length) box.append(block('Notas', notesList(week.notes)));
    if (week.uncertain) box.append(el('p', 'tracker-warn', 'Lectura OCR dudosa en esta semana: revisa con el libro.'));
    for (const s of schedulesFor(week.week)) box.append(scheduleBlock(s));
    const apuntes = data.apuntes.filter(a => a.course === week.course);
    if (apuntes.length) box.append(apuntesBlock(week.course, apuntes));
  }

  function render() {
    if (!data) return;
    const n = state.current;
    const week = data.weeks.find(w => w.week === n);
    if (!week) return;
    const all = state.completed.length >= TOTAL;
    const isDone = state.completed.includes(n);
    els.title.textContent = `Semana ${n} de ${TOTAL}`;
    els.course.textContent = `Curso ${week.course}${isDone ? ' · completada ✓' : ''}`;
    renderWeek(week);
    els.prev.disabled = n <= 1;
    els.next.disabled = n >= TOTAL;
    els.done.disabled = all;
    els.goto.value = n;
    els.bar.style.width = `${(state.completed.length / TOTAL) * 100}%`;
    els.text.textContent = all ? 'Programa completado' : `${state.completed.length} / ${TOTAL} completadas`;
  }

  // --- Modo: oculta la vista yoga/meditación mientras el plan está activo ---

  function setPlanMode(on) {
    els.view.hidden = !on;
    els.modePlan.classList.toggle('active', on);
    if (on) {
      els.modeYoga.classList.remove('active');
      els.modeMeditation.classList.remove('active');
    }
    document.querySelectorAll('main > :not(#tracker-view), .session-info')
      .forEach(node => node.classList.toggle('is-hidden', on));
    if (on) {
      // pausa el temporizador de yoga para que no avance en segundo plano
      if (els.play.textContent.startsWith('⏸')) els.play.click();
      render();
    } else {
      // salir del plan: pausa la sesión diaria activa para evitar dos temporizadores
      pauseActiveDailyPlayer();
    }
  }

  els.modePlan.addEventListener('click', () => setPlanMode(true));
  els.modeYoga.addEventListener('click', () => setPlanMode(false));
  els.modeMeditation.addEventListener('click', () => setPlanMode(false));
  els.prev.addEventListener('click', () => goTo(state.current - 1));
  els.next.addEventListener('click', () => goTo(state.current + 1));
  els.done.addEventListener('click', complete);
  els.goto.addEventListener('change', () => {
    const n = parseInt(els.goto.value, 10);
    if (Number.isInteger(n)) goTo(n); else render();
  });
  els.reset.addEventListener('click', resetProgram);

  bindPlayerEvents();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseActiveDailyPlayer();
  });

  const getJson = url => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

  Promise.all([getJson('week-data.json'), getJson('images-map.json').catch(() => ({}))])
    .then(([json, map]) => { data = json; imageMap = map.poses || {}; render(); setPlanMode(true); })
    .catch(() => { els.week.textContent = 'No se pudieron cargar los datos del programa.'; });
})();
