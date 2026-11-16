// Oversikt: kilo-mål, sum for perioden, graf, mønstre og logg.

import { store, MOODS } from '../store.js';
import {
  PERIODS, inPeriod, totals, totalSpart, weekTotals, kgProgress, MILESTONE, buckets, bySlot, byMood,
} from '../stats.js';
import { kcal, kr, kg, pct, num, esc, amountText } from '../format.js';
import { toast, openSheet, closeSheet } from '../ui.js';
import { toLocalInput } from './fristelse.js';

const PREF = 'yaynay:oversikt';
const MIN_PATTERN = 5; // registreringer før mønstre vises
const PAGE = 40;
const MOOD_PHRASE = {
  sliten: 'når du er sliten',
  sosialt: 'i sosiale situasjoner',
  kjedelig: 'når du kjeder deg',
  belonning: 'som belønning',
  sulten: 'når du er sulten',
};
const moodLabel = (id) => MOODS.find((m) => m.id === id)?.label ?? '';

const dfDay = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
const dfTime = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit' });
const dfFull = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

let root;
let period = '30';
let filter = 'all';
let limit = PAGE;
let sel = null; // valgt søyle i grafen

function loadPref() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF) || '{}');
    if (PERIODS.some((x) => x.id === p.period)) period = p.period;
  } catch { /* bruk standard */ }
}
function savePref() {
  try { localStorage.setItem(PREF, JSON.stringify({ period })); } catch { /* ikke viktig */ }
}

export function mount(el) {
  root = el;
  loadPref();
  el.innerHTML = `
    <header><span class="eyebrow">YayNay</span><h1 class="page-title">Oversikt</h1></header>
    <section class="card" id="ov-kg"></section>
    <div class="seg seg--4 gap" role="radiogroup" aria-label="Periode">
      ${PERIODS.map((p) => `<button type="button" role="radio" data-period="${p.id}">${p.label}</button>`).join('')}
    </div>
    <section class="card gap" id="ov-sum"></section>
    <section class="card gap" id="ov-chart"></section>
    <section class="card gap" id="ov-pattern"></section>
    <h2 class="section-title">Logg</h2>
    <div class="seg" role="radiogroup" aria-label="Vis i loggen">
      <button type="button" role="radio" data-filter="all">Alle</button>
      <button type="button" role="radio" data-filter="spart">Spart</button>
      <button type="button" role="radio" data-filter="smakt">Smakt</button>
    </div>
    <div id="ov-log"></div>`;
  el.addEventListener('click', onClick);
  store.subscribe(() => { if (!root.hidden) render(); });
}

export function show() {
  limit = PAGE;
  sel = null;
  render();
}

function render() {
  root.querySelectorAll('[data-period]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.period === period)));
  root.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.filter === filter)));
  const list = inPeriod(store.entries, period);
  renderKg();
  renderSum(list);
  renderChart();
  renderPattern(list);
  renderLog(list);
}

// ---------- Kilo-mål (alltid totalt) ----------

function renderKg() {
  const perKg = store.settings.kcalPerKg;
  const total = totalSpart(store.entries);
  const p = kgProgress(total, perKg);
  const next = (Math.floor(total / MILESTONE) + 1) * MILESTONE;
  root.querySelector('#ov-kg').innerHTML = `
    <div class="row-between">
      <span class="label">Spart totalt</span>
      <span class="hint">${kcal(total)}</span>
    </div>
    <p class="hero">≈ ${kg(p.kg)}</p>
    <div class="bar" role="progressbar" aria-label="Fremdrift mot neste kilo"
      aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(p.frac * 100)}">
      <span style="width:${(p.frac * 100).toFixed(1)}%"></span>
    </div>
    <p class="hint">Mot ${p.whole + 1}. kilo: ${pct(p.frac)} · ${kcal(p.left)} igjen</p>
    <p class="hint">Neste milepæl: ${kcal(next)}</p>
    <p class="fine">Omregnet med ${num(perKg)} kcal per kilo. Det er et anslag, ikke en måling av vekt.</p>`;
}

// ---------- Sum for perioden ----------

