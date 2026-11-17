import { esc, formatTime, relativeDay, formatLongDate, TYPES, PRIORITIES, daysBetween, todayKey } from '../utils.js';
import { subjectColor, partsOf } from '../store.js';
import { icons } from '../icons.js';

/** Carte d'un élément. `showDate` pour la liste des tâches. */
export function itemCard(item, { showDate = false } = {}) {
  const color = subjectColor(item.subject);
  const meta = [item.subject, showDate ? `${relativeDay(item.date)} · ${formatLongDate(item.date)}` : null, formatTime(item.time)]
    .filter(Boolean)
    .map(esc)
    .join(' · ');

  let countdown = '';
  if (item.type === 'examen' && !item.done) {
    const n = daysBetween(todayKey(), item.date);
    if (n >= 0) countdown = `<span class="countdown">${n === 0 ? 'J-J' : `J-${n}`}</span>`;
  }

  let partTag = '';
  if (item.parent_id && item.part) partTag = `<span class="tag tag-part">${item.part}/${item.parts}</span>`;
  else if (item.parts) {
    const list = partsOf(item.id);
    const done = list.filter((p) => p.done).length;
    partTag = `<span class="tag tag-progress ${list.length && done === list.length ? 'complete' : ''}" title="Parties faites">✓ ${done}/${list.length || item.parts}</span>`;
  }

  return `
  <article class="card ${item.done ? 'is-done' : ''}" data-id="${esc(item.id)}" style="--subject:${esc(color)}">
    <button class="check" data-action="toggle" aria-label="${item.done ? 'Marquer comme non fait' : 'Marquer comme fait'}" aria-pressed="${item.done}">${icons.check}</button>
    <div class="card-body" data-action="edit">
      <div class="card-title">${esc(item.title)}</div>
      <div class="card-meta">${meta || TYPES[item.type].label}</div>
    </div>
    <div class="card-tags" data-action="edit">
      ${countdown}
      ${partTag}
      <span class="tag tag-${esc(item.type)}">${TYPES[item.type].label}</span>
      ${item.priority === 'haute' ? `<span class="tag tag-haute">${PRIORITIES.haute}</span>` : ''}
    </div>
  </article>`;
}
