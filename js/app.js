// Oppstart og fanebytte.

import { store } from './store.js';
import * as fristelse from './views/fristelse.js';
import * as oversikt from './views/oversikt.js';
import * as innstillinger from './views/innstillinger.js';

const VIEWS = { fristelse, oversikt, innstillinger };
const mounted = new Set();
const currentName = () => (VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'fristelse');

function show() {
  const current = currentName();
  for (const key of Object.keys(VIEWS)) {
    document.getElementById(`view-${key}`).hidden = key !== current;
  }
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.tab === current) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  const el = document.getElementById(`view-${current}`);
  if (!mounted.has(current)) {
    VIEWS[current].mount(el);
    mounted.add(current);
  }
  VIEWS[current].show?.();
  window.scrollTo(0, 0);
}

// Bytt fane uten å fylle opp historikken.
document.querySelector('.tabbar').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-tab]');
  if (!a) return;
  e.preventDefault();
  history.replaceState(null, '', `#${a.dataset.tab}`);
  show();
});

window.addEventListener('hashchange', show);
// Når appen åpnes igjen fra hjemskjermen kan ventetiden være over: oppdater uten å scrolle.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const current = currentName();
  if (mounted.has(current)) VIEWS[current].show?.();
});

show();
store.requestPersist();

// ---------- Offline (service worker) ----------
// Ikke på localhost under utvikling (da ville gamle filer ligge i cachen), med mindre ?sw står i adressen.
const isDev = ['localhost', '127.0.0.1'].includes(location.hostname) && !new URLSearchParams(location.search).has('sw');

if ('serviceWorker' in navigator && !isDev) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      const offer = (worker) => {
        document.getElementById('update').hidden = false;
        document.getElementById('update-btn').onclick = () => worker.postMessage('skipWaiting');
      };
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
        });
      });
      // Se etter ny versjon når appen åpnes igjen.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (e) {
      console.warn('Service worker ble ikke registrert', e);
    }
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}
