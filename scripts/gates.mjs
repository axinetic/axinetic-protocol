import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSocial, renderCa, scanAddresses, isStated, handleOf } from '../src/js/render.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...a) => path.join(root, ...a);
const rd = (f) => fs.readFileSync(p(f), 'utf8');
const walk = (d, out = []) => { for (const e of fs.readdirSync(p(d), { withFileTypes: true })) { const r = path.join(d, e.name); e.isDirectory() ? walk(r, out) : out.push(r); } return out; };

const results = [];
const gate = (name, fn) => { try { const r = fn(); results.push([name, r === undefined || r === true, r === true || r === undefined ? '' : String(r)]); } catch (e) { results.push([name, false, e.message]); } };

const register = JSON.parse(rd('register.json'));
const html = rd('dist/index.html');
const srcFiles = walk('src').filter((f) => /\.(css|js|html)$/.test(f));
const distText = walk('dist').filter((f) => /\.(html|css|js|svg)$/.test(f));

gate('dist has index, favicon, assets', () => ['dist/index.html', 'dist/favicon.svg', 'dist/assets/logo-512.png', 'dist/css/main.css', 'dist/js/main.js'].every((f) => fs.existsSync(p(f))) || 'missing output');

gate('palette: no hex literal outside tokens.json (src)', () => {
  const bad = srcFiles.filter((f) => /#[0-9a-fA-F]{3,8}\b/.test(rd(f).replace(/&#\d+;/g, '')));
  return bad.length ? bad.join(', ') : true;
});
gate('palette: dist hex only in tokens.css and favicon.svg', () => {
  const bad = distText.filter((f) => !/tokens\.css$|favicon\.svg$/.test(f) && /#[0-9a-fA-F]{3,8}\b/.test(rd(f).replace(/&#\d+;/g, '').replace(/<meta name="theme-color"[^>]*>/, '')));
  return bad.length ? bad.join(', ') : true;
});
gate('palette: tokens carry provenance', () => Object.values(JSON.parse(rd('src/tokens.json')).colors).every((c) => c.from) || 'missing from');

gate('dates: none visible in dist', () => {
  const re = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}:\d{2}(:\d{2})?\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}\b|\bas of\b|\bchecked\b|toLocale(Date|Time)String|new Date|Date\.now|Intl\.DateTimeFormat/i;
  const bad = distText.filter((f) => !/_headers/.test(f) && re.test(rd(f)));
  return bad.length ? bad.join(', ') : true;
});
gate('dates: absent from register projection, kept in register.json', () => !/checked/.test(rd('dist/js/register-data.js')) && Object.values(register).every((r) => r.checked) || 'projection or register wrong');

gate('rule1: inert records carry no value or url', () => {
  const proj = JSON.parse(rd('dist/js/register-data.js').replace(/^export default /, '').replace(/;\s*$/, ''));
  for (const set of [register, proj]) for (const r of Object.values(set)) if (r.state !== 'stated' && ('value' in r || 'url' in r)) return r.id;
  return true;
});
gate('rule1: state is stated|absent|unconfirmed', () => Object.values(register).every((r) => ['stated', 'absent', 'unconfirmed'].includes(r.state)) || 'bad state');

gate('rule2: X href equals stored url, handle derived', () => html.includes(`href="${register.x.url}"`) && handleOf(register.x) === '@axinetic' || 'x');
gate('rule2: GitHub href equals stored url, handle derived', () => html.includes(`href="${register.github.url}"`) && handleOf(register.github) === 'axinetic/axinetic-protocol' || 'github');
gate('social: both icons present, icon only, in header', () => {
  const head = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  return (head.match(/data-social="x"/g) || []).length === 1 && (head.match(/data-social="github"/g) || []).length === 1 && !/<a class="icon-btn"[^>]*>[^<]*[A-Za-z]/.test(head.replace(/<svg.*?<\/svg>/g, '')) || 'icons';
});
gate('social: official X and Octicon paths', () => html.includes('M18.244 2.25h3.308') && html.includes('M8 0c4.42 0 8 3.58 8 8') || 'paths');