function renderSum(list) {
  const t = totals(list);
  const label = PERIODS.find((p) => p.id === period).label;
  const waited = list.filter((e) => e.waited);
  const waitedSpart = waited.filter((e) => e.kind === 'spart').length;
  const q = store.settings.weeklyTreatKcal;
  const times = (n) => `${n} ${n === 1 ? 'gang' : 'ganger'}`;

  root.querySelector('#ov-sum').innerHTML = `
    <span class="label">${label}</span>
    <div class="duo">
      <div class="duo-spart"><b>${num(t.spart.kcal)}</b><span>kcal spart</span><small>${kr(t.spart.price)} · ${times(t.spart.count)}</small></div>
      <div class="duo-smakt"><b>${num(t.smakt.kcal)}</b><span>kcal smakt</span><small>${kr(t.smakt.price)} · ${times(t.smakt.count)}</small></div>
    </div>
    ${waited.length ? `<p class="hint">Etter «Vent 10 min»: ${waitedSpart} av ${waited.length} ble Spart.</p>` : ''}
    ${q ? `<p class="hint">Kos-kvote denne uka: ${num(weekTotals(store.entries).smakt.kcal)} av ${kcal(q)}</p>` : ''}
    ${things(t.spart.kcal)}`;
}

/** «Spart tilsvarer ≈ 9 × Liten sjokolade». Bruker de mest brukte fristelsene. */
function things(total) {
  if (!(total > 0)) return '';
  const top = store.treats
    .map((t, i) => [t, i])
    .filter(([t]) => t.kcal > 0)
    .sort((a, b) => b[0].uses - a[0].uses || a[1] - b[1])
    .slice(0, 3)
    .map(([t]) => t);
  if (!top.length) return '';
  const count = (v) => (v >= 10 ? num(v) : (Math.round(v * 10) / 10).toLocaleString('nb-NO'));
  return `
    <p class="label gap">Spart tilsvarer</p>
    <ul class="things">
      ${top.map((t) => `<li><span class="things-emoji" aria-hidden="true">${esc(t.emoji)}</span><b>≈ ${count(total / t.kcal)}</b><span>${esc(t.name)}</span></li>`).join('')}
    </ul>`;
}

// ---------- Graf ----------

