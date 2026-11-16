// Fristelse: velg en fristelse og trykk Spart eller Smakt. Med «Vent 10 min» og «Angre».

import { store, TYPES, MOODS, AMOUNTS, WAIT_MIN, typeOf, uid } from '../store.js';
import { weekTotals, totalSpart, kgProgress, milestoneCrossed, rewardBank, lastWeek, startOfWeek, isoWeek } from '../stats.js';
import { kcal, kr, kg, pct, num, esc, mmss, parseNum, priceInput, amountText } from '../format.js';
import { toast, openSheet, closeSheet } from '../ui.js';

let root;
let timer;

export function mount(el) {
  root = el;
  el.innerHTML = `
    <header>
      <span class="eyebrow">YayNay</span>
      <h1 class="page-title">Fristet?</h1>
    </header>
    <div id="fr-week"></div>
    <div id="fr-wait"></div>
    <section class="card progress-card" id="fr-progress"></section>
    <section class="card reward-card gap" id="fr-reward"></section>
    <div class="row-between">
      <h2 class="section-title">Fristelser</h2>
      <span class="hint">Mest brukt først</span>
    </div>
    <div class="tiles" id="fr-tiles"></div>`;
  el.addEventListener('click', onClick);
  store.subscribe(() => { if (!root.hidden) render(); });
}

export function show() {
  render();
}

function render() {
  renderWeek();
  renderWait();
  renderProgress();
  renderReward();
  renderTiles();
}

// ---------- Visning ----------

function renderWeek() {
  const box = root.querySelector('#fr-week');
  const monday = startOfWeek().toISOString();
  if (store.settings.lastWeekSeen === monday) { box.innerHTML = ''; return; }
  const w = lastWeek(store.entries);
  if (!w.count) { box.innerHTML = ''; return; }
  const times = (n) => `${n} ${n === 1 ? 'gang' : 'ganger'}`;
  box.innerHTML = `
    <section class="card week-card">
      <span class="label">Forrige uke · uke ${isoWeek(w.from)}</span>
      <div class="duo">
        <div class="duo-spart"><b>${num(w.spart.kcal)}</b><span>kcal spart</span><small>${kr(w.spart.price)} · ${times(w.spart.count)}</small></div>
        <div class="duo-smakt"><b>${num(w.smakt.kcal)}</b><span>kcal smakt</span><small>${times(w.smakt.count)}</small></div>
      </div>
      ${w.waited ? `<p class="hint">Etter «Vent 10 min»: ${w.waitedSpart} av ${w.waited} ble Spart.</p>` : ''}
      <button type="button" class="btn btn--block" data-week-ok>OK</button>
    </section>`;
}

function renderReward() {
  const box = root.querySelector('#fr-reward');
  const r = store.settings.reward;
  if (!r) {
    box.className = 'reward-empty';
    box.innerHTML = `<button type="button" class="btn btn--ghost btn--block" data-reward-edit>+ Sett et belønningsmål for kronene du sparer</button>`;
    return;
  }
  const bank = rewardBank(store.entries, store.rewards);
  const frac = Math.min(1, bank / r.amount);
  const done = bank >= r.amount;
  box.className = `card reward-card gap${done ? ' is-done' : ''}`;
  box.innerHTML = `
    <div class="row-between">
      <span class="label">Belønningsmål</span>
      <button type="button" class="link" data-reward-edit>Endre</button>
    </div>
    <p class="reward-name">${esc(r.name)}</p>
    <div class="bar" role="progressbar" aria-label="Fremdrift mot belønningsmålet"
      aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(frac * 100)}">
      <span style="width:${(frac * 100).toFixed(1)}%"></span>
    </div>
    <p class="hint">${done ? `Nådd: ${kr(bank)} spart av ${kr(r.amount)}` : `${kr(bank)} av ${kr(r.amount)} · ${kr(r.amount - bank)} igjen`}</p>
    ${done ? '<button type="button" class="primary" data-reward-claim>Unn meg det</button>' : ''}`;
}

