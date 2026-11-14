import './styles.css';
import { state, initAuth, onChange, toggleDone } from './store.js';
import { hasSupabase } from './supabase.js';
import { renderCalendar, bindCalendar, selectDate, ui as calUi } from './views/calendar.js';
import { renderTasks, bindTasks } from './views/tasks.js';
import { renderSettings, bindSettings } from './views/settings.js';
import { renderLogin, bindLogin } from './views/login.js';
import { openItemForm } from './components/itemForm.js';
import { registerSW, startLocalReminders } from './notifications.js';
import { icons } from './icons.js';
import { esc } from './utils.js';

const root = document.getElementById('root');

const TABS = {
  calendrier: { label: 'Calendrier', icon: icons.calendar, render: renderCalendar, bind: bindCalendar },
  taches: { label: 'Tâches', icon: icons.tasks, render: renderTasks, bind: bindTasks },
  reglages: { label: 'Réglages', icon: icons.settings, render: renderSettings, bind: bindSettings },
};

function currentTab() {
  const t = location.hash.slice(1);
  return TABS[t] ? t : 'calendrier';
}

const STATUS = { sync: 'Synchronisé', offline: 'Hors ligne', demo: 'Démo (local)' };

let shellReady = false;

function renderShell() {
  const initial = (hasSupabase ? state.user?.email || 'S' : 'S').trim().charAt(0).toUpperCase();
  root.innerHTML = `
  <div class="app">
    <header class="topbar">
      <div class="avatar" aria-hidden="true">${esc(initial)}</div>
      <h1 class="title"></h1>
      <span class="status"></span>
    </header>
    <nav class="tabbar" aria-label="Navigation">
      <div class="brand"><div class="avatar">${esc(initial)}</div><span>StuPro</span></div>
      ${Object.entries(TABS)
        .map(([k, t]) => `<a href="#${k}" class="tab" data-tab="${k}">${t.icon}<span>${t.label}</span></a>`)
        .join('')}
    </nav>
    <main id="view"></main>
    <button class="fab" aria-label="Ajouter un examen ou un devoir">${icons.plus}<span>Ajouter</span></button>
  </div>`;
  root.querySelector('.fab').addEventListener('click', () => openItemForm({ date: calUi.selected }));

  // Délégation : cocher / éditer une carte, ajouter depuis un jour vide
  root.querySelector('#view').addEventListener('click', (e) => {
    const add = e.target.closest('[data-add-date]');
    if (add) return openItemForm({ date: add.dataset.addDate });
    const actionEl = e.target.closest('[data-action]');
    const card = e.target.closest('.card');
    if (!actionEl || !card) return;
    const id = card.dataset.id;
    if (actionEl.dataset.action === 'toggle') toggleDone(id);
    else openItemForm({ item: state.items.find((x) => x.id === id) });
  });
  shellReady = true;
}

function render() {
  if (hasSupabase && !state.user) {
    shellReady = false;
    root.innerHTML = renderLogin();
    bindLogin(root, render);
    return;
  }
  if (!shellReady) renderShell();

  const tab = currentTab();
  const view = root.querySelector('#view');
  const scroll = view.scrollTop;
  view.innerHTML = TABS[tab].render();
  view.dataset.tab = tab;
  TABS[tab].bind(view, render);
  view.scrollTop = scroll;

  root.querySelector('.title').textContent = TABS[tab].label;
  const status = root.querySelector('.status');
  status.textContent = STATUS[state.status];
  status.dataset.state = state.status;
  root.querySelectorAll('.tab').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  document.title = `${TABS[tab].label} · StuPro`;
}

// ?date=YYYY-MM-DD (depuis une notification) ouvre ce jour-là
const params = new URLSearchParams(location.search);
if (/^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '')) {
  selectDate(params.get('date'));
  history.replaceState(null, '', location.pathname + '#calendrier');
}

window.addEventListener('hashchange', render);
onChange(render);

// Rafraîchit "aujourd'hui" si l'app reste ouverte après minuit
let lastDay = new Date().toDateString();
setInterval(() => {
  if (new Date().toDateString() !== lastDay) {
    lastDay = new Date().toDateString();
    render();
  }
}, 60000);

root.innerHTML = '<div class="loading">Chargement…</div>';
registerSW();
initAuth().then(() => {
  render();
  startLocalReminders();
});