function niceMax(v) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/** Søyle med 4 px avrundede hjørner bare øverst, festet til grunnlinjen. */
function barPath(x, y, w, h) {
  if (h <= 0) return '';
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function renderChart() {
  const box = root.querySelector('#ov-chart');
  const b = buckets(store.entries, period);
  const weekly = period === '7' || period === '30';
  const title = weekly ? 'Kcal per uke' : 'Kcal per måned';
  const legend = `
    <div class="legend">
      <span><i class="sw sw-spart"></i>Spart</span>
      <span><i class="sw sw-smakt"></i>Smakt</span>
    </div>`;

  if (!b.some((x) => x.spart || x.smakt)) {
    box.innerHTML = `<span class="label">${title}</span><p class="hint">Grafen fylles ut etter hvert som du registrerer.</p>`;
    return;
  }

  const i0 = sel ?? b.length - 1;
  const cur = b[i0];
  const max = niceMax(Math.max(...b.map((x) => Math.max(x.spart, x.smakt))));
  const W = 340, H = 180, L = 40, R = 4, T = 8, B = 24;
  const pw = W - L - R, ph = H - T - B;
  const gw = pw / b.length;
  const bw = Math.max(3, Math.min(14, (gw - 8) / 2));
  const y = (v) => T + ph - (v / max) * ph;

  const grid = [0, max / 2, max].map((v) => `
    <line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="${v ? 'grid' : 'base'}"/>
    <text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end" class="tick">${num(v)}</text>`).join('');

  const groups = b.map((x, i) => {
    const cx = L + gw * i + gw / 2;
    return `
      <g class="grp${i === i0 ? ' is-sel' : ''}">
        <rect class="grp-bg" x="${L + gw * i + 1}" y="${T}" width="${gw - 2}" height="${ph}" rx="6"/>
        <path class="m-spart" d="${barPath(cx - 1 - bw, y(x.spart), bw, y(0) - y(x.spart))}"/>
        <path class="m-smakt" d="${barPath(cx + 1, y(x.smakt), bw, y(0) - y(x.smakt))}"/>
        <text x="${cx}" y="${H - 8}" text-anchor="middle" class="tick">${esc(x.short)}</text>
        <rect class="hit" data-bucket="${i}" x="${L + gw * i}" y="0" width="${gw}" height="${H}">
          <title>${esc(x.long)}: Spart ${kcal(x.spart)}, Smakt ${kcal(x.smakt)}</title>
        </rect>
      </g>`;
  }).join('');

  box.innerHTML = `
    <div class="row-between"><span class="label">${title}</span>${legend}</div>
    <p class="chart-info" aria-live="polite">
      <b>${esc(cur.long)}</b>
      <span><i class="sw sw-spart"></i>Spart ${kcal(cur.spart)}</span>
      <span><i class="sw sw-smakt"></i>Smakt ${kcal(cur.smakt)}</span>
    </p>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}, Spart og Smakt">${grid}${groups}</svg>
    <p class="fine">Trykk på en ${weekly ? 'uke' : 'måned'} for å se tallene.</p>
    <details class="table-view">
      <summary>Vis som tabell</summary>
      <table>
        <thead><tr><th>${weekly ? 'Uke' : 'Måned'}</th><th>Spart</th><th>Smakt</th></tr></thead>
        <tbody>${b.map((x) => `<tr><td>${esc(x.long)}</td><td>${num(x.spart)}</td><td>${num(x.smakt)}</td></tr>`).join('')}</tbody>
      </table>
    </details>`;
}

// ---------- Mønstre ----------

/** ['a', 'b', 'c'] -> «a, b og c» */
function joinOg(parts) {
  return parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} og ${parts.at(-1)}`;
}

function hrows(rows) {
  const max = Math.max(1, ...rows.map((r) => r.spart + r.smakt));
  return rows.map((r) => `
    <div class="hrow" aria-label="${esc(r.label)}: ${r.spart} spart, ${r.smakt} smakt">
      <span class="hrow-l">${esc(r.label)}${r.range ? `<small>${r.range}</small>` : ''}</span>
      <span class="hbar" aria-hidden="true">
        ${r.spart ? `<i class="m-spart" style="width:${(r.spart / max) * 100}%"></i>` : ''}
        ${r.smakt ? `<i class="m-smakt" style="width:${(r.smakt / max) * 100}%"></i>` : ''}
      </span>
      <span class="hrow-n" aria-hidden="true">${r.spart} · ${r.smakt}</span>
    </div>`).join('');
}

function renderPattern(list) {
  const box = root.querySelector('#ov-pattern');
  if (list.length < MIN_PATTERN) {
    box.innerHTML = `
      <span class="label">Mønstre</span>
      <p class="hint">Vises når du har registrert minst ${MIN_PATTERN} ganger i perioden. Nå: ${list.length}.</p>`;
    return;
  }

  const slots = bySlot(list);
  const most = Math.max(...slots.map((s) => s.spart + s.smakt));
  const topSlots = slots.filter((s) => s.spart + s.smakt === most);
  const slotText = `Fristelsene kommer oftest ${joinOg(topSlots.map((s) => `${s.label.toLowerCase()} (${s.range})`))}.`;
  const withMood = list.filter((e) => e.mood);
  let moodPart;
  if (withMood.length >= 3) {
    const moods = byMood(withMood, MOODS).filter((m) => m.spart + m.smakt > 0);
    const smaktTotal = withMood.filter((e) => e.kind === 'smakt').length;
    const best = Math.max(0, ...moods.map((m) => m.smakt));
    const tops = moods.filter((m) => m.smakt === best);
    const moodText = `Smakt skjer oftest ${joinOg(tops.map((m) => MOOD_PHRASE[m.id]))} (${best} av ${smaktTotal}${tops.length > 1 ? ' hver' : ''}).`;
    moodPart = `
      <p class="label gap">Situasjon</p>
      ${best ? `<p class="insight">${moodText}</p>` : ''}
      ${hrows(moods)}`;
  } else {
    moodPart = `
      <p class="label gap">Situasjon</p>
      <p class="hint">Velg situasjon når du registrerer, så ser du hva som oftest fører til Smakt.</p>`;
  }

  box.innerHTML = `
    <div class="row-between">
      <span class="label">Mønstre</span>
      <div class="legend"><span><i class="sw sw-spart"></i>Spart</span><span><i class="sw sw-smakt"></i>Smakt</span></div>
    </div>
    <p class="label gap">Tid på døgnet</p>
    <p class="insight">${slotText}</p>
    ${hrows(slots)}
    ${moodPart}`;
}

// ---------- Logg ----------

function dayLabel(d) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((today - day) / 864e5);
  if (diff === 0) return 'I dag';
  if (diff === 1) return 'I går';
  const s = dfDay.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderLog(list) {
  const box = root.querySelector('#ov-log');
  const items = list
    .filter((e) => filter === 'all' || e.kind === filter)
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at));
  if (!items.length) {
    box.innerHTML = '<p class="empty">Ingen registreringer i perioden.</p>';
    return;
  }

  let html = '';
  let lastDay = '';
  for (const e of items.slice(0, limit)) {
    const d = new Date(e.at);
    const key = d.toDateString();
    if (key !== lastDay) {
      if (lastDay) html += '</div>';
      html += `<h3 class="log-day">${dayLabel(d)}</h3><div class="log-group">`;
      lastDay = key;
    }
    const meta = [dfTime.format(d), e.mood ? moodLabel(e.mood) : '', e.waited ? 'ventet' : ''].filter(Boolean).join(' · ');
    html += `
      <button type="button" class="log-row" data-entry="${esc(e.id)}">
        <span class="log-emoji" aria-hidden="true">${esc(e.emoji)}</span>
        <span class="log-main"><b>${esc(e.name)}${e.amount !== 1 ? ` × ${amountText(e.amount)}` : ''}</b><small>${meta}</small></span>
        <span class="log-end"><span class="tag tag--${e.kind}">${e.kind === 'spart' ? 'Spart' : 'Smakt'}</span><small>${num(e.kcal)} kcal</small></span>
      </button>`;
  }
  html += '</div>';
  if (items.length > limit) {
    html += `<button type="button" class="btn btn--block" data-more>Vis flere (${items.length - limit} til)</button>`;
  }
  box.innerHTML = html;
}

function openEntry(e) {
  let kind = e.kind;
  let mood = e.mood;
  const html = `
    <div class="sheet-top">
      <h2><span class="sheet-emoji" aria-hidden="true">${esc(e.emoji)}</span> ${esc(e.name)}${e.amount !== 1 ? ` × ${amountText(e.amount)}` : ''}</h2>
      <button type="button" class="btn btn--ghost" data-close>Avbryt</button>
    </div>
    <p class="hint">${esc(dfFull.format(new Date(e.at)))} · ca. ${kcal(e.kcal)} · ${kr(e.price)}</p>
    <div class="seg seg--2 gap" role="radiogroup" aria-label="Spart eller Smakt">
      <button type="button" role="radio" data-kind="spart" aria-checked="${kind === 'spart'}">Spart</button>
      <button type="button" role="radio" data-kind="smakt" aria-checked="${kind === 'smakt'}">Smakt</button>
    </div>
    <p class="label gap">Situasjon <span class="opt muted">valgfritt</span></p>
    <div class="chips">
      ${MOODS.map((m) => `<button type="button" class="chip" data-mood="${m.id}" aria-pressed="${m.id === mood}">${m.label}</button>`).join('')}
    </div>
    <p class="label gap">Tidspunkt</p>
    <input type="datetime-local" class="field when-input" id="e-at" aria-label="Tidspunkt"
      value="${toLocalInput(new Date(e.at))}" max="${toLocalInput(new Date())}">
    <button type="button" class="primary" data-save>Lagre</button>
    <button type="button" class="btn btn--ghost btn--block btn--danger" data-delete>Slett registreringen</button>`;

  openSheet(html, {
    label: e.name,
    onMount(sheet) {
      sheet.addEventListener('click', (ev) => {
        const k = ev.target.closest('[data-kind]');
        if (k) {
          kind = k.dataset.kind;
          sheet.querySelectorAll('[data-kind]').forEach((b) => b.setAttribute('aria-checked', String(b === k)));
          return;
        }
        const m = ev.target.closest('[data-mood]');
        if (m) {
          mood = mood === m.dataset.mood ? null : m.dataset.mood;
          sheet.querySelectorAll('[data-mood]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mood === mood)));
          return;
        }
        if (ev.target.closest('[data-save]')) {
          const d = new Date(sheet.querySelector('#e-at').value);
          if (Number.isNaN(+d)) { toast('Velg et tidspunkt'); return; }
          if (d > new Date()) { toast('Tidspunktet kan ikke være fram i tid'); return; }
          // Behold sekundene hvis minuttet ikke er endret.
          const at = toLocalInput(d) === toLocalInput(new Date(e.at)) ? e.at : d.toISOString();
          store.updateEntry(e.id, { kind, mood, at });
          closeSheet();
          toast('Lagret');
          return;
        }
        if (ev.target.closest('[data-delete]') && confirm('Slette registreringen? Dette kan ikke angres.')) {
          store.removeEntry(e.id);
          closeSheet();
          toast('Slettet');
        }
      });
    },
  });
}

// ---------- Klikk ----------

function onClick(e) {
  const p = e.target.closest('[data-period]');
  if (p) { period = p.dataset.period; savePref(); sel = null; limit = PAGE; render(); return; }

  const f = e.target.closest('[data-filter]');
  if (f) { filter = f.dataset.filter; limit = PAGE; render(); return; }

  const b = e.target.closest('[data-bucket]');
  if (b) { sel = Number(b.dataset.bucket); renderChart(); return; }

  const r = e.target.closest('[data-entry]');
  if (r) { const entry = store.entries.find((x) => x.id === r.dataset.entry); if (entry) openEntry(entry); return; }

  if (e.target.closest('[data-more]')) { limit += PAGE; render(); }
}
