// Plan 300: seguimiento semanal del programa. Datos en /week-data.json.
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
  };

  let data = null;
  let imageMap = {}; // nombre de postura → slug | null (images-map.json, clave «poses»)
  let state = loadState();

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
      if (p.per_side === true) li.append(' ', el('span', 'tracker-tag', 'ambos lados'));
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
      det.append(el('h4', 'tracker-day', d.day === 'todos' ? 'Todos los días' : `Día ${d.day}`));
      if (d.poses && d.poses.length) det.append(poseList(d.poses));
      if (d.notes && d.notes.length) det.append(notesList(d.notes));
    }
    return det;
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

  const getJson = url => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

  Promise.all([getJson('/week-data.json'), getJson('/images-map.json').catch(() => ({}))])
    .then(([json, map]) => { data = json; imageMap = map.poses || {}; render(); setPlanMode(true); })
    .catch(() => { els.week.textContent = 'No se pudieron cargar los datos del programa.'; });
})();
