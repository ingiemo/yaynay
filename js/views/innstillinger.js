// Innstillinger: kilo-omregning, kos-kvote, fristelser, sikkerhetskopi og nullstilling.

import { store } from '../store.js';
import { exportStale } from '../stats.js';
import { num, kr, kcal, esc, parseNum } from '../format.js';
import { toast } from '../ui.js';
import { openEdit, openReward } from './fristelse.js';

const dfDate = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
let root;

export function mount(el) {
  root = el;
  el.innerHTML = `
    <header><span class="eyebrow">YayNay</span><h1 class="page-title">Innstillinger</h1></header>

    <section class="card">
      <label class="row-field">
        <span>Kcal per kilo<small>Brukes til kilo-målet</small></span>
        <span class="num-input"><input id="s-perkg" inputmode="numeric" placeholder="7 700"><span>kcal</span></span>
      </label>
      <hr>
      <label class="row-field">
        <span>Kos-kvote per uke<small>Planlagt Smakt. Tomt = av</small></span>
        <span class="num-input"><input id="s-quota" inputmode="numeric" placeholder="–"><span>kcal</span></span>
      </label>
    </section>
    <p class="fine">7 700 kcal per kilo er et vanlig anslag for kroppsfett. Kos-kvoten vises på Fristelse og i Oversikt.</p>

    <h2 class="section-title">Belønningsmål</h2>
    <div class="log-group" id="s-reward"></div>
    <p class="fine">Kroner du sparer fyller opp målet. Når du unner deg det, trekkes beløpet fra.</p>
    <div id="s-rewards"></div>

    <div class="row-between">
      <h2 class="section-title">Fristelser</h2>
      <button type="button" class="btn btn--ghost" id="s-new">+ Ny</button>
    </div>
    <div class="log-group" id="s-treats"></div>

    <h2 class="section-title">Sikkerhetskopi</h2>
    <section class="card">
      <p class="hint" id="s-last"></p>
      <div class="decide decide--plain">
        <button type="button" class="btn" id="s-export">Eksporter</button>
        <button type="button" class="btn" id="s-import">Importer</button>
      </div>
      <input type="file" id="s-file" accept="application/json,.json" hidden>
    </section>
    <p class="fine">Dataene ligger bare på denne telefonen. Ingenting sendes til en server. iOS kan i sjeldne tilfeller slette lagringen, så ta en kopi innimellom og legg den i Filer.</p>

    <h2 class="section-title">Nullstill</h2>
    <button type="button" class="btn btn--block btn--danger" id="s-reset">Slett alle data</button>

    <p class="fine center gap" id="s-foot"></p>`;

  const perKg = el.querySelector('#s-perkg');
  const quota = el.querySelector('#s-quota');
  perKg.addEventListener('change', () => {
    const v = Math.round(parseNum(perKg.value));
    if (v >= 1000 && v <= 20000) {
      store.updateSettings({ kcalPerKg: v });
      toast('Lagret');
    } else {
      toast('Skriv et tall mellom 1 000 og 20 000');
    }
    render();
  });
  quota.addEventListener('change', () => {
    const v = Math.min(50000, Math.round(parseNum(quota.value)));
    store.updateSettings({ weeklyTreatKcal: v > 0 ? v : null });
    toast(v > 0 ? 'Lagret' : 'Kos-kvoten er slått av');
    render();
  });
  // Lukk tastaturet med Enter.
  for (const i of [perKg, quota]) i.addEventListener('keydown', (e) => { if (e.key === 'Enter') i.blur(); });

  el.querySelector('#s-new').addEventListener('click', () => openEdit(null));
  el.querySelector('#s-reward').addEventListener('click', () => openReward());
  el.querySelector('#s-treats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-treat]');
    if (b) { const t = store.treat(b.dataset.treat); if (t) openEdit(t); }
  });
  el.querySelector('#s-export').addEventListener('click', exportData);
  el.querySelector('#s-import').addEventListener('click', () => el.querySelector('#s-file').click());
  el.querySelector('#s-file').addEventListener('change', importData);
  el.querySelector('#s-reset').addEventListener('click', resetAll);

  store.subscribe(() => { if (!root.hidden) render(); });
}