/** Ark for å sette eller endre belønningsmålet. Brukes også fra Innstillinger. */
export function openReward() {
  const r = store.settings.reward;
  openSheet(`
    <div class="sheet-top">
      <h2>${r ? 'Endre belønningsmål' : 'Nytt belønningsmål'}</h2>
      <button type="button" class="btn btn--ghost" data-close>Avbryt</button>
    </div>
    <form id="rf" novalidate>
      <input class="field" name="name" placeholder="Hva vil du unne deg?" maxlength="80" autocomplete="off"
        aria-label="Belønning" value="${esc(r?.name ?? '')}">
      <div class="card gap">
        <label class="row-field">
          <span>Koster<small>Fylles av kroner du sparer</small></span>
          <span class="num-input"><input name="amount" inputmode="numeric" placeholder="0" value="${r ? num(r.amount) : ''}"><span>kr</span></span>
        </label>
      </div>
      <p class="hint center" id="rf-hint">Velg gjerne noe som ikke er mat.</p>
      <button class="primary" type="submit">Lagre</button>
      ${r ? '<button type="button" class="btn btn--ghost btn--block btn--danger" data-remove>Fjern målet</button>' : ''}
    </form>`, {
    label: 'Belønningsmål',
    onMount(sheet) {
      const form = sheet.querySelector('#rf');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.elements.name.value.trim();
        const amount = Math.round(parseNum(form.elements.amount.value));
        const hint = sheet.querySelector('#rf-hint');
        if (!name) { hint.textContent = 'Skriv hva belønningen er.'; form.elements.name.focus(); return; }
        if (!(amount > 0)) { hint.textContent = 'Skriv hva den koster.'; form.elements.amount.focus(); return; }
        store.updateSettings({ reward: { name, amount, startAt: r?.startAt ?? new Date().toISOString() } });
        closeSheet();
        toast('Belønningsmålet er lagret');
      });
      sheet.querySelector('[data-remove]')?.addEventListener('click', () => {
        store.updateSettings({ reward: null });
        closeSheet();
        toast('Målet er fjernet');
      });
      if (!r) form.elements.name.focus();
    },
  });
}

function renderProgress() {
  const s = store.settings;
  const w = weekTotals(store.entries);
  const p = kgProgress(totalSpart(store.entries), s.kcalPerKg);
  const quota = s.weeklyTreatKcal
    ? `<p class="hint">Kos-kvote: ${num(w.smakt.kcal)} av ${kcal(s.weeklyTreatKcal)}</p>`
    : '';
  root.querySelector('#fr-progress').innerHTML = `
    <div class="row-between">
      <span class="label">Denne uka</span>
      <span class="hint">Totalt ≈ ${kg(p.kg)}</span>
    </div>
    <div class="duo">
      <div class="duo-spart"><b>${num(w.spart.kcal)}</b><span>kcal spart</span><small>${kr(w.spart.price)}</small></div>
      <div class="duo-smakt"><b>${num(w.smakt.kcal)}</b><span>kcal smakt</span><small>${w.smakt.count} ${w.smakt.count === 1 ? 'gang' : 'ganger'}</small></div>
    </div>
    <div class="bar" role="progressbar" aria-label="Fremdrift mot neste kilo"
      aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(p.frac * 100)}">
      <span style="width:${(p.frac * 100).toFixed(1)}%"></span>
    </div>
    <p class="hint">Mot ${p.whole + 1}. kilo: ${pct(p.frac)} · ${kcal(p.left)} igjen</p>
    ${quota}`;
}

function sortedTreats() {
  // Mest brukt først. Like mange bruk: rekkefølgen de ble laget i.
  return store.treats
    .map((t, i) => [t, i])
    .sort((a, b) => b[0].uses - a[0].uses || a[1] - b[1])
    .map(([t]) => t);
}

function renderTiles() {
  root.querySelector('#fr-tiles').innerHTML = sortedTreats().map((t) => `
    <button type="button" class="tile" data-treat="${esc(t.id)}">
      <span class="tile-emoji" aria-hidden="true">${esc(t.emoji)}</span>
      <span class="tile-name">${esc(t.name)}</span>
      <span class="tile-meta">${num(t.kcal)} kcal</span>
    </button>`).join('') + `
    <button type="button" class="tile tile--new" data-new>
      <span class="tile-emoji" aria-hidden="true">+</span>
      <span class="tile-name">Ny fristelse</span>
    </button>`;
}

