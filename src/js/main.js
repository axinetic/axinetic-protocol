import register from './register-data.js';
import { isStated } from './render.js';
import { startPoller } from './market.js';
import { usdCompact, usdPrice, pct, shortAddr, DASH } from './format.js';
import { initReveal, initParallax, initProgress, initSpotlight, countTo, flash, reduced } from './motion.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
document.documentElement.classList.add('js');

/* ---------- copy ---------- */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}
const live = $('#live');
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-copy]');
  if (!btn || btn.disabled) return;
  const ok = await copyText(btn.dataset.copy);
  const hint = $('[data-feedback]', btn) || btn.querySelector('.copy-label');
  const idle = hint ? hint.dataset.idle || (hint.dataset.idle = hint.textContent) : '';
  btn.dataset.copied = ok ? 'yes' : 'no';
  if (hint) hint.textContent = ok ? 'Copied' : 'Failed';
  if (live) live.textContent = ok ? 'Copied to clipboard' : 'Copy failed';
  clearTimeout(btn._t);
  btn._t = setTimeout(() => { delete btn.dataset.copied; if (hint) hint.textContent = idle; if (live) live.textContent = ''; }, 1600);
});

/* ---------- market ---------- */
const market = register.market;
const rowsEl = $('#rows');
const tickerEl = $('#ticker-track');
const noteEl = $('#board-note');
const pill = $('#pill');
const pillText = $('#pill-text');
const rowMap = new Map();
let haveData = false;
let firstPaint = true;

const setPill = (state, text) => { pill.dataset.status = state; pillText.textContent = text; };

const hueOf = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 4; };
function logoHtml(r) {
  const letter = (r.symbol || '?').replace(/[^\p{L}\p{N}]/gu, '').charAt(0).toUpperCase() || '?';
  const tile = `<span class="logo-tile" data-hue="${hueOf(r.address)}" aria-hidden="true">${letter}</span>`;
  return r.image ? `<span class="logo-wrap">${tile}<img class="logo-img" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${encodeURI(r.image)}"></span>` : `<span class="logo-wrap">${tile}</span>`;
}
document.addEventListener('error', (e) => {
  const t = e.target;
  if (t && t.classList && t.classList.contains('logo-img')) t.remove();
}, true);

const safe = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dir = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat');

function buildRow(r, i) {
  const el = document.createElement('div');
  el.className = 'row';
  el.setAttribute('role', 'row');
  el.setAttribute('data-spot', '');
  el.dataset.address = r.address;
  el.innerHTML = `
    <span class="c-rank" role="cell"></span>
    <span class="c-token" role="cell">${logoHtml(r)}<span class="tok"><span class="tok-sym">${safe(r.symbol)}</span><span class="tok-name">${safe(r.name)}</span></span></span>
    <span class="c-price" role="cell" data-label="Price"><span class="v" data-f="price"></span></span>
    <span class="c-change" role="cell" data-label="24h"><span class="v" data-f="change"></span></span>
    <span class="c-vol" role="cell" data-label="Volume"><span class="v" data-f="volume"></span></span>
    <span class="c-liq" role="cell" data-label="Liquidity"><span class="v" data-f="liquidity"></span></span>
    <span class="c-copy" role="cell"><button type="button" class="copy-btn" data-copy="${safe(r.address)}" aria-label="Copy address of ${safe(r.symbol)}"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path fill="currentColor" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg><span class="copy-label" data-feedback>${safe(shortAddr(r.address))}</span></button></span>`;
  el.style.setProperty('--i', String(i));
  return el;
}

function fillRow(el, r, i) {
  $('.c-rank', el).textContent = String(i + 1).padStart(2, '0');
  const set = (f, val, fmt) => {
    const v = $(`[data-f="${f}"]`, el);
    countTo(v, val === null ? NaN : val, fmt);
    return v;
  };
  set('price', r.price, usdPrice);
  const ch = set('change', r.change, pct);
  ch.parentElement.dataset.dir = dir(r.change);
  set('volume', r.volume, usdCompact);
  set('liquidity', r.liquidity, usdCompact);
}

function paintTiles(rows) {
  const vol = rows.reduce((s, r) => s + (r.volume || 0), 0);
  const liq = rows.reduce((s, r) => s + (r.liquidity || 0), 0);
  const withCh = rows.filter((r) => r.change !== null);
  const up = withCh.filter((r) => r.change > 0).length;
  const down = withCh.filter((r) => r.change < 0).length;
  const top = withCh.slice().sort((a, b) => b.change - a.change)[0];
  const deep = rows.slice().sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0))[0];
  const avg = withCh.length ? withCh.reduce((s, r) => s + r.change, 0) / withCh.length : NaN;
  const turn = liq > 0 ? vol / liq : NaN;
  const num = (k, v, f) => { const el = $(`[data-tile="${k}"] .tile-v`); el.classList.remove('sk-text'); countTo(el, v, f); };
  const txt = (k, s) => { const el = $(`[data-tile="${k}"] .tile-v`); el.classList.remove('sk-text'); if (el.textContent !== s) { el.textContent = s; flash(el, true); } };
  num('volume', vol, usdCompact);
  num('liquidity', liq, usdCompact);
  txt('mover', top ? `${top.symbol} ${pct(top.change)}` : DASH);
  num('gainers', up, (n) => String(Math.round(n)));
  num('decliners', down, (n) => String(Math.round(n)));
  txt('deep', deep ? `${deep.symbol} ${usdCompact(deep.liquidity)}` : DASH);
  num('avg', avg, pct);
  num('turn', turn, (n) => (Number.isFinite(n) ? n.toFixed(2) + 'x' : DASH));
}