export function show() {
  render();
}

function render() {
  const s = store.settings;
  const perKg = root.querySelector('#s-perkg');
  const quota = root.querySelector('#s-quota');
  // Viser alltid det som faktisk er lagret (også etter et ugyldig tall).
  perKg.value = num(s.kcalPerKg);
  quota.value = s.weeklyTreatKcal ? num(s.weeklyTreatKcal) : '';

  root.querySelector('#s-treats').innerHTML = store.treats.length
    ? store.treats.map((t) => `
      <button type="button" class="log-row" data-treat="${esc(t.id)}">
        <span class="log-emoji" aria-hidden="true">${esc(t.emoji)}</span>
        <span class="log-main"><b>${esc(t.name)}</b><small>ca. ${kcal(t.kcal)} · ${kr(t.price)}</small></span>
        <span class="chev" aria-hidden="true">›</span>
      </button>`).join('')
    : '<p class="empty">Ingen fristelser. Trykk «+ Ny».</p>';

  const r = s.reward;
  root.querySelector('#s-reward').innerHTML = `
    <button type="button" class="log-row">
      <span class="log-emoji" aria-hidden="true">🎁</span>
      <span class="log-main"><b>${r ? esc(r.name) : 'Ingen mål ennå'}</b><small>${r ? kr(r.amount) : 'Trykk for å sette et mål'}</small></span>
      <span class="chev" aria-hidden="true">›</span>
    </button>`;
  const done = store.rewards.slice().reverse().slice(0, 10);
  root.querySelector('#s-rewards').innerHTML = done.length ? `
    <p class="label gap">Innfridd</p>
    <div class="log-group">
      ${done.map((x) => `
        <div class="log-row">
          <span class="log-main"><b>${esc(x.name)}</b><small>${dfDate.format(new Date(x.at))}</small></span>
          <span class="log-end">${kr(x.amount)}</span>
        </div>`).join('')}
    </div>` : '';

  const last = s.lastExport ? new Date(s.lastExport) : null;
  const lastEl = root.querySelector('#s-last');
  const stale = exportStale(store.entries, s);
  lastEl.textContent = (last ? `Sist eksportert ${dfDate.format(last)}.` : 'Ikke eksportert ennå.')
    + (stale ? ' Det er lurt å ta en ny kopi nå.' : '');
  lastEl.classList.toggle('warn', stale);

  const n = store.entries.length;
  root.querySelector('#s-foot').textContent =
    `${n} ${n === 1 ? 'registrering' : 'registreringer'} og ${store.treats.length} fristelser lagret på denne enheten.`;
}

// ---------- Eksport / import ----------

async function exportData() {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const name = `yaynay-${stamp}.json`;
  const file = new File([store.exportJSON()], name, { type: 'application/json' });

  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'YayNay – sikkerhetskopi' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    store.markExported();
    toast('Eksportert');
  } catch (e) {
    if (e?.name !== 'AbortError') toast('Eksporten feilet');
  }
}

async function importData(e) {
  const input = e.target;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    if (file.size > 5_000_000) throw new Error('Fila er for stor til å være en eksport herfra.');
    const clean = store.parseImport(await file.text());
    const ok = confirm(`Importere ${clean.entries.length} registreringer og ${clean.treats.length} fristelser?\n\nDette erstatter alt som er lagret nå. Eksporter først hvis du vil ha en kopi av det du har.`);
    if (!ok) return;
    store.replaceAll(clean);
    toast('Importert');
  } catch (err) {
    alert(err.message || 'Klarte ikke å lese fila.');
  }
}

function resetAll() {
  const n = store.entries.length;
  if (!confirm(`Slette alle data på denne telefonen?\n\n${n} registreringer og dine fristelser forsvinner. Dette kan ikke angres. Eksporter først hvis du vil ha en kopi.`)) return;
  if (n && !confirm('Er du helt sikker?')) return;
  store.reset();
  toast('Alle data er slettet');
}