function renderWait() {
  clearInterval(timer);
  const box = root.querySelector('#fr-wait');
  const w = store.waiting;
  const t = w && store.treat(w.treatId);
  if (!w || !t) { box.innerHTML = ''; return; }

  const left = Date.parse(w.until) - Date.now();
  const done = left <= 0;
  const amount = w.amount === 1 ? '' : ` × ${amountText(w.amount)}`;
  box.innerHTML = `
    <section class="card wait-card${done ? ' is-done' : ''}">
      <div class="row-between">
        <span class="label">${done ? 'Ti minutter har gått' : 'Venter'}</span>
        ${done ? '' : `<span class="countdown" id="fr-count">${mmss(left)}</span>`}
      </div>
      <p class="wait-q">${done ? `Fortsatt lyst på ${esc(t.name)}?` : `${esc(t.emoji)} ${esc(t.name)}${amount}`}</p>
      <div class="decide">
        <button type="button" class="btn-spart" data-wait-decide="spart">${done ? 'Nei · Spart' : 'Spart'}</button>
        <button type="button" class="btn-smakt" data-wait-decide="smakt">${done ? 'Ja · Smakt' : 'Smakt'}</button>
      </div>
      <button type="button" class="btn btn--ghost btn--block" data-wait-cancel>Avbryt ventingen</button>
    </section>`;

  if (!done) {
    timer = setInterval(() => {
      const l = Date.parse(w.until) - Date.now();
      if (l <= 0) { renderWait(); return; }
      const c = root.querySelector('#fr-count');
      if (c) c.textContent = mmss(l);
    }, 1000);
  }
}

// ---------- Handlinger ----------

function onClick(e) {
  const tile = e.target.closest('[data-treat]');
  if (tile) { const t = store.treat(tile.dataset.treat); if (t) openDecide(t); return; }

  if (e.target.closest('[data-new]')) { openEdit(null); return; }

  if (e.target.closest('[data-week-ok]')) { store.updateSettings({ lastWeekSeen: startOfWeek().toISOString() }); return; }

  if (e.target.closest('[data-reward-edit]')) { openReward(); return; }

  if (e.target.closest('[data-reward-claim]')) {
    const r = store.settings.reward;
    if (r && confirm(`Unne deg ${r.name}? ${kr(r.amount)} trekkes fra sparte kroner.`)) {
      store.claimReward();
      toast(`Registrert: ${r.name}`);
      setTimeout(openReward, 400);
    }
    return;
  }

  const wd = e.target.closest('[data-wait-decide]');
  if (wd) {
    const w = store.waiting;
    const t = w && store.treat(w.treatId);
    store.setWaiting(null);
    if (t) register(wd.dataset.waitDecide, t, w.amount, w.mood, true);
    return;
  }

  if (e.target.closest('[data-wait-cancel]')) {
    store.setWaiting(null);
    toast('Ventingen er avbrutt');
  }
}

function register(kind, t, amount, mood, waited, at = new Date()) {
  const before = totalSpart(store.entries);
  const reward = store.settings.reward;
  const bankBefore = rewardBank(store.entries, store.rewards);
  const entry = {
    id: uid(),
    treatId: t.id,
    name: t.name,
    emoji: t.emoji,
    kcal: Math.round(t.kcal * amount),
    price: Math.round(t.price * amount * 100) / 100,
    amount,
    kind,
    mood,
    waited,
    at: at.toISOString(),
  };
  store.addEntry(entry);
  const earlier = Date.now() - at.getTime() > 60000;

  const undo = {
    action: 'Angre',
    onAction() { store.removeEntry(entry.id); toast('Angret'); },
  };

  if (kind === 'spart') {
    const perKg = store.settings.kcalPerKg;
    const after = before + entry.kcal;
    const p = kgProgress(after, perKg);
    const newKg = Math.floor(after / perKg) > Math.floor(before / perKg);
    const milestone = milestoneCrossed(before, after);
    let msg = `+${kcal(entry.kcal)} spart · ${pct(p.frac)} mot ${p.whole + 1}. kilo`;
    if (milestone) msg = `Milepæl: ${kcal(milestone)} spart totalt`;
    if (newKg) msg = `≈ ${p.whole} kg spart totalt`;
    if (reward && bankBefore < reward.amount && bankBefore + entry.price >= reward.amount) {
      msg = `Belønningsmål nådd: ${reward.name}`;
    }
    if (earlier) msg = `Registrert ${whenText(at)}: +${kcal(entry.kcal)} spart`;
    toast(msg, undo);
  } else {
    const q = store.settings.weeklyTreatKcal;
    const week = weekTotals(store.entries).smakt.kcal;
    let msg = q ? `Smakt: ${kcal(entry.kcal)} · ${num(week)} av ${kcal(q)} i kos-kvoten` : `Smakt: ${kcal(entry.kcal)}`;
    if (earlier) msg = `Registrert ${whenText(at)}: ${kcal(entry.kcal)} smakt`;
    toast(msg, undo);
  }
}

