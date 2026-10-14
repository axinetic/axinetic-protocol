// Market data. Driven only by the market-source base URL handed in by the caller.

const CHUNK = 30;
const TOP = 10;

async function getJson(url, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

export async function loadBoard(base) {
  const boosts = await getJson(`${base}/token-boosts/top/v1`);
  if (!Array.isArray(boosts)) throw new Error('shape');
  const icons = new Map();
  const addrs = [];
  for (const b of boosts) {
    if (!b || b.chainId !== 'solana' || !b.tokenAddress || icons.has(b.tokenAddress)) continue;
    icons.set(b.tokenAddress, b.icon || null);
    addrs.push(b.tokenAddress);
  }
  if (!addrs.length) throw new Error('empty');
  const batches = [];
  for (let i = 0; i < addrs.length; i += CHUNK) batches.push(addrs.slice(i, i + CHUNK));
  const results = await Promise.all(batches.map((b) => getJson(`${base}/tokens/v1/solana/${b.join(',')}`)));
  const best = new Map();
  for (const pair of results.flat()) {
    if (!pair || pair.chainId !== 'solana' || !pair.baseToken) continue;
    const a = pair.baseToken.address;
    if (!icons.has(a)) continue;
    const liq = num(pair.liquidity && pair.liquidity.usd) || 0;
    const cur = best.get(a);
    if (!cur || liq > cur.liq) best.set(a, { pair, liq });
  }
  const rows = [...best.values()].map(({ pair }) => ({
    address: pair.baseToken.address,
    symbol: pair.baseToken.symbol || '?',
    name: pair.baseToken.name || pair.baseToken.symbol || '',
    price: num(pair.priceUsd),
    change: num(pair.priceChange && pair.priceChange.h24),
    volume: num(pair.volume && pair.volume.h24),
    liquidity: num(pair.liquidity && pair.liquidity.usd),
    image: (pair.info && pair.info.imageUrl) || icons.get(pair.baseToken.address) || null
  })).filter((r) => r.volume !== null);
  rows.sort((a, b) => b.volume - a.volume);
  if (!rows.length) throw new Error('empty');
  return rows.slice(0, TOP);
}

// Poller: 60s cadence, exponential backoff on failure, paused while hidden, immediate fetch on return.
export function startPoller(base, { onData, onError, onBusy }) {
  const PERIOD = 60000, MIN = 2000, MAX = 60000;
  let timer = 0, fails = 0, inflight = false, stopped = false;
  const schedule = (ms) => { clearTimeout(timer); if (!stopped && !document.hidden) timer = setTimeout(run, ms); };
  const run = async () => {
    if (inflight || stopped) return;
    inflight = true; onBusy(true);
    try {
      const rows = await loadBoard(base);
      fails = 0; onData(rows); schedule(PERIOD);
    } catch (err) {
      fails++;
      onError(err, fails);
      const wait = Math.min(MAX, MIN * 2 ** (fails - 1)) * (0.85 + Math.random() * 0.3);
      schedule(wait);
    } finally { inflight = false; onBusy(false); }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer); else run();
  });
  run();
  return { refresh: run, stop() { stopped = true; clearTimeout(timer); } };
}
