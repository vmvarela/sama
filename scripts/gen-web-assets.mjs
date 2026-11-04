#!/usr/bin/env node
// Genera src/web_assets.zig: tabla explícita de @embedFile para el binario privado.
// Uso: node scripts/gen-web-assets.mjs [--check]
//   --check: no escribe; falla si el archivo generado no coincide con web/.
// Entradas: archivos de nivel superior de web/ (lista fija) + web/images/*.png +
// web/icons/* (si existe). Cualquier otra cosa en esos directorios es un error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'web_assets.zig');

const TOP_LEVEL = [
  'index.html', 'style.css', 'tracker.css', 'app.js', 'tracker.js', 'day-player.js',
  'manifest.json', 'sequences.json', 'meditation.json', 'week-data.json',
  'images-map.json', 'sw.js',
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function regularFiles(dir, exts) {
  const names = fs.readdirSync(dir).sort();
  for (const name of names) {
    const st = fs.lstatSync(path.join(dir, name));
    if (!st.isFile()) throw new Error(`${path.relative(ROOT, path.join(dir, name))}: solo se admiten archivos regulares (sin symlinks ni directorios)`);
    if (!exts.includes(path.extname(name))) throw new Error(`${path.relative(ROOT, path.join(dir, name))}: extensión no permitida`);
  }
  return names;
}

export function collectEntries() {
  const entries = [];
  for (const name of TOP_LEVEL) {
    const file = path.join(ROOT, 'web', name);
    if (!fs.lstatSync(file).isFile()) throw new Error(`web/${name} no es un archivo regular`);
    entries.push({ url: `/${name}`, rel: `web/${name}` });
  }
  for (const name of regularFiles(path.join(ROOT, 'web', 'images'), ['.png'])) {
    entries.push({ url: `/images/${name}`, rel: `web/images/${name}` });
  }
  const icons = path.join(ROOT, 'web', 'icons');
  if (fs.existsSync(icons)) {
    for (const name of regularFiles(icons, Object.keys(TYPES))) {
      entries.push({ url: `/icons/${name}`, rel: `web/icons/${name}` });
    }
  }
  return entries.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
}

export function render(entries) {
  const lines = [
    '//! GENERADO por scripts/gen-web-assets.mjs — no editar a mano.',
    '//! Tabla explícita de assets del binario privado (sirve main.zig).',
    '',
    'const std = @import("std");',
    '',
    'pub const Asset = struct {',
    '    path: []const u8,',
    '    content: []const u8,',
    '    content_type: []const u8,',
    '};',
    '',
    'pub const assets = [_]Asset{',
  ];
  for (const e of entries) {
    const type = TYPES[path.extname(e.rel)];
    // @embedFile es relativo a este archivo (src/): ../web/...
    lines.push(`    .{ .path = "${e.url}", .content = @embedFile("../${e.rel}"), .content_type = "${type}" },`);
  }
  lines.push(
    '};',
    '',
    '/// Coincidencia exacta de ruta (sin decodificar): no hay acceso a disco ni',
    '/// separadores que validar. "/" es alias de /index.html.',
    'pub fn get(path: []const u8) ?Asset {',
    '    const want = if (std.mem.eql(u8, path, "/")) "/index.html" else path;',
    '    for (assets) |a| if (std.mem.eql(u8, a.path, want)) return a;',
    '    return null;',
    '}',
    '',
  );
  return lines.join('\n');
}

function main() {
  const text = render(collectEntries());
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (current !== text) {
      console.error('src/web_assets.zig está desactualizado: ejecuta node scripts/gen-web-assets.mjs');
      process.exit(1);
    }
    console.log('src/web_assets.zig al día');
    return;
  }
  fs.writeFileSync(OUT, text);
  console.log(`src/web_assets.zig: ${collectEntries().length} assets`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