function paintTicker(rows) {
  const item = (r) => `<span class="tk-item">${logoHtml(r)}<span class="tk-sym">${safe(r.symbol)}</span><span class="tk-price">${usdPrice(r.price)}</span><span class="tk-chg" data-dir="${dir(r.change)}">${pct(r.change)}</span></span>`;
  const html = rows.map(item).join('');
  tickerEl.innerHTML = `<div class="tk-run">${html}</div><div class="tk-run" aria-hidden="true">${html}</div>`;
  tickerEl.classList.add('is-ready');
}

function onData(rows) {
  const wasStale = pill.dataset.status === 'stale' || pill.dataset.status === 'error';
  haveData = true;
  noteEl.hidden = true;
  setPill('live', 'Live');
  const seen = new Set();
  if (firstPaint) $$('.row.sk', rowsEl).forEach((n) => n.remove());
  rows.forEach((r, i) => {
    seen.add(r.address);
    let el = rowMap.get(r.address);
    if (!el) {
      el = buildRow(r, i);
      rowMap.set(r.address, el);
      el.classList.add('row-enter');
      el.style.animationDelay = `${i * 45}ms`;
    }
    fillRow(el, r, i);
    rowsEl.appendChild(el);
  });
  for (const [a, el] of rowMap) if (!seen.has(a)) { el.remove(); rowMap.delete(a); }
  paintTiles(rows);
  paintTicker(rows);
  if (wasStale && !reduced()) flash(pill, true);
  firstPaint = false;
}

function onError(_err, fails) {
  if (haveData) {
    setPill('stale', 'Stale');
    noteEl.hidden = false;
    noteEl.textContent = 'The source did not answer. Showing earlier good numbers. Retrying with a longer pause.';
  } else {
    setPill('error', 'Offline');
    noteEl.hidden = false;
    noteEl.textContent = 'The source did not answer. Retrying with a longer pause.';
    $$('.tile-v').forEach((el) => { el.classList.remove('sk-text'); el.textContent = DASH; });
    $$('.row.sk .sk-bar').forEach((b) => b.classList.add('is-dash'));
    tickerEl.innerHTML = `<div class="tk-run"><span class="tk-item"><span class="tk-sym">${DASH}</span></span></div>`;
    tickerEl.classList.add('is-ready');
  }
  void fails;
}

function initSkeleton() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 10; i++) {
    const el = document.createElement('div');
    el.className = 'row sk';
    el.setAttribute('role', 'row');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<span class="c-rank"><i class="sk-bar" style="width:18px"></i></span><span class="c-token"><i class="sk-circle"></i><span class="tok"><i class="sk-bar" style="width:72px"></i><i class="sk-bar" style="width:110px;margin-top:6px"></i></span></span><span class="c-price"><i class="sk-bar" style="width:70px"></i></span><span class="c-change"><i class="sk-bar" style="width:54px"></i></span><span class="c-vol"><i class="sk-bar" style="width:62px"></i></span><span class="c-liq"><i class="sk-bar" style="width:62px"></i></span><span class="c-copy"><i class="sk-bar" style="width:44px"></i></span>`;
    frag.appendChild(el);
  }
  rowsEl.appendChild(frag);
}

/* ---------- rpc probe (chain record only) ---------- */
async function probeRpc() {
  const rec = register.rpc;
  const slot = $('#rpc-status');
  if (!slot || !isStated(rec)) return;
  try {
    const res = await fetch(rec.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }) });
    const j = await res.json();
    slot.textContent = j && j.result === 'ok' ? 'reachable' : 'unreachable';
    slot.dataset.ok = j && j.result === 'ok' ? 'yes' : 'no';
  } catch { slot.textContent = 'unreachable'; slot.dataset.ok = 'no'; }
}

/* ---------- boot ---------- */
initProgress($('#progress'));
initSpotlight();
initReveal();
initParallax($('#hero'));
initSkeleton();
if (isStated(market) && market.url) {
  setPill('wait', 'Connecting');
  startPoller(market.url.replace(/\/$/, ''), { onData, onError, onBusy: () => {} });
} else {
  setPill('error', 'Pending');
}
probeRpc();
