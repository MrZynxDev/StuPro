import { state, subjectColor } from '../store.js';
import { esc, toKey, fromKey, todayKey, formatMonth, formatLongDate, pluralItems, relativeDay } from '../utils.js';
import { itemCard } from '../components/itemCard.js';
import { icons } from '../icons.js';

export const ui = {
  selected: todayKey(),
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
};

export function selectDate(key) {
  ui.selected = key;
  const d = fromKey(key);
  ui.year = d.getFullYear();
  ui.month = d.getMonth();
}

function byDate() {
  const map = new Map();
  for (const it of state.items) {
    if (!map.has(it.date)) map.set(it.date, []);
    map.get(it.date).push(it);
  }
  return map;
}

function sortDay(list) {
  return [...list].sort((a, b) => a.done - b.done || (a.time || '').localeCompare(b.time || ''));
}

/** Prochain examen non fait : affiché en haut pour voir l'essentiel d'un coup d'œil. */
function nextExamBanner() {
  const today = todayKey();
  const exam = state.items
    .filter((i) => i.type === 'examen' && !i.done && i.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))[0];
  if (!exam) return '';
  return `<button class="next-exam" data-goto="${esc(exam.date)}" style="--subject:${esc(subjectColor(exam.subject))}">
    <span class="next-exam-label">Prochain examen</span>
    <span class="next-exam-title">${esc(exam.title)}${exam.subject ? ` · ${esc(exam.subject)}` : ''}</span>
    <span class="next-exam-when">${relativeDay(exam.date)}</span>
  </button>`;
}

export function renderCalendar() {
  const map = byDate();
  const today = todayKey();
  const first = new Date(ui.year, ui.month, 1);
  const offset = (first.getDay() + 6) % 7; // semaine commence lundi
  const start = new Date(ui.year, ui.month, 1 - offset);
  const daysInMonth = new Date(ui.year, ui.month + 1, 0).getDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);

  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = toKey(d);
    const list = sortDay(map.get(key) || []);
    const outside = d.getMonth() !== ui.month;
    const chips = list
      .slice(0, 2)
      .map(
        (it) =>
          `<span class="chip ${it.done ? 'is-done' : ''} ${it.type === 'examen' ? 'chip-exam' : ''}" style="--subject:${esc(subjectColor(it.subject))}">${esc(it.subject || it.title)}</span>`,
      )
      .join('');
    const dots = list
      .slice(0, 4)
      .map((it) => `<i style="--subject:${esc(subjectColor(it.subject))}" class="${it.done ? 'is-done' : ''}"></i>`)
      .join('');
    cells += `<button class="day ${outside ? 'outside' : ''} ${key === today ? 'today' : ''} ${key === ui.selected ? 'selected' : ''}"
        data-date="${key}" aria-label="${formatLongDate(key)}, ${pluralItems(list.length)}">
      <span class="day-num">${d.getDate()}</span>
      <span class="chips">${chips}${list.length > 2 ? `<span class="more">+${list.length - 2}</span>` : ''}</span>
      <span class="dots">${dots}</span>
    </button>`;
  }

  const dayItems = sortDay(map.get(ui.selected) || []);
  const isToday = ui.selected === today;

  return `
  <div class="calendar-layout">
    <section class="cal-panel">
      ${nextExamBanner()}
      <div class="cal-head">
        <h2>${formatMonth(ui.year, ui.month)}</h2>
        <div class="cal-nav">
          ${isToday && ui.month === new Date().getMonth() ? '' : `<button class="btn btn-ghost btn-sm" data-cal="today">Aujourd'hui</button>`}
          <button class="icon-btn" data-cal="prev" aria-label="Mois précédent">${icons.left}</button>
          <button class="icon-btn" data-cal="next" aria-label="Mois suivant">${icons.right}</button>
        </div>
      </div>
      <div class="cal-grid" role="grid">
        ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<div class="weekday">${d}</div>`).join('')}
        ${cells}
      </div>
    </section>

    <section class="day-panel">
      <div class="day-head">
        <div>
          <div class="eyebrow">${isToday ? "Aujourd'hui" : relativeDay(ui.selected)}</div>
          <h2>${formatLongDate(ui.selected)}</h2>
        </div>
        <span class="count">${pluralItems(dayItems.length)}</span>
      </div>
      <div class="list">
        ${
          dayItems.length
            ? dayItems.map((it) => itemCard(it)).join('')
            : `<div class="empty">
                <p>Rien de prévu ce jour-là.</p>
                <button class="btn btn-ghost" data-add-date="${ui.selected}">${icons.plus} Ajouter</button>
              </div>`
        }
      </div>
    </section>
  </div>`;
}

export function bindCalendar(root, rerender) {
  root.querySelectorAll('.day').forEach((el) =>
    el.addEventListener('click', () => {
      selectDate(el.dataset.date);
      rerender();
    }),
  );
  root.querySelector('.next-exam')?.addEventListener('click', (e) => {
    selectDate(e.currentTarget.dataset.goto);
    rerender();
  });
  root.querySelectorAll('[data-cal]').forEach((el) =>
    el.addEventListener('click', () => {
      const a = el.dataset.cal;
      if (a === 'today') selectDate(todayKey());
      else {
        const d = new Date(ui.year, ui.month + (a === 'next' ? 1 : -1), 1);
        ui.year = d.getFullYear();
        ui.month = d.getMonth();
      }
      rerender();
    }),
  );

  // Swipe horizontal sur la grille pour changer de mois
  const grid = root.querySelector('.cal-grid');
  let x0 = null;
  grid.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
  grid.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 60) return;
    const d = new Date(ui.year, ui.month + (dx < 0 ? 1 : -1), 1);
    ui.year = d.getFullYear();
    ui.month = d.getMonth();
    rerender();
  });
}
