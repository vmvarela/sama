// Tests de frontera del build: sitio público (Pages) y tabla embebida del binario.
// Ejecutar: node --test tests/build-boundary.test.mjs
// Los canarios usan un origen fixture: prueban que nada privado puede entrar en la salida.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildPages, PUBLIC_ALLOWLIST, PUBLIC_POSE_SLUGS } from '../scripts/build-pages.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sama-build-test-'));
const expectedPublic = PUBLIC_ALLOWLIST.map(e => e.to).sort();

function listFiles(dir, base = dir, acc = []) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (fs.lstatSync(full).isDirectory()) listFiles(full, base, acc);
    else acc.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return acc.sort();
}

// Origen fixture con cada archivo del contrato más los privados que NO deben publicarse.
function makeFixture(name) {
  const root = path.join(tmp, name);
  for (const e of PUBLIC_ALLOWLIST) {
    const dest = path.join(root, e.from);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const body = e.from.endsWith('pages-sw.js') ? "const BUILD='__BUILD__';\n"
      : e.from.endsWith('public.html') ? '<!doctype html><link rel="stylesheet" href="style.css"><script src="app.js"></script>\n'
      : e.from.endsWith('.json') && e.from.includes('manifest') ? '{"start_url":"./index.html","icons":[]}\n'
      : e.from.endsWith('.json') ? '[]\n'
      : e.from.endsWith('.css') ? 'body{}\n'
      : e.from.endsWith('.js') ? 'let x = 1;\n'
      : `PNG-${e.from}`;
    fs.writeFileSync(dest, body);
  }
  // privados y prohibidos: deben quedar fuera de cualquier salida
  const privados = {
    'web/tracker.js': 'plan 300', 'web/tracker.css': 'x', 'web/day-player.js': 'x',
    'web/week-data.json': '{"weeks":[]}', 'web/images-map.json': '{}',
    'web/images/sama-icon.png': 'icon', 'web/images/anantasana.png': 'tracker-only',
    'web/sw.js': 'private', 'web/index.html': '<h1>privado</h1>',
    'Luz-sobre-el-Yoga.pdf': 'pdf', 'Luz-sobre-el-Yoga.md': '# libro',
    '125593660-iyengar-luz-sobre-el-yoga-yoga-dipika-pdf.pdf': 'pdf',
    'src/main.zig': 'zig', 'zig-out/bin/sama': 'bin', '.zig-cache/x.o': 'o',
    'build.zig': 'zig', 'scripts/build-pages.mjs': 'x', '.git/HEAD': 'ref',
    'assets/handpan/A3_01.flac': 'flac', 'assets/handpan/gong-sweet.ogg': 'ogg',
    'assets/handpan/CREDITS.txt': 'credits', 'assets/handpan/LICENSE.txt': 'license',
    'scripts/compose-audio.py': 'py', 'web/audio/source.flac': 'flac',
  };
  for (const [rel, body] of Object.entries(privados)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
}

test('contrato: sin duplicados, sin entradas prohibidas, pósters explícitos', () => {
  assert.equal(new Set(expectedPublic).size, expectedPublic.length);
  for (const e of PUBLIC_ALLOWLIST) {
    assert.doesNotMatch(e.from, /tracker|day-player|week-data|images-map|sama-icon|\.pdf$|\.md$/i, e.from);
  }
  // las 9 imágenes publicadas son exactamente las que usan las secuencias públicas
  const used = new Set();
  for (const f of ['sequences.json', 'meditation.json']) {
    const data = JSON.parse(fs.readFileSync(path.join(REPO, 'web', f), 'utf8'));
    for (const p of data.poses) used.add(p.image);
  }
  assert.deepEqual([...used].sort(), [...PUBLIC_POSE_SLUGS].sort());
});

test('canario: el origen fixture con privados produce solo el inventario público', () => {
  const root = makeFixture('canary');
  const out = path.join(tmp, 'canary-out');
  const inv = buildPages({ root, out });
  assert.deepEqual(listFiles(out), expectedPublic);
  assert.equal(inv.files.length, expectedPublic.length);
  const names = listFiles(out).join('\n');
  assert.doesNotMatch(names, /tracker|day-player|week-data|images-map|sama-icon|anantasana|\.pdf|\.md|\.zig|\.o$|\.git|build\.|scripts|src\/|\.flac|\.ogg|CREDITS|LICENSE|compose-audio/);
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /privado/);
  assert.equal(fs.existsSync(`${out}.inventory.json`), true);
});