// Both branches, state-independent: read the live record, flip it, and assert the render flips with it.
const flip = (rec, to) => {
  const c = { ...rec, state: to };
  if (to === 'stated') { if (rec.id === 'ca') c.value = 'Fixture1111111111111111111111111111111111'; else c.url = c.url || 'https://example.test/x'; }
  else { delete c.value; delete c.url; }
  return c;
};
const other = (rec) => (isStated(rec) ? 'absent' : 'stated');
gate('ca: current branch rendered in dist matches register', () => (isStated(register.ca) ? /data-copy=/.test(html) : /ca-slot is-inert/.test(html) && !/class="ca-value"/.test(html)) || 'ca branch');
gate('ca: opposite branch renders correctly (mutation)', () => {
  const m = flip(register.ca, other(register.ca)); const out = renderCa(m);
  return isStated(m) ? (/data-copy="Fixture/.test(out) && !/is-inert/.test(out)) : (/is-inert/.test(out) && !/data-copy/.test(out) && !/Fixture/.test(out)) || 'mutation';
});
gate('ca: inert render has no value, no copy payload', () => { const o = renderCa(flip(register.ca, 'absent')); return (!/data-copy|<a /.test(o) && /pending/.test(o) && /disabled/.test(o)) || o; });
for (const k of ['x', 'github']) {
  gate(`social ${k}: both branches flip with the live record`, () => {
    const cur = renderSocial(register[k], k), m = renderSocial(flip(register[k], other(register[k])), k);
    const hasHref = (s) => /href="/.test(s);
    return hasHref(cur) === isStated(register[k]) && hasHref(m) === !isStated(register[k]) || 'flip';
  });
  gate(`social ${k}: inert branch has no href and stays rendered`, () => { const o = renderSocial(flip(register[k], 'absent'), k); return (!/href=/.test(o) && /<svg/.test(o) && /aria-disabled="true"/.test(o)) || o; });
}

gate('rule3: 0x hex is not blanket-rejected', () => {
  const hex = '0x' + 'ab12'.repeat(10);
  const reg = { ...register, ca: { ...register.ca, state: 'stated', value: hex } };
  return scanAddresses(hex, reg).length === 0 && scanAddresses(hex, register).length === 1 || 'scanner';
});
gate('rule3: dist has no unmatched address-shaped string', () => { const bad = scanAddresses(html.replace(/<style[\s\S]*?<\/style>/g, ''), register); return bad.length ? bad.join(',') : true; });
gate('rule3: CA exempt from scanner', () => { const v = 'Fixture1111111111111111111111111111111111'; return scanAddresses(v, { ca: { state: 'stated', value: v } }).length === 0 || 'exempt'; });

gate('market: no CA reference in market.js', () => !/register|\bca\b|contract/i.test(rd('src/js/market.js')) || 'coupled');
gate('market: only market record feeds the poller', () => /register\.market/.test(rd('src/js/main.js')) && !/startPoller\([^)]*\bca\b/.test(rd('src/js/main.js')));
gate('market: endpoints, solana filter, top 10, 60s, backoff, visibility', () => { const m = rd('src/js/market.js'); return ['token-boosts/top/v1', 'tokens/v1/solana/', "chainId !== 'solana'", 'TOP = 10', 'PERIOD = 60000', '2 ** (fails - 1)', 'document.hidden', 'visibilitychange'].every((s) => m.includes(s)) || 'missing'; });
gate('market: letter-tile fallback, last good data kept', () => /logo-tile/.test(rd('src/js/main.js')) && /haveData/.test(rd('src/js/main.js')));

gate('motion: prefers-reduced-motion in css and js', () => /prefers-reduced-motion: reduce/.test(rd('src/css/main.css')) && /prefers-reduced-motion: reduce/.test(rd('src/js/motion.js')));
gate('motion: spring, parallax, progress, spotlight, countup present', () => { const m = rd('src/js/motion.js'); return ['export function spring', 'initParallax', 'initProgress', 'initSpotlight', 'countTo'].every((s) => m.includes(s)); });
gate('mobile: no ch units in css or markup', () => !/\d(\.\d+)?ch\b/.test(rd('src/css/main.css') + rd('src/index.html')) || 'ch');
gate('mobile: 44px tap target declared for icons, buttons, nav, copy', () => (rd('src/css/main.css').match(/(width|height|min-height|min-width): 44px/g) || []).length >= 8);

gate('favicon: 32x32, circles, no double hyphen', () => { const s = rd('dist/favicon.svg'); return /viewBox="0 0 32 32"/.test(s) && /width="32" height="32"/.test(s) && !s.includes('--') && !s.includes('<!--') && (s.match(/<circle/g) || []).length > 20; });

gate('hygiene: no CLAUDE.md, .claude, AI attribution', () => {
  if (fs.existsSync(p('CLAUDE.md')) || fs.existsSync(p('.claude'))) return 'files';
  const files = [...walk('src'), ...walk('scripts'), ...walk('docs'), 'README.md', 'LICENSE', 'package.json', 'register.json'].filter((f) => !/gates\.mjs$/.test(f));
  const bad = files.filter((f) => /\bclaude\b|anthropic|co-authored|generated with|\bAI\b|artificial intelligence/i.test(rd(f)));
  return bad.length ? bad.join(', ') : true;
});
gate('repo: README, whitepaper, LICENSE exist and stay out of dist', () => ['README.md', 'docs/whitepaper.md', 'LICENSE'].every((f) => fs.existsSync(p(f))) && !walk('dist').some((f) => /README|whitepaper|LICENSE/i.test(f)) && /MIT/.test(rd('LICENSE')) && /Axinetic/.test(rd('LICENSE')));

gate('copy: zero shared 2-grams with reference text', () => {
  const words = (t) => t.toLowerCase().replace(/&[a-z#0-9]+;/g, ' ').match(/[a-z0-9']+/g) || [];
  const grams = (w) => { const s = new Set(); for (let i = 0; i < w.length - 1; i++) s.add(w[i] + ' ' + w[i + 1]); return s; };
  const ref = grams(words(rd('tools/ref-text.txt')));
  const vis = html.replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ');
  const lits = [...rd('src/js/main.js').matchAll(/'([^'\n]{6,})'|`([^`\n$]{6,})`/g)].map((m) => m[1] || m[2]).filter((s) => /\s/.test(s) && !/[{}=;<>]/.test(s)).join(' . ');
  const meta = [...html.matchAll(/<meta[^>]*content="([^"]+)"/g)].map((m) => m[1]).join(' . ');
  const ours = [...grams(words(vis)), ...grams(words(lits)), ...grams(words(meta))];
  const shared = [...new Set(ours.filter((g) => ref.has(g)))];
  return shared.length ? shared.join(' | ') : true;
});

const fail = results.filter((r) => !r[1]);
for (const [n, ok, why] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${why ? '  <- ' + why : ''}`);
console.log(`\n${results.length - fail.length}/${results.length} gates passed`);
process.exit(fail.length ? 1 : 0);
