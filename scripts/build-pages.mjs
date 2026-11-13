#!/usr/bin/env node
// Ensambla el sitio público de GitHub Pages (SAMA): la app completa, desde una lista explícita.
// Uso: node scripts/build-pages.mjs (siempre genera dist/pages dentro del repo).
// Las opciones root/out existen solo en la API de test, no en el CLI destructivo.
// Nunca copia web/ de forma recursiva ni ejecuta Zig; el libro (PDF/Markdown) queda fuera.
// Inventario con hashes y tamaño: <out>.inventory.json (fuera del sitio publicado).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Contrato público: origen (relativo a --root) → destino dentro del sitio.
// `build-id` marca el único archivo que se transforma (sustituye __BUILD__).
// `data` marca un JSON de datos cuyo texto libre no es un archivo de referencias.
const PUBLIC_IMAGES = fs.readdirSync(path.join(REPO, 'web', 'images'))
  .filter(f => f.endsWith('.png')).sort()
  .map(f => ({ from: `web/images/${f}`, to: `images/${f}` }));

export const PUBLIC_ALLOWLIST = [
  { from: 'web/index.html', to: 'index.html' },
  { from: 'web/pages-sw.js', to: 'sw.js', transform: 'build-id' },
  { from: 'web/style.css', to: 'style.css' },
  { from: 'web/tracker.css', to: 'tracker.css' },
  { from: 'web/app.js', to: 'app.js' },
  { from: 'web/tracker.js', to: 'tracker.js' },
  { from: 'web/day-player.js', to: 'day-player.js' },
  { from: 'web/manifest.json', to: 'manifest.json' },
  { from: 'web/sequences.json', to: 'sequences.json' },
  { from: 'web/meditation.json', to: 'meditation.json' },
  { from: 'web/images-map.json', to: 'images-map.json' },
  { from: 'web/week-data.json', to: 'week-data.json', data: true },
  { from: 'web/audio/handpan.mp3', to: 'audio/handpan.mp3' },
  { from: 'web/audio/transition.mp3', to: 'audio/transition.mp3' },
  { from: 'web/audio/gong.mp3', to: 'audio/gong.mp3' },
  { from: 'web/icons/icon-180.png', to: 'icons/icon-180.png' },
  { from: 'web/icons/icon-192.png', to: 'icons/icon-192.png' },
  { from: 'web/icons/icon-512.png', to: 'icons/icon-512.png' },
  ...PUBLIC_IMAGES,
];

// Nada de esto puede publicarse: libro (PDF/Markdown), código Zig, binarios, fuentes de
// audio, ficheros de caché y metadatos de sistema. El Plan 300 y sus datos sí se publican.
const FORBIDDEN = /(\.pdf$|\.md$|\.zig|\.zon|\.o$|\.a$|\.log$|\.mjs$|\.(flac|ogg|wav)$|cache|DS_Store|\.git)/i;
const TEXT_EXT = /\.(html|css|js|json|webmanifest)$/;
// Referencias absolutas a la raíz del origen (rompen en /sama/): "/x", '/x', `/x`, url(/x), =/x.
// `\\` en la exclusión: `(/\s…` es el inicio de una expresión regular, no una ruta.
const ABSOLUTE_REF = /(["'`(]|=)\/(?![\\/*])/;

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

function assertRegularPath(root, rel) {
  // Cada componente desde web/ debe ser directorio o archivo regular, nunca symlink.
  let cur = root;
  for (const part of rel.split('/')) {
    cur = path.join(cur, part);
    const st = fs.lstatSync(cur, { throwIfNoEntry: false });
    if (!st) throw new Error(`falta ${rel}`);
    if (st.isSymbolicLink()) throw new Error(`symlink no permitido: ${rel}`);
  }
  if (!fs.lstatSync(path.join(root, rel)).isFile()) throw new Error(`no es un archivo regular: ${rel}`);
}

function walk(dir, base = dir, acc = []) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const st = fs.lstatSync(full);
    if (st.isSymbolicLink()) throw new Error(`symlink en salida: ${path.relative(base, full)}`);
    if (st.isDirectory()) walk(full, base, acc);
    else if (st.isFile()) acc.push(path.relative(base, full).split(path.sep).join('/'));
    else throw new Error(`entrada no regular en salida: ${path.relative(base, full)}`);
  }
  return acc;
}

// --out se borra con rmSync: la validación se hace sobre rutas canónicas (symlinks resueltos).
// Minúsculas en las comparaciones de ancestro/descendiente: macOS es case-insensitive y rechazar de más es lo seguro.
function canonical(p) {
  let cur = path.resolve(p);
  const tail = [];
  while (!fs.existsSync(cur)) {
    const up = path.dirname(cur);
    if (up === cur) break;
    tail.unshift(path.basename(cur));
    cur = up;
  }
  return path.join(fs.realpathSync.native(cur), ...tail);
}

const lower = s => s.toLowerCase();
const isInside = (child, parent) => lower(child).startsWith(lower(parent) + path.sep);
const sameLower = (a, b) => lower(a) === lower(b);

// Ruta léxica dentro del origen: ningún componente existente entre la raíz y out puede ser symlink
// (un dist -> docs o dist -> externo haría que el borrado sucediera en otro sitio).
function assertNoSymlinkBelowRoot(out, root) {
  const lo = path.resolve(out), lr = path.resolve(root);
  if (!isInside(lo, lr)) return;
  let cur = lr;
  for (const part of lo.slice(lr.length + 1).split(path.sep)) {
    cur = path.join(cur, part);
    const st = fs.lstatSync(cur, { throwIfNoEntry: false });
    if (st && st.isSymbolicLink()) throw new Error(`symlink en la ruta de --out: ${path.relative(lr, cur)}`);
  }
}