// ---------- Ark: Spart eller Smakt ----------

const dfWhen = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
function whenText(d) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  if (+day === +today) return `i dag ${time}`;
  if (today - day === 864e5) return `i går ${time}`;
  return dfWhen.format(d);
}

/** Dato til et datetime-local-felt (lokal tid). */
export function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function openDecide(t) {
  let amount = 1;
  let mood = null;
  let when = 'now';

  const html = `
    <div class="sheet-top">
      <h2><span class="sheet-emoji" aria-hidden="true">${esc(t.emoji)}</span> ${esc(t.name)}</h2>
      <button type="button" class="btn btn--ghost" data-edit>Rediger</button>
    </div>
    <div class="seg" role="radiogroup" aria-label="Mengde">
      ${AMOUNTS.map((a) => `<button type="button" role="radio" data-amount="${a}" aria-checked="${a === 1}">${amountText(a)}</button>`).join('')}
    </div>
    <p class="amount-out" id="d-out"></p>
    <p class="label">Situasjon <span class="opt muted">valgfritt</span></p>
    <div class="chips">
      ${MOODS.map((m) => `<button type="button" class="chip" data-mood="${m.id}" aria-pressed="false">${m.label}</button>`).join('')}
    </div>
    <p class="label gap">Tidspunkt</p>
    <div class="seg seg--3 when" role="radiogroup" aria-label="Tidspunkt">
      <button type="button" role="radio" data-when="now" aria-checked="true">Nå</button>
      <button type="button" role="radio" data-when="yesterday" aria-checked="false">I går</button>
      <button type="button" role="radio" data-when="pick" aria-checked="false">Velg</button>
    </div>
    <input type="datetime-local" class="field when-input" id="d-at" hidden aria-label="Velg tidspunkt">
    <div class="decide">
      <button type="button" class="btn-spart" data-decide="spart">Spart</button>
      <button type="button" class="btn-smakt" data-decide="smakt">Smakt</button>
    </div>
    <button type="button" class="btn btn--ghost btn--block" data-wait>Vent ${WAIT_MIN} min</button>`;

  openSheet(html, {
    label: t.name,
    onMount(sheet) {
      const out = () => {
        sheet.querySelector('#d-out').innerHTML = `ca. <b>${kcal(t.kcal * amount)}</b> · ${kr(t.price * amount)}`;
      };
      out();
      const atIn = sheet.querySelector('#d-at');
      const waitBtn = sheet.querySelector('[data-wait]');
      const pickedAt = () => {
        if (when === 'yesterday') { const d = new Date(); d.setDate(d.getDate() - 1); return d; }
        if (when === 'pick') {
          const d = new Date(atIn.value);
          return Number.isNaN(+d) ? null : d;
        }
        return new Date();
      };
      sheet.addEventListener('click', (e) => {
        const w = e.target.closest('[data-when]');
        if (w) {
          when = w.dataset.when;
          sheet.querySelectorAll('[data-when]').forEach((b) => b.setAttribute('aria-checked', String(b === w)));
          atIn.hidden = when !== 'pick';
          waitBtn.hidden = when !== 'now'; // venting gir bare mening nå
          if (when === 'pick') {
            const d = new Date(); d.setHours(d.getHours() - 1);
            atIn.max = toLocalInput(new Date());
            if (!atIn.value) atIn.value = toLocalInput(d);
          }
          return;
        }
        const a = e.target.closest('[data-amount]');
        if (a) {
          amount = Number(a.dataset.amount);
          sheet.querySelectorAll('[data-amount]').forEach((b) => b.setAttribute('aria-checked', String(b === a)));
          out();
          return;
        }
        const m = e.target.closest('[data-mood]');
        if (m) {
          mood = mood === m.dataset.mood ? null : m.dataset.mood;
          sheet.querySelectorAll('[data-mood]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mood === mood)));
          return;
        }
        const d = e.target.closest('[data-decide]');
        if (d) {
          const at = pickedAt();
          if (!at) { toast('Velg et tidspunkt'); return; }
          if (at > new Date()) { toast('Tidspunktet kan ikke være fram i tid'); return; }
          closeSheet();
          register(d.dataset.decide, t, amount, mood, false, at);
          return;
        }
        if (e.target.closest('[data-wait]')) {
          closeSheet();
          store.setWaiting({ treatId: t.id, amount, mood, until: new Date(Date.now() + WAIT_MIN * 60000).toISOString() });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          toast(`Venter ${WAIT_MIN} min. Appen spør deg igjen.`);
          return;
        }
        if (e.target.closest('[data-edit]')) openEdit(t);
      });
    },
  });
}

// ---------- Ark: ny eller rediger fristelse ----------

export function openEdit(t) {
  const isNew = !t;
  let typeId = t?.typeId ?? null;
  // Forslag som er fylt inn automatisk. Byttes bare ut så lenge du ikke har endret feltet selv.
  let autoK = null;
  let autoP = null;

  const html = `
    <div class="sheet-top">
      <h2>${isNew ? 'Ny fristelse' : 'Rediger fristelse'}</h2>
      <button type="button" class="btn btn--ghost" data-close>Avbryt</button>
    </div>
    <form id="ef" novalidate>
      <input class="field" name="name" placeholder="Navn, f.eks. Kvikk Lunsj" maxlength="80"
        autocomplete="off" aria-label="Navn" value="${esc(t?.name ?? '')}">
      <p class="label gap">Type</p>
      <div class="chips" role="radiogroup" aria-label="Type">
        ${TYPES.map((ty) => `<button type="button" class="chip" role="radio" data-type="${ty.id}" aria-checked="${ty.id === typeId}"><span aria-hidden="true">${ty.emoji}</span>${ty.name}</button>`).join('')}
      </div>
      <div class="card gap">
        <label class="row-field">
          <span>Kalorier<small>ca., per porsjon</small></span>
          <span class="num-input"><input name="kcal" inputmode="numeric" placeholder="0" value="${t ? num(t.kcal) : ''}"><span>kcal</span></span>
        </label>
        <hr>
        <label class="row-field">
          <span>Pris<small>per porsjon</small></span>
          <span class="num-input"><input name="price" inputmode="decimal" placeholder="0" value="${t ? priceInput(t.price) : ''}"><span>kr</span></span>
        </label>
      </div>
      <p class="hint center" id="ef-hint">Typen gir et forslag. Sjekk gjerne pakken.</p>
      <button class="primary" type="submit">Lagre</button>
      ${isNew ? '' : '<button type="button" class="btn btn--ghost btn--block btn--danger" data-delete>Slett fristelse</button>'}
    </form>`;

  openSheet(html, {
    label: isNew ? 'Ny fristelse' : 'Rediger fristelse',
    onMount(sheet) {
      const form = sheet.querySelector('#ef');
      const kIn = form.elements.kcal;
      const pIn = form.elements.price;
      const hint = sheet.querySelector('#ef-hint');

      sheet.addEventListener('click', (e) => {
        const c = e.target.closest('[data-type]');
        if (c) {
          typeId = c.dataset.type;
          sheet.querySelectorAll('[data-type]').forEach((b) => b.setAttribute('aria-checked', String(b === c)));
          const ty = typeOf(typeId);
          if (!kIn.value || kIn.value === autoK) { kIn.value = autoK = num(ty.kcal); }
          if (!pIn.value || pIn.value === autoP) { pIn.value = autoP = priceInput(ty.price); }
          return;
        }
        if (e.target.closest('[data-delete]')) {
          if (confirm(`Slette ${t.name}? Det du har registrert, blir beholdt.`)) {
            store.deleteTreat(t.id);
            closeSheet();
            toast('Slettet');
          }
        }
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.elements.name.value.trim();
        const k = Math.round(parseNum(kIn.value));
        const p = Math.round(parseNum(pIn.value) * 100) / 100;
        if (!name) { hint.textContent = 'Skriv et navn.'; form.elements.name.focus(); return; }
        if (!(k > 0)) { hint.textContent = 'Skriv inn kalorier, eller velg en type.'; kIn.focus(); return; }

        const tid = typeId || 'annet';
        // Bytter du type, følger emojien med. Ellers beholdes den.
        const emoji = t && t.typeId === tid ? t.emoji : typeOf(tid).emoji;
        if (isNew) {
          store.addTreat({ id: uid(), typeId: tid, emoji, name, kcal: k, price: p, uses: 0, createdAt: new Date().toISOString() });
        } else {
          store.updateTreat(t.id, { typeId: tid, emoji, name, kcal: k, price: p });
        }
        closeSheet();
        toast(isNew ? `${name} er lagt til` : 'Lagret');
      });

      if (isNew) form.elements.name.focus();
    },
  });
}
