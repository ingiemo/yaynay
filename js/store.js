// Lagring i localStorage. All data ligger bare på denne enheten.

const KEY = 'yaynay:v1';

// Typer gir emoji og forslag til kcal og pris når du lager en ny fristelse.
// Grove anslag (nov. 2026): vanlig butikk-, kiosk- eller bakeripris, ikke tilbudspris.
export const TYPES = [
  { id: 'sjokolade', emoji: '🍫', name: 'Sjokolade', kcal: 270, price: 25 },
  { id: 'godteri',   emoji: '🍬', name: 'Godteri',   kcal: 400, price: 17 },
  { id: 'bakst',     emoji: '🥐', name: 'Bakst',     kcal: 330, price: 45 },
  { id: 'kake',      emoji: '🍰', name: 'Kake',      kcal: 350, price: 70 },
  { id: 'is',        emoji: '🍦', name: 'Is',        kcal: 220, price: 40 },
  { id: 'chips',     emoji: '🍟', name: 'Chips',     kcal: 220, price: 30 },
  { id: 'brus',      emoji: '🥤', name: 'Brus',      kcal: 210, price: 40 },
  { id: 'kjeks',     emoji: '🍪', name: 'Kjeks',     kcal: 150, price: 8 },
  { id: 'annet',     emoji: '🍩', name: 'Annet',     kcal: 250, price: 30 },
];
const TYPE_IDS = TYPES.map((t) => t.id);
export const typeOf = (id) => TYPES.find((t) => t.id === id) || TYPES[TYPES.length - 1];

export const MOODS = [
  { id: 'sliten',    label: 'Sliten' },
  { id: 'sosialt',   label: 'Sosialt' },
  { id: 'kjedelig',  label: 'Kjedelig' },
  { id: 'belonning', label: 'Belønning' },
  { id: 'sulten',    label: 'Sulten' },
];
const MOOD_IDS = MOODS.map((m) => m.id);

export const AMOUNTS = [0.5, 1, 2];
export const KINDS = ['spart', 'smakt'];
export const WAIT_MIN = 10;

// Startsett: [type, navn, kcal, pris]. Kan endres eller slettes.
// Holdes nøytralt med vilje: koden er offentlig. Egne favoritter legges inn på telefonen.
const SEED = [
  ['sjokolade', 'Liten sjokolade, 50 g', 270, 25],
  ['godteri', 'Smågodt, 1 hg', 400, 17],
  ['bakst', 'Bolle', 330, 45],
  ['kake', 'Kakestykke', 350, 70],
  ['is', 'Is', 220, 40],
  ['chips', 'Chips, liten pose', 220, 30],
  ['brus', 'Brus 0,5 l', 210, 40],
  ['kjeks', 'Kjeks, 3 stk', 150, 8],
];

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function fresh() {
  const now = new Date().toISOString();
  return {
    version: 1,
    settings: {
      kcalPerKg: 7700,        // omregning, ikke en vekt
      weeklyTreatKcal: null,  // kos-kvote per uke
      lastExport: null,
      reward: null,           // belønningsmål: { name, amount, startAt }
      lastWeekSeen: null,     // mandagen for sist viste ukesoppsummering
    },
    treats: SEED.map(([typeId, name, kcal, price]) => ({
      id: uid(), typeId, emoji: typeOf(typeId).emoji, name, kcal, price, uses: 0, createdAt: now,
    })),
    entries: [],
    waiting: null, // «Vent 10 min» som pågår
    rewards: [],   // innfridde belønninger: { id, name, amount, at }
  };
}

// Vasker data (særlig fra importerte filer) så bare kjente felt med riktig type blir med.
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numIn = (v, min, max, fallback) => {
  const n = Number(v);
  return v !== null && v !== '' && v !== undefined && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const iso = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);

function cleanTreat(t) {
  if (!t || typeof t !== 'object' || !str(t.id, 64) || !str(t.name, 80)) return null;
  const typeId = TYPE_IDS.includes(t.typeId) ? t.typeId : 'annet';
  return {
    id: str(t.id, 64),
    typeId,
    emoji: str(t.emoji, 16) || typeOf(typeId).emoji,
    name: str(t.name, 80),
    kcal: Math.round(numIn(t.kcal, 0, 10000, 0)),
    price: numIn(t.price, 0, 100000, 0),
    uses: Math.round(numIn(t.uses, 0, 1e6, 0)),
    createdAt: iso(t.createdAt) || new Date().toISOString(),
  };
}

function cleanEntry(e) {
  if (!e || typeof e !== 'object' || !str(e.id, 64) || !KINDS.includes(e.kind) || !iso(e.at)) return null;
  return {
    id: str(e.id, 64),
    treatId: str(e.treatId, 64) || null,
    name: str(e.name, 80) || 'Fristelse',
    emoji: str(e.emoji, 16) || '🍩',
    kcal: Math.round(numIn(e.kcal, 0, 100000, 0)),
    price: numIn(e.price, 0, 1e6, 0),
    amount: AMOUNTS.includes(Number(e.amount)) ? Number(e.amount) : 1,
    kind: e.kind,
    mood: MOOD_IDS.includes(e.mood) ? e.mood : null,
    waited: e.waited === true,
    at: e.at,
  };
}