function assertSafeOut(out, root) {
  assertNoSymlinkBelowRoot(out, root);
  const o = canonical(out);
  const r = canonical(root);
  const designated = path.join(r, "dist", "pages");
  if (o === path.parse(o).root) throw new Error("--out no puede ser la raíz del sistema de archivos");
  if (sameLower(o, r)) throw new Error("--out no puede ser la raíz del origen");
  if (isInside(r, o)) throw new Error("--out no puede ser un ancestro del origen");
  if (isInside(o, r) && o !== designated) {
    throw new Error(`--out dentro del origen solo puede ser dist/pages (recibido ${path.relative(r, o) || "."})`);
  }
}

// Un --out existente solo se borra si está vacío o su contenido coincide exactamente
// con el último build de esa salida (inventario hermano <out>.inventory.json).
function assertDeletable(out) {
  const st = fs.lstatSync(out, { throwIfNoEntry: false });
  if (!st) return;
  if (!st.isDirectory()) throw new Error(`--out existe y no es un directorio real: ${out}`);
  if (fs.readdirSync(out).length === 0) return;
  const inv = `${out}.inventory.json`;
  if (!fs.existsSync(inv)) throw new Error(`--out contiene archivos ajenos (sin inventario de build previo): ${out}`);
  const prev = JSON.parse(fs.readFileSync(inv, "utf8")).files.map(e => e.path).sort();
  let actual;
  try {
    actual = walk(out).sort();
  } catch (e) {
    throw new Error(`--out contiene entradas no regulares: ${e.message}`);
  }
  if (JSON.stringify(actual) !== JSON.stringify(prev)) {
    throw new Error(`--out no coincide con el último build, no se borra: ${out}`);
  }
}

export function buildPages({ root = REPO, out = path.join(REPO, 'dist', 'pages'), allowlist = PUBLIC_ALLOWLIST } = {}) {
  root = path.resolve(root);
  out = path.resolve(out);
  assertSafeOut(out, root);

  // 1) Validar el contrato antes de tocar la salida.
  const seen = new Set();
  for (const e of allowlist) {
    if (seen.has(e.to)) throw new Error(`destino duplicado: ${e.to}`);
    seen.add(e.to);
    if (FORBIDDEN.test(e.to) || FORBIDDEN.test(e.from)) throw new Error(`entrada prohibida: ${e.from} → ${e.to}`);
    if (e.to.startsWith('/') || e.to.includes('..')) throw new Error(`destino inválido: ${e.to}`);
    assertRegularPath(root, e.from);
  }

  // 2) Leer orígenes y calcular el id de build a partir del contenido (sin sw.js).
  const sources = allowlist.map(e => ({ ...e, bytes: fs.readFileSync(path.join(root, e.from)) }));
  const buildId = sha256(sources.filter(s => !s.transform)
    .map(s => `${s.to}\n${sha256(s.bytes)}\n`).join('')).slice(0, 12);

  // 3) Salida nueva y contenido final.
  const files = sources.map(s => {
    let bytes = s.bytes;
    if (s.transform === 'build-id') {
      const text = bytes.toString('utf8');
      const hits = text.split('__BUILD__').length - 1;
      if (hits !== 1) throw new Error(`${s.from}: debe contener __BUILD__ exactamente una vez`);
      bytes = Buffer.from(text.replace('__BUILD__', buildId), 'utf8');
    }
    if (TEXT_EXT.test(s.to) && !s.data) {
      const text = bytes.toString('utf8');
      const m = text.split('\n').find(line => ABSOLUTE_REF.test(line));
      if (m) throw new Error(`${s.from}: referencia absoluta a la raíz (rompe en /<repo>/): ${m.trim().slice(0, 120)}`);
    }
    return { to: s.to, from: s.from, bytes, sha256: sha256(bytes) };
  });

  assertDeletable(out);
  fs.rmSync(out, { recursive: true, force: true });
  for (const f of files) {
    const dest = path.join(out, f.to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.bytes, { flag: 'wx' });
  }

  // 4) Verificar la salida: inventario exacto, sin symlinks y hashes iguales.
  // .sort() a secas: el orden del recorrido de directorios difiere del lexicográfico
  // (images/… vs images-map.json: '/' 0x2F > '-' 0x2D).
  const expected = files.map(f => f.to).sort();
  const actual = walk(out).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`inventario inesperado:\n  esperado ${expected.join(', ')}\n  real ${actual.join(', ')}`);
  }
  for (const f of files) {
    if (FORBIDDEN.test(f.to)) throw new Error(`salida prohibida: ${f.to}`);
    if (sha256(fs.readFileSync(path.join(out, f.to))) !== f.sha256) throw new Error(`hash distinto: ${f.to}`);
  }

  const totalBytes = files.reduce((n, f) => n + f.bytes.length, 0);
  const inventory = {
    build: buildId,
    totalBytes,
    files: files.map(f => ({ path: f.to, source: f.from, bytes: f.bytes.length, sha256: f.sha256 })),
  };
  fs.writeFileSync(`${out}.inventory.json`, JSON.stringify(inventory, null, 2) + '\n');
  return inventory;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) throw new Error('Este comando no acepta rutas personalizadas; la salida es dist/pages');
  const inv = buildPages();
  const total = inv.totalBytes;
  console.log(`sitio público build ${inv.build}: ${inv.files.length} archivos, ${(total / 1048576).toFixed(2)} MiB`);
  // shortcut: aviso simple de peso; Pages no tiene límite duro, pero un sitio grande lenta la primera carga.
  if (total > 200 * 1048576) console.warn(`⚠ tamaño total ${(total / 1048576).toFixed(2)} MiB > 200 MB: revisa el peso de las imágenes publicadas`);
}
