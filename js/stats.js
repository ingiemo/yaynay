// Summer, ukestart og kilo-fremdrift.

export const MILESTONE = 1000; // kcal

/** Mandag kl. 00:00 i uka som inneholder d. */
export function startOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function totals(entries, since = null) {
  const out = {
    spart: { kcal: 0, price: 0, count: 0 },
    smakt: { kcal: 0, price: 0, count: 0 },
  };
  const from = since ? since.getTime() : -Infinity;
  for (const e of entries) {
    if (Date.parse(e.at) < from) continue;
    const o = out[e.kind];
    o.kcal += e.kcal;
    o.price += e.price;
    o.count += 1;
  }
  return out;
}

export const weekTotals = (entries) => totals(entries, startOfWeek());
export const totalSpart = (entries) => totals(entries).spart.kcal;

/** Fremdrift mot neste hele kilo (omregnet). */
export function kgProgress(total, perKg) {
  const kg = total / perKg;
  const whole = Math.floor(kg);
  return { kg, whole, frac: kg - whole, left: Math.ceil((whole + 1) * perKg - total) };
}

// ---------- Perioder ----------

export const PERIODS = [
  { id: '7',    label: '7 dager' },
  { id: '30',   label: '30 dager' },
  { id: 'year', label: 'I år' },
  { id: 'all',  label: 'Totalt' },
];

export function periodStart(id, now = new Date()) {
  if (id === 'all') return null;
  if (id === 'year') return new Date(now.getFullYear(), 0, 1);
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (Number(id) - 1)); // «7 dager» = i dag + 6 dager bakover
  return d;
}

export function inPeriod(entries, id) {
  const from = periodStart(id);
  return from ? entries.filter((e) => Date.parse(e.at) >= from.getTime()) : entries;
}

/** ISO-ukenummer. */
export function isoWeek(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x - y0) / 864e5 + 1) / 7);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
const MONTHS_LONG = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

/**
 * Søyler til grafen. Korte perioder: siste 8 uker. I år: månedene hittil i år. Totalt: siste 12 måneder.
 * Hver søyle: { short, long, spart, smakt } i kcal.
 */
export function buckets(entries, periodId, now = new Date()) {
  const out = [];
  if (periodId === '7' || periodId === '30') {
    const w0 = startOfWeek(now);
    for (let i = 7; i >= 0; i--) {
      const from = new Date(w0); from.setDate(from.getDate() - i * 7);
      const to = new Date(from); to.setDate(to.getDate() + 7);
      const wk = isoWeek(from);
      out.push({ from, to, short: String(wk), long: `Uke ${wk}`, spart: 0, smakt: 0 });
    }
  } else {
    const n = periodId === 'year' ? now.getMonth() + 1 : 12;
    const first = periodId === 'year'
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getFullYear(), now.getMonth() - 11, 1);
    for (let i = 0; i < n; i++) {
      const from = new Date(first.getFullYear(), first.getMonth() + i, 1);
      const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
      out.push({ from, to, short: MONTHS[from.getMonth()], long: `${MONTHS_LONG[from.getMonth()]} ${from.getFullYear()}`, spart: 0, smakt: 0 });
    }
  }
  for (const e of entries) {
    const t = Date.parse(e.at);
    const b = out.find((x) => t >= x.from.getTime() && t < x.to.getTime());
    if (b) b[e.kind] += e.kcal;
  }
  return out;
}

// ---------- Mønstre ----------

export const SLOTS = [
  { id: 'morgen',      label: 'Morgen',      range: 'kl. 6–10',  from: 6,  to: 10 },
  { id: 'formiddag',   label: 'Formiddag',   range: 'kl. 10–14', from: 10, to: 14 },
  { id: 'ettermiddag', label: 'Ettermiddag', range: 'kl. 14–18', from: 14, to: 18 },
  { id: 'kveld',       label: 'Kveld',       range: 'kl. 18–22', from: 18, to: 22 },
  { id: 'natt',        label: 'Natt',        range: 'kl. 22–6',  from: 22, to: 6 },
];

export function slotOf(d) {
  const h = d.getHours();
  return SLOTS.find((s) => (s.from < s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to));
}

/** Antall Spart og Smakt per tidsrom. */
export function bySlot(entries) {
  const out = SLOTS.map((s) => ({ ...s, spart: 0, smakt: 0 }));
  for (const e of entries) out.find((s) => s.id === slotOf(new Date(e.at)).id)[e.kind] += 1;
  return out;
}

/** Antall Spart og Smakt per situasjon (bare registreringer med situasjon). */
export function byMood(entries, moods) {
  const out = moods.map((m) => ({ ...m, spart: 0, smakt: 0 }));
  for (const e of entries) {
    const m = out.find((x) => x.id === e.mood);
    if (m) m[e.kind] += 1;
  }
  return out;
}

// ---------- Belønning og ukesoppsummering ----------

/** Kroner spart totalt, minus det som er brukt på innfridde belønninger. */
export function rewardBank(entries, rewards) {
  const used = rewards.reduce((s, r) => s + r.amount, 0);
  return Math.max(0, totals(entries).spart.price - used);
}

/** Tallene for forrige hele uke (mandag–søndag). */
export function lastWeek(entries, now = new Date()) {
  const to = startOfWeek(now);
  const from = new Date(to); from.setDate(from.getDate() - 7);
  const list = entries.filter((e) => { const t = Date.parse(e.at); return t >= from.getTime() && t < to.getTime(); });
  const t = totals(list);
  const waited = list.filter((e) => e.waited);
  return { from, to, count: list.length, ...t, waited: waited.length, waitedSpart: waited.filter((e) => e.kind === 'spart').length };
}

// ---------- Sikkerhetskopi ----------

export const EXPORT_EVERY_DAYS = 14;

/** Sant når det finnes registreringer og det er lenge siden forrige eksport. */
export function exportStale(entries, settings, now = new Date()) {
  if (!entries.length) return false;
  const last = settings.lastExport ? new Date(settings.lastExport) : null;
  return !last || now - last > EXPORT_EVERY_DAYS * 864e5;
}

/** Returnerer milepælen (f.eks. 3000) hvis den ble passert, ellers 0. */
export function milestoneCrossed(before, after) {
  const a = Math.floor(after / MILESTONE);
  return a > Math.floor(before / MILESTONE) ? a * MILESTONE : 0;
}
