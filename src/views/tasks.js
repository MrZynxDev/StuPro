import { state } from '../store.js';
import { todayKey, addDays, fromKey, toKey } from '../utils.js';
import { itemCard } from '../components/itemCard.js';

const ui = { filter: 'tous', showDone: false };

const FILTERS = { tous: 'Tous', examen: 'Examens', devoir: 'Devoirs', etude: 'Étude' };

function endOfWeek(key) {
  const d = fromKey(key);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); // dimanche
  return toKey(d);
}

export function renderTasks() {
  const today = todayKey();
  const tomorrow = addDays(today, 1);
  const weekEnd = endOfWeek(today);

  const items = state.items
    .filter((i) => ui.filter === 'tous' || i.type === ui.filter)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));

  const pending = items.filter((i) => !i.done);
  const groups = [
    ['En retard', pending.filter((i) => i.date < today), 'late'],
    ["Aujourd'hui", pending.filter((i) => i.date === today)],
    ['Demain', pending.filter((i) => i.date === tomorrow)],
    ['Cette semaine', pending.filter((i) => i.date > tomorrow && i.date <= weekEnd)],
    ['Plus tard', pending.filter((i) => i.date > weekEnd && i.date > tomorrow)],
  ];
  const done = items.filter((i) => i.done).reverse();

  const body = groups
    .filter(([, list]) => list.length)
    .map(
      ([title, list, cls]) => `<section class="group ${cls || ''}">
        <h3>${title} <span>${list.length}</span></h3>
        <div class="list">${list.map((it) => itemCard(it, { showDate: true })).join('')}</div>
      </section>`,
    )
    .join('');

  return `
  <div class="tasks-view">
    <div class="filters" role="tablist">
      ${Object.entries(FILTERS)
        .map(([k, l]) => `<button class="pill ${ui.filter === k ? 'active' : ''}" data-filter="${k}" role="tab" aria-selected="${ui.filter === k}">${l}</button>`)
        .join('')}
    </div>
    ${body || `<div class="empty big"><p>Tout est à jour 🎉</p><p class="muted">Ajoute un examen ou un devoir avec le bouton +.</p></div>`}
    ${
      done.length
        ? `<section class="group done-group">
            <button class="link" data-toggle-done>${ui.showDone ? 'Masquer' : 'Afficher'} les terminés (${done.length})</button>
            ${ui.showDone ? `<div class="list">${done.map((it) => itemCard(it, { showDate: true })).join('')}</div>` : ''}
          </section>`
        : ''
    }
  </div>`;
}

export function bindTasks(root, rerender) {
  root.querySelectorAll('[data-filter]').forEach((el) =>
    el.addEventListener('click', () => {
      ui.filter = el.dataset.filter;
      rerender();
    }),
  );
  root.querySelector('[data-toggle-done]')?.addEventListener('click', () => {
    ui.showDone = !ui.showDone;
    rerender();
  });
}
