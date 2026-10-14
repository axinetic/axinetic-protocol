import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { renderSocial, renderCa, renderChip, isStated } from '../src/js/render.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...a) => path.join(root, ...a);
const dist = p('dist');
const register = JSON.parse(fs.readFileSync(p('register.json'), 'utf8'));
const tokens = JSON.parse(fs.readFileSync(p('src/tokens.json'), 'utf8'));

// Register rule: an inert record carries no value and no url.
for (const r of Object.values(register)) {
  if (r.state !== 'stated' && ('value' in r || 'url' in r)) throw new Error(`record ${r.id} is ${r.state} but carries a value or url`);
}

fs.rmSync(dist, { recursive: true, force: true });
for (const d of ['css', 'js', 'assets']) fs.mkdirSync(p('dist', d), { recursive: true });

// tokens.css: the only place colour literals are emitted from.
const css = ':root {\n' + Object.entries(tokens.colors).map(([k, v]) => `  --${k}: ${v.hex};`).join('\n') + '\n}\n';
fs.writeFileSync(p('dist/css/tokens.css'), css);
fs.copyFileSync(p('src/css/main.css'), p('dist/css/main.css'));

// JS: copy modules, plus a date-free projection of the register.
for (const f of fs.readdirSync(p('src/js'))) fs.copyFileSync(p('src/js', f), p('dist/js', f));
const projection = Object.fromEntries(Object.entries(register).map(([k, r]) => {
  const { checked, ...rest } = r; void checked; return [k, rest];
}));
fs.writeFileSync(p('dist/js/register-data.js'), 'export default ' + JSON.stringify(projection, null, 2) + ';\n');

// HTML: prerender the register-driven slots.
let html = fs.readFileSync(p('src/index.html'), 'utf8');
const stated = Object.values(register).filter((r) => isStated(r) && r.id !== 'ca');
const pending = Object.values(register).filter((r) => !isStated(r));
html = html
  .replace('<!--@themecolor-->', tokens.colors.ground.hex)
  .replace('<!--@social-->', renderSocial(register.x, 'x') + renderSocial(register.github, 'github'))
  .replace('<!--@ca-->', renderCa(register.ca))
  .replace('<!--@records-stated-->', stated.map(renderChip).join(''))
  .replace('<!--@records-pending-->', pending.map(renderChip).join(''));
if (html.includes('<!--@')) throw new Error('unresolved build marker');
fs.writeFileSync(p('dist/index.html'), html);

// Assets. sharp resizes with premultiplied alpha, which matters because the transparent logo holds pure black in its clear region.
const logo = p('brand', 'LOGO AXINETIC PNG...png');
for (const n of [64, 512]) await sharp(logo).resize(n, n, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(p('dist/assets', `logo-${n}.png`));
await sharp(p('reference', 'SAMPUL AXINETIC JPG.jpg.jpeg')).resize(1200, 400, { fit: 'cover' }).jpeg({ quality: 84 }).toFile(p('dist/assets/og.jpg'));

// Favicon: traced from the real pixel grid. Each bead is a connected component of the alpha mask.
{
  const N = 500;
  const { data } = await sharp(logo).ensureAlpha().resize(N, N, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  const solid = (x, y) => data[(y * N + x) * 4 + 3] >= 128;
  const seen = new Uint8Array(N * N);
  const beads = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (seen[y * N + x] || !solid(x, y)) continue;
    const stack = [[x, y]]; seen[y * N + x] = 1;
    let area = 0, sx = 0, sy = 0;
    while (stack.length) {
      const [cx, cy] = stack.pop(); area++; sx += cx; sy += cy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N || seen[ny * N + nx] || !solid(nx, ny)) continue;
        seen[ny * N + nx] = 1; stack.push([nx, ny]);
      }
    }
    if (area < 12) continue;
    const mx = Math.round(sx / area), my = Math.round(sy / area);
    const i = (my * N + mx) * 4;
    const hex = '#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    beads.push({ x: sx / area, y: sy / area, r: Math.sqrt(area / Math.PI), hex });
  }
  const minX = Math.min(...beads.map((b) => b.x - b.r)), maxX = Math.max(...beads.map((b) => b.x + b.r));
  const minY = Math.min(...beads.map((b) => b.y - b.r)), maxY = Math.max(...beads.map((b) => b.y + b.r));
  const span = Math.max(maxX - minX, maxY - minY), pad = 1.5, k = (32 - pad * 2) / span;
  const ox = (32 - (maxX - minX) * k) / 2, oy = (32 - (maxY - minY) * k) / 2;
  const f = (v) => (+v.toFixed(2)).toString();
  const circles = beads.map((b) => `<circle cx="${f((b.x - minX) * k + ox)}" cy="${f((b.y - minY) * k + oy)}" r="${f(b.r * k)}" fill="${b.hex}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${circles}</svg>\n`;
  if (svg.includes('--')) throw new Error('favicon contains a double hyphen');
  fs.writeFileSync(p('dist/favicon.svg'), svg);
  console.log(`favicon: ${beads.length} beads traced`);
}

fs.writeFileSync(p('dist/_headers'), '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/js/*\n  Cache-Control: no-cache\n/css/*\n  Cache-Control: no-cache\n');

// Syntax check every shipped module.
for (const f of fs.readdirSync(p('dist/js'))) execFileSync(process.execPath, ['--check', p('dist/js', f)]);
console.log('build ok -> dist/');
