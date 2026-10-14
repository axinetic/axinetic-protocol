// Motion layer. Every function falls back to an instant result when the visitor asks for reduced motion.

const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reduced = () => !!(mq && mq.matches);

// Damped spring solver. Semi-implicit Euler on a fixed step, so the result does not depend on frame rate.
export function spring({ from = 0, to = 1, velocity = 0, stiffness = 170, damping = 22, mass = 1, onUpdate, onDone }) {
  if (reduced()) { onUpdate(to); if (onDone) onDone(); return () => {}; }
  const STEP = 1 / 240;
  let x = from, v = velocity, last = performance.now(), acc = 0, raf = 0, dead = false;
  const frame = (now) => {
    if (dead) return;
    acc += Math.min(0.064, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      const a = (-stiffness * (x - to) - damping * v) / mass;
      v += a * STEP;
      x += v * STEP;
      acc -= STEP;
    }
    if (Math.abs(x - to) < 0.0008 && Math.abs(v) < 0.0008) { onUpdate(to); if (onDone) onDone(); return; }
    onUpdate(x);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { dead = true; cancelAnimationFrame(raf); };
}

export function initReveal(root = document) {
  const items = [...root.querySelectorAll('[data-reveal]')];
  if (reduced() || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
  const groups = new Map();
  items.forEach((el) => {
    const g = el.closest('[data-reveal-group]') || document.body;
    const n = groups.get(g) || 0;
    el.dataset.stagger = String(n);
    groups.set(g, n + 1);
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);
      const delay = Math.min(Number(el.dataset.stagger || 0), 8) * 70;
      setTimeout(() => spring({
        onUpdate: (p) => { el.style.opacity = String(Math.max(0, Math.min(1, p * 1.25))); el.style.transform = `translate3d(0,${((1 - p) * 28).toFixed(2)}px,0)`; },
        onDone: () => { el.style.opacity = ''; el.style.transform = ''; el.classList.add('is-in'); }
      }), delay);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  items.forEach((el) => io.observe(el));
}

export function initParallax(hero) {
  if (!hero || reduced()) return;
  const layers = [...hero.querySelectorAll('[data-depth]')];
  if (!layers.length) return;
  const st = { px: 0, py: 0, sy: 0 };
  const cur = { x: 0, y: 0, s: 0 };
  const vel = { x: 0, y: 0, s: 0 };
  let running = false, visible = true;
  const target = () => ({ x: st.px, y: st.py, s: st.sy });
  const tick = (now) => {
    const dt = Math.min(0.05, (now - (tick.t || now)) / 1000); tick.t = now;
    const t = target();
    for (const k of ['x', 'y', 's']) {
      const a = -120 * (cur[k] - t[k]) - 18 * vel[k];
      vel[k] += a * dt; cur[k] += vel[k] * dt;
    }
    layers.forEach((el) => {
      const d = Number(el.dataset.depth);
      el.style.transform = `translate3d(${(cur.x * d * 26).toFixed(2)}px,${(cur.y * d * 20 + cur.s * d * -0.12).toFixed(2)}px,0)`;
    });
    const settled = Math.abs(cur.x - t.x) + Math.abs(cur.y - t.y) + Math.abs(cur.s - t.s) < 0.01 && Math.abs(vel.x) + Math.abs(vel.y) + Math.abs(vel.s) < 0.01;
    if (settled || !visible) { running = false; tick.t = 0; return; }
    requestAnimationFrame(tick);
  };
  const kick = () => { if (!running && visible) { running = true; requestAnimationFrame(tick); } };
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    st.px = ((e.clientX - r.left) / r.width - 0.5) * 2;
    st.py = ((e.clientY - r.top) / r.height - 0.5) * 2;
    kick();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { st.px = 0; st.py = 0; kick(); });
  addEventListener('scroll', () => { st.sy = Math.min(scrollY, 900); kick(); }, { passive: true });
  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) kick(); }).observe(hero);
}

export function initProgress(bar) {
  if (!bar) return;
  let queued = false;
  const paint = () => {
    queued = false;
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
  };
  const on = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
  addEventListener('scroll', on, { passive: true });
  addEventListener('resize', on);
  paint();
}

export function initSpotlight() {
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('[data-spot]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
  }, { passive: true });
}

const easeOut = (t) => 1 - Math.pow(1 - t, 5);

export function countTo(el, to, fmt, ms = 700) {
  const from = Number(el.dataset.v);
  el.dataset.v = String(to);
  if (!Number.isFinite(to)) { el.textContent = fmt(to); return; }
  const had = Number.isFinite(from);
  if (reduced() || !had) { el.textContent = fmt(to); if (had && from !== to) flash(el, to > from); return; }
  if (from === to) { el.textContent = fmt(to); return; }
  flash(el, to > from);
  cancelAnimationFrame(el._raf);
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms);
    el.textContent = fmt(from + (to - from) * easeOut(t));
    if (t < 1) el._raf = requestAnimationFrame(step); else el.textContent = fmt(to);
  };
  el._raf = requestAnimationFrame(step);
}

export function flash(el, up) {
  el.classList.remove('flash-up', 'flash-down');
  void el.offsetWidth;
  el.classList.add(up ? 'flash-up' : 'flash-down');
}
