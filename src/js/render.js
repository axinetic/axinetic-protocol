// Pure string renderers. Used by the build (prerender), the browser and the gates.
// Rule: a record that is not stated renders inert, with no value and no link.

export const ICON_PATHS = {
  x: { vb: '0 0 24 24', d: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
  github: { vb: '0 0 16 16', d: 'M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z' }
};

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const isStated = (rec) => !!rec && rec.state === 'stated';

// Handle is derived from the stored URL, never stored on its own.
export function handleOf(rec) {
  if (!isStated(rec) || !rec.url) return '';
  try {
    const parts = new URL(rec.url).pathname.split('/').filter(Boolean);
    if (rec.id === 'x') return parts[0] ? '@' + parts[0] : '';
    return parts.slice(0, 2).join('/');
  } catch { return ''; }
}

const svg = (key) => {
  const i = ICON_PATHS[key];
  return `<svg viewBox="${i.vb}" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="${i.d}"/></svg>`;
};

export function renderSocial(rec, key) {
  if (isStated(rec) && rec.url) {
    const name = `${rec.label}, ${handleOf(rec)}`;
    return `<a class="icon-btn" data-state="stated" data-social="${key}" href="${esc(rec.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(name)}">${svg(key)}</a>`;
  }
  return `<span class="icon-btn is-inert" data-state="${esc(rec ? rec.state : 'absent')}" data-social="${key}" role="img" aria-disabled="true" aria-label="${esc(rec ? rec.label : key)}, pending">${svg(key)}</span>`;
}

export function renderCa(rec) {
  const label = esc(rec.label);
  if (isStated(rec) && rec.value) {
    const v = esc(rec.value);
    return `<div class="ca-slot" data-state="stated"><span class="ca-label">${label}</span><button type="button" class="ca-value" data-copy="${v}" aria-label="Copy ${label}"><span class="ca-text">${v}</span><span class="ca-hint" data-feedback>Copy</span></button></div>`;
  }
  return `<div class="ca-slot is-inert" data-state="${esc(rec.state)}"><span class="ca-label">${label}</span><span class="chip chip-pending">pending</span><button type="button" class="ca-copy-inert" disabled aria-disabled="true">Copy</button></div>`;
}

export function renderChip(rec) {
  const label = esc(rec.label);
  if (isStated(rec) && (rec.value || rec.url)) {
    const shown = rec.value ? esc(rec.value) : esc(handleOf(rec) || hostOf(rec.url));
    return `<li class="rec" data-state="stated"><span class="rec-k">${label}</span><span class="rec-v">${shown}</span></li>`;
  }
  return `<li class="rec is-inert" data-state="${esc(rec.state)}"><span class="rec-k">${label}</span><span class="chip chip-pending">pending</span></li>`;
}

export const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };

// Address-shaped strings must match a stated record. The CA record is exempt. 0x hex is not blanket-rejected.
export function scanAddresses(text, register) {
  const known = new Set();
  for (const r of Object.values(register)) if (isStated(r) && r.value) known.add(r.value.toLowerCase());
  const shapes = [/0x[0-9a-fA-F]{40}/g, /\b(?=[1-9A-HJ-NP-Za-km-z]*\d)(?=[1-9A-HJ-NP-Za-km-z]*[a-z])(?=[1-9A-HJ-NP-Za-km-z]*[A-Z])[1-9A-HJ-NP-Za-km-z]{32,44}\b/g];
  const bad = [];
  for (const re of shapes) for (const m of text.matchAll(re)) if (!known.has(m[0].toLowerCase())) bad.push(m[0]);
  return bad;
}
