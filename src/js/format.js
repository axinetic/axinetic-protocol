const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
const DASH = '—';

export function usdCompact(n) {
  if (!Number.isFinite(n)) return DASH;
  const a = Math.abs(n);
  const unit = a >= 1e12 ? [1e12, 'T'] : a >= 1e9 ? [1e9, 'B'] : a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'K'] : [1, ''];
  const v = n / unit[0];
  return '$' + (unit[0] === 1 ? v.toFixed(a >= 100 ? 0 : 2) : v.toFixed(Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2)) + unit[1];
}

export function usdPrice(n) {
  if (!Number.isFinite(n)) return DASH;
  if (n === 0) return '$0';
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(4);
  const e = Math.floor(Math.log10(n));
  const zeros = -e - 1;
  if (zeros >= 4) {
    const digits = Math.round(n * 10 ** (zeros + 1) * 1000).toString().slice(0, 4);
    return '$0.0' + String(zeros).split('').map((d) => SUB[+d]).join('') + digits.replace(/0+$/, '') ;
  }
  return '$' + n.toFixed(zeros + 4);
}

export function pct(n) {
  if (!Number.isFinite(n)) return DASH;
  return (n > 0 ? '+' : '') + n.toFixed(Math.abs(n) >= 100 ? 0 : 2) + '%';
}

export const intFmt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : DASH);
export const shortAddr = (a) => (a.length > 12 ? a.slice(0, 4) + '…' + a.slice(-4) : a);
export { DASH };