function cleanReward(r) {
  if (!r || typeof r !== 'object' || !str(r.name, 80)) return null;
  const amount = Math.round(numIn(r.amount, 0, 1e6, 0));
  if (!(amount > 0)) return null;
  return { name: str(r.name, 80), amount, startAt: iso(r.startAt) || new Date().toISOString() };
}

function cleanRedeemed(r) {
  const base = cleanReward(r);
  if (!base || !str(r.id, 64) || !iso(r.at)) return null;
  return { id: str(r.id, 64), name: base.name, amount: base.amount, at: r.at };
}

function cleanWaiting(w, treats) {
  if (!w || typeof w !== 'object' || !iso(w.until)) return null;
  if (!treats.some((t) => t.id === w.treatId)) return null;
  return {
    treatId: w.treatId,
    amount: AMOUNTS.includes(Number(w.amount)) ? Number(w.amount) : 1,
    mood: MOOD_IDS.includes(w.mood) ? w.mood : null,
    until: w.until,
  };
}

function normalize(d) {
  const base = fresh();
  const s = d.settings || {};
  const quota = Math.round(numIn(s.weeklyTreatKcal, 0, 50000, 0));
  const settings = {
    kcalPerKg: Math.round(numIn(s.kcalPerKg, 1000, 20000, 7700)),
    weeklyTreatKcal: quota > 0 ? quota : null,
    lastExport: iso(s.lastExport),
    reward: cleanReward(s.reward),
    lastWeekSeen: iso(s.lastWeekSeen),
  };
  const treats = Array.isArray(d.treats) ? d.treats.map(cleanTreat).filter(Boolean) : base.treats;
  const entries = (Array.isArray(d.entries) ? d.entries : []).map(cleanEntry).filter(Boolean);
  const rewards = (Array.isArray(d.rewards) ? d.rewards : []).map(cleanRedeemed).filter(Boolean);
  return { version: 1, settings, treats, entries, waiting: cleanWaiting(d.waiting, treats), rewards };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) {
    console.warn('Klarte ikke å lese lagrede data', e);
  }
  return fresh();
}

let state = load();
const listeners = new Set();

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Klarte ikke å lagre', e);
    alert('Klarte ikke å lagre. Er lagringen full, eller er privat surfing på?');
  }
  listeners.forEach((fn) => fn(state));
}

export const store = {
  get settings() { return state.settings; },
  get treats() { return state.treats; },
  get entries() { return state.entries; },
  get waiting() { return state.waiting; },
  get rewards() { return state.rewards; },

  treat(id) { return state.treats.find((t) => t.id === id) || null; },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  updateSettings(patch) {
    state.settings = { ...state.settings, ...patch };
    commit();
  },

  addTreat(t) {
    state.treats.push(t);
    commit();
  },

  updateTreat(id, patch) {
    state.treats = state.treats.map((t) => (t.id === id ? { ...t, ...patch } : t));
    commit();
  },

  /** Registreringene beholdes (de har egen kopi av navn, kcal og pris). */
  deleteTreat(id) {
    state.treats = state.treats.filter((t) => t.id !== id);
    if (state.waiting?.treatId === id) state.waiting = null;
    commit();
  },

  addEntry(entry) {
    state.entries.push(entry);
    state.treats = state.treats.map((t) => (t.id === entry.treatId ? { ...t, uses: t.uses + 1 } : t));
    commit();
  },

  updateEntry(id, patch) {
    state.entries = state.entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    commit();
  },

  /** Brukes av «Angre» og sletting. */
  removeEntry(id) {
    const e = state.entries.find((x) => x.id === id);
    if (!e) return;
    state.entries = state.entries.filter((x) => x.id !== id);
    state.treats = state.treats.map((t) => (t.id === e.treatId ? { ...t, uses: Math.max(0, t.uses - 1) } : t));
    commit();
  },

  setWaiting(w) {
    state.waiting = w;
    commit();
  },

  /** Belønningen er innfridd: kronene trekkes fra, og målet nullstilles. */
  claimReward() {
    const r = state.settings.reward;
    if (!r) return;
    state.rewards.push({ id: uid(), name: r.name, amount: r.amount, at: new Date().toISOString() });
    state.settings = { ...state.settings, reward: null };
    commit();
  },

  markExported() {
    state.settings = { ...state.settings, lastExport: new Date().toISOString() };
    commit();
  },

  /** Sletter alt og starter på nytt med startsettet. */
  reset() {
    state = fresh();
    commit();
  },

  exportJSON() {
    return JSON.stringify({ app: 'yaynay', exportedAt: new Date().toISOString(), ...state }, null, 2);
  },

  /** Kaster feil hvis fila ikke ser ut som en eksport fra denne appen. */
  parseImport(text) {
    let d;
    try { d = JSON.parse(text); } catch { throw new Error('Fila er ikke gyldig JSON.'); }
    if (!d || typeof d !== 'object' || !Array.isArray(d.treats) || !Array.isArray(d.entries)) {
      throw new Error('Fila ser ikke ut som en eksport fra YayNay.');
    }
    return normalize(d);
  },

  replaceAll(clean) {
    state = clean;
    commit();
  },

  /** Ber Safari om å ikke rydde bort dataene. Ingen garanti, derfor eksport. */
  async requestPersist() {
    try {
      if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
        await navigator.storage.persist();
      }
    } catch { /* ikke støttet */ }
  },
};