test('rechaza symlink en un archivo del contrato', () => {
  const root = makeFixture('symlink');
  fs.rmSync(path.join(root, 'web/app.js'));
  fs.symlinkSync(path.join(root, 'web/style.css'), path.join(root, 'web/app.js'));
  assert.throws(() => buildPages({ root, out: path.join(tmp, 'symlink-out') }), /symlink/);
});

test('rechaza referencias absolutas a la raíz del origen', () => {
  const root = makeFixture('absolute');
  fs.writeFileSync(path.join(root, 'web/public.html'), '<link rel="stylesheet" href="/style.css">\n');
  assert.throws(() => buildPages({ root, out: path.join(tmp, 'absolute-out') }), /referencia absoluta/);
});

test('rechaza salida dentro de web/ o de la raíz', () => {
  const root = makeFixture('badout');
  assert.throws(() => buildPages({ root, out: path.join(root, 'web', 'x') }), /dentro del origen/);
  assert.throws(() => buildPages({ root, out: root }), /raíz/);
});

// Regresiones de borrado: cada destino peligroso debe rechazarse ANTES de rmSync.
// Los centinelas demuestran que nada se borró; no se borra ningún archivo real del repo.
test('--out nunca borra raíz, ancestros ni rutas del repo distintas de dist/pages', () => {
  const root = makeFixture('guard');
  const sentinels = [
    path.join(root, 'README.md'), path.join(root, 'docs', 'ops.md'),
    path.join(root, '.github', 'workflows', 'pages.yml'), path.join(root, 'dist', 'keep.txt'),
    path.join(root, 'dist', 'pages-other', 'keep.txt'),
    path.join(path.dirname(root), 'guard-parent-keep.txt'),
  ];
  for (const p of sentinels) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 'keep'); }
  const targets = [
    root, path.dirname(root), path.dirname(path.dirname(root)), path.parse(root).root,
    path.join(root, 'README.md'), path.join(root, 'docs'), path.join(root, '.github'),
    path.join(root, 'dist'), path.join(root, 'dist', 'pages-other'), path.join(root, 'web'),
    path.join(root, 'dist', 'pages', '..'), path.join(root, 'dist', 'pages', '..', '..'),
  ];
  for (const out of targets) {
    assert.throws(() => buildPages({ root, out }), /--out/, `debía rechazar ${out}`);
  }
  for (const p of sentinels) assert.equal(fs.readFileSync(p, 'utf8'), 'keep', `borrado inesperado: ${p}`);
});

test('--out dist/pages exacto sí se publica y se reconstruye sin tocar hermanos', () => {
  const root = makeFixture('designated');
  const sibling = path.join(root, 'dist', 'pages-other', 'keep.txt');
  fs.mkdirSync(path.dirname(sibling), { recursive: true }); fs.writeFileSync(sibling, 'keep');
  const out = path.join(root, 'dist', 'pages');
  buildPages({ root, out });
  buildPages({ root, out }); // segunda vez: el contenido coincide con el inventario previo
  assert.deepEqual(listFiles(out), expectedPublic);
  assert.equal(fs.readFileSync(sibling, 'utf8'), 'keep');
});

test('--out ajeno y no vacío (sin inventario previo) no se borra', () => {
  const root = makeFixture('foreign');
  const out = path.join(tmp, 'foreign-out');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'precious.txt'), 'keep');
  assert.throws(() => buildPages({ root, out }), /ajenos/);
  assert.equal(fs.readFileSync(path.join(out, 'precious.txt'), 'utf8'), 'keep');
});

test('CLI rechaza --out personalizado antes de poder borrar una ruta externa', () => {
  const out = path.join(tmp, 'cli-victim');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'victim.txt'), 'keep');
  fs.writeFileSync(`${out}.inventory.json`, JSON.stringify({ files: [{ path: 'victim.txt' }] }));
  assert.throws(() => execFileSync(process.execPath, [path.join(REPO, 'scripts/build-pages.mjs'), '--out', out], { stdio: 'pipe' }));
  assert.equal(fs.readFileSync(path.join(out, 'victim.txt'), 'utf8'), 'keep');
});

