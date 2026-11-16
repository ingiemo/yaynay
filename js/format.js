// Tall, kcal, kroner og kilo i norsk format (nb-NO).

const NBSP = ' ';
const nf0 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nfPrice = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 });

export function num(n) {
  return Number.isFinite(n) ? nf0.format(Math.round(n)) : '–';
}

export const kcal = (n) => `${num(n)}${NBSP}kcal`;
export const kr = (n) => `${num(n)}${NBSP}kr`;
export const kg = (n) => `${nf1.format(n)}${NBSP}kg`;
export const pct = (f) => `${nf0.format(Math.floor(f * 100))}${NBSP}%`;

/** Pris i et inputfelt: «12,5». Tomt for 0. */
export function priceInput(n) {
  return n ? nfPrice.format(n).replace(/\s/g, '') : '';
}

/** «1 234,5» / «1234.5» -> 1234.5 */
export function parseNum(s) {
  const t = String(s ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, '');
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : 0;
}

/** 61000 ms -> «1:01» */
export function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const amountText = (a) => (a === 0.5 ? '½' : String(a));

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