test('--out con contenido que ya no coincide con su último build no se borra', () => {
  const root = makeFixture('stale');
  const out = path.join(tmp, 'stale-out');
  buildPages({ root, out });
  fs.writeFileSync(path.join(out, 'extra.txt'), 'keep');
  assert.throws(() => buildPages({ root, out }), /no coincide/);
  assert.equal(fs.readFileSync(path.join(out, 'extra.txt'), 'utf8'), 'keep');
});

// Un componente symlink en la ruta de --out podría redirigir el borrado fuera del origen.
// La víctima tiene un inventario coincidente: sin la regla, el build la borraría.
function victimWithInventory(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'victim.txt'), 'keep');
  fs.writeFileSync(`${dir}.inventory.json`, JSON.stringify({ files: [{ path: 'victim.txt' }] }));
}

test('symlink en dist/ hacia docs/ (dentro del repo) se rechaza antes de borrar', () => {
  const root = makeFixture('symdocs');
  const victimDir = path.join(root, 'docs', 'pages');
  victimWithInventory(victimDir);
  fs.symlinkSync(path.join(root, 'docs'), path.join(root, 'dist'));
  assert.throws(() => buildPages({ root, out: path.join(root, 'dist', 'pages') }), /symlink en la ruta de --out: dist/);
  assert.equal(fs.readFileSync(path.join(victimDir, 'victim.txt'), 'utf8'), 'keep');
});

test('symlink en dist/ hacia un directorio externo se rechaza antes de borrar', () => {
  const root = makeFixture('symext');
  const external = path.join(tmp, 'symext-external');
  const victimDir = path.join(external, 'pages');
  victimWithInventory(victimDir);
  fs.symlinkSync(external, path.join(root, 'dist'));
  assert.throws(() => buildPages({ root, out: path.join(root, 'dist', 'pages') }), /symlink en la ruta de --out: dist/);
  assert.equal(fs.readFileSync(path.join(victimDir, 'victim.txt'), 'utf8'), 'keep');
});

test('--out vía symlink hacia el repo se rechaza (ruta canónica)', () => {
  const root = makeFixture('linkroot');
  const link = path.join(tmp, 'linkroot-alias');
  fs.symlinkSync(root, link);
  const sentinel = path.join(root, 'docs', 'ops.md');
  fs.mkdirSync(path.dirname(sentinel), { recursive: true }); fs.writeFileSync(sentinel, 'keep');
  assert.throws(() => buildPages({ root, out: link }), /raíz/);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'keep');
});

test('rechaza sw sin exactamente un marcador __BUILD__', () => {
  const root = makeFixture('nobuild');
  fs.writeFileSync(path.join(root, 'web/pages-sw.js'), "const X = 1;\n");
  assert.throws(() => buildPages({ root, out: path.join(tmp, 'nobuild-out') }), /__BUILD__/);
});

test('sw público: caché propia, URLs relativas al scope y precache = inventario público', () => {
  const src = fs.readFileSync(path.join(REPO, 'web/pages-sw.js'), 'utf8');
  assert.match(src, /PREFIX = 'sama-public-'/);
  assert.doesNotMatch(src, /['"`]\/[^\/]/, 'no debe haber rutas absolutas a la raíz');
  const block = src.slice(src.indexOf('const PRECACHE'), src.indexOf('].map'));
  const rels = [...block.matchAll(/'(\.\/[^']*)'/g)].map(m => m[1]);
  const fromSw = [...new Set(rels.map(r => (r === './' ? 'index.html' : r.slice(2))))].sort();
  const expected = expectedPublic.filter(p => p !== 'sw.js').sort();
  assert.deepEqual(fromSw, expected);
});

test('sw privado: nombre SAMA, prefijo propio y precache dentro de la tabla embebida', () => {
  const src = fs.readFileSync(path.join(REPO, 'web/sw.js'), 'utf8');
  assert.match(src, /const CACHE = 'sama-private-v\d+'/);
  assert.doesNotMatch(src, /yoga-minimal-v\d+'/, 'CACHE no debe usar el nombre anterior');
  const table = fs.readFileSync(path.join(REPO, 'src/web_assets.zig'), 'utf8');
  const served = new Set([...table.matchAll(/\.path = "([^"]+)"/g)].map(m => m[1]));
  for (const m of src.matchAll(/'(\/[^']*)'/g)) {
    if (m[1] === '/') continue;
    assert.ok(served.has(m[1]), `${m[1]} no está en src/web_assets.zig`);
  }
});

// web/week-data.json es privado y no está en git: sin él la tabla generada no puede
// compararse (CI no lo tiene), así que el chequeo solo aplica en local.
test('tabla embebida al día con web/ (scripts/gen-web-assets.mjs --check)', {
  skip: fs.existsSync(path.join(REPO, 'web/week-data.json')) ? false : 'sin web/week-data.json (archivo privado)',
}, () => {
  execFileSync(process.execPath, [path.join(REPO, 'scripts/gen-web-assets.mjs'), '--check'], { stdio: 'pipe' });
});

test('audio público: solo los 3 MP3 del sonido, en allowlist y en precache del SW', () => {
  const audio = PUBLIC_ALLOWLIST.filter(e => e.to.startsWith('audio/'));
  assert.deepEqual(audio.map(e => e.from).sort(), ['web/audio/gong.mp3', 'web/audio/handpan.mp3', 'web/audio/transition.mp3']);
  assert.deepEqual(audio.map(e => e.to).sort(), ['audio/gong.mp3', 'audio/handpan.mp3', 'audio/transition.mp3']);
  const precache = fs.readFileSync(path.join(REPO, 'web/pages-sw.js'), 'utf8');
  for (const e of audio) assert.ok(precache.includes(`'./${e.to}'`), `${e.to} sin precache`);
});

test('audio privado: tabla embebida con exactamente los 3 MP3 y precache del SW', () => {
  const table = fs.readFileSync(path.join(REPO, 'src/web_assets.zig'), 'utf8');
  const embedded = [...table.matchAll(/\.path = "(\/audio\/[^"]+)"/g)].map(m => m[1]).sort();
  assert.deepEqual(embedded, ['/audio/gong.mp3', '/audio/handpan.mp3', '/audio/transition.mp3']);
  assert.deepEqual(fs.readdirSync(path.join(REPO, 'web/audio')).sort(), embedded.map(p => p.slice('/audio/'.length)));
  const sw = fs.readFileSync(path.join(REPO, 'web/sw.js'), 'utf8');
  for (const p of embedded) assert.ok(sw.includes(`'${p}'`), `${p} sin precache privado`);
});

test('sitio público real: inventario, enlaces locales y start_url', { skip: !fs.existsSync(path.join(REPO, 'web/public.html')) && 'web/public.html aún no existe (contrato del diseñador)' }, () => {
  const out = path.join(tmp, 'real-out');
  buildPages({ out });
  assert.deepEqual(listFiles(out), expectedPublic);
  // start_url, scope e iconos se resuelven desde la URL real del manifiesto (/sama/public-manifest.json):
  // la app instalada debe arrancar y quedar bajo /sama/, sin rutas de raíz del origen.
  const man = JSON.parse(fs.readFileSync(path.join(out, 'public-manifest.json'), 'utf8'));
  const manifestUrl = new URL('http://x/sama/public-manifest.json');
  const start = new URL(man.start_url, manifestUrl);
  const scope = new URL(man.scope ?? './', manifestUrl);
  assert.equal(start.pathname, '/sama/');
  assert.equal(scope.pathname, '/sama/');
  assert.ok(start.pathname.startsWith(scope.pathname), 'start_url fuera de scope');
  for (const icon of man.icons) {
    const iconUrl = new URL(icon.src, manifestUrl);
    assert.ok(iconUrl.pathname.startsWith('/sama/'), icon.src);
    assert.ok(expectedPublic.includes(iconUrl.pathname.slice('/sama/'.length)), 'icono ausente: ' + icon.src);
  }
  // enlaces relativos de HTML/CSS/manifest deben existir en el sitio
  const exists = rel => expectedPublic.includes(rel);
  for (const f of ['index.html', 'style.css', 'public-manifest.json']) {
    const text = fs.readFileSync(path.join(out, f), 'utf8');
    for (const m of text.matchAll(/(?:href|src|start_url)"?\s*[=:]\s*"([^"]+)"|url\(\s*['"]?([^'")]+)/g)) {
      const ref = m[1] ?? m[2];
      if (/^(https?:|data:|#|mailto:)/.test(ref)) continue;
      const rel = ref.replace(/^\.\//, '').split(/[?#]/)[0];
      assert.ok(exists(rel) || rel === '' || rel === '.', `${f} referencia ${ref} inexistente en el sitio`);
    }
  }
});

after(() => fs.rmSync(tmp, { recursive: true, force: true }));
