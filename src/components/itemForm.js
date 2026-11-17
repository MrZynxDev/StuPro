import { esc, TYPES, PRIORITIES, REMINDERS, todayKey, splitDates, defaultSplitStart, formatLongDate, fromKey } from '../utils.js';
import { state, saveItem, saveItemWithParts, deleteItem, partsOf } from '../store.js';
import { icons } from '../icons.js';
import { toast } from './toast.js';

let dialog;

function segmented(name, options, value) {
  return `<div class="segmented" role="radiogroup">
    ${Object.entries(options)
      .map(
        ([v, label]) => `<label class="seg ${name === 'type' ? 'seg-' + v : ''}">
          <input type="radio" name="${name}" value="${v}" ${v === value ? 'checked' : ''} />
          <span>${esc(label)}</span>
        </label>`,
      )
      .join('')}
  </div>`;
}

const SPLIT_LABELS = {
  devoir: 'Découper le travail sur plusieurs jours',
  examen: 'Réviser sur plusieurs jours',
};

function splitSection() {
  return `<div class="split" data-split>
    <label class="toggle">
      <input type="checkbox" name="split" />
      <span class="toggle-ui" aria-hidden="true"></span>
      <span data-split-label>${SPLIT_LABELS.examen}</span>
    </label>
    <div class="split-body" hidden>
      <div class="row">
        <label class="field">
          <span>Nombre de jours</span>
          <input type="number" name="parts" min="2" max="14" value="3" inputmode="numeric" />
        </label>
        <label class="field">
          <span>Commencer le</span>
          <input type="date" name="split_start" value="${todayKey()}" />
        </label>
      </div>
      <p class="hint" data-split-msg></p>
      <ol class="split-list"></ol>
    </div>
  </div>`;
}

/** En modification : rappelle si l'élément est découpé ou s'il est une partie. */
function partsInfo(item) {
  if (item.parent_id) {
    const parent = state.items.find((x) => x.id === item.parent_id);
    return `<p class="split-info">🧩 Partie ${item.part}/${item.parts}${parent ? ` de « ${esc(parent.title)} » (${formatLongDate(parent.date)})` : ''}</p>`;
  }
  if (item.parts) {
    const list = partsOf(item.id);
    const done = list.filter((p) => p.done).length;
    return `<p class="split-info">🧩 Découpé en ${list.length} parties · ${done} faite${done > 1 ? 's' : ''}${list.length ? '. Supprimer cet élément supprime aussi ses parties.' : ''}</p>`;
  }
  return '';
}

/** Branche la logique du découpage : recalcul des dates, dates modifiables à la main. */
function bindSplit(form) {
  const box = form.querySelector('[data-split]');
  if (!box) return () => null;
  const toggle = form.split;
  const body = box.querySelector('.split-body');
  const list = box.querySelector('.split-list');
  const msg = box.querySelector('[data-split-msg]');

  const type = () => form.querySelector('[name=type]:checked').value;
  let startTouched = false;
  form.split_start.addEventListener('change', () => (startTouched = Boolean(form.split_start.value)));
  const formatShort = (k) => fromKey(k).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

  function recompute() {
    const t = type();
    box.hidden = !(t in SPLIT_LABELS);
    if (box.hidden) return;
    box.querySelector('[data-split-label]').textContent = SPLIT_LABELS[t];
    body.hidden = !toggle.checked;
    if (!toggle.checked) return;

    const n = Math.min(14, Math.max(2, Number(form.parts.value) || 2));
    const due = form.date.value;
    // Tant que l'utilisateur n'a pas choisi le début, on prend les n jours juste avant l'échéance
    if (!startTouched && due) form.split_start.value = defaultSplitStart(due, n);
    const start = form.split_start.value || todayKey();
    const { dates, available } = splitDates(start, due, n);
    if (!due || available === 0) msg.textContent = 'La date limite doit être après le jour de début.';
    else if (dates.length < n) msg.textContent = `Seulement ${available} jour${available > 1 ? 's' : ''} avant la date limite : ${dates.length} partie${dates.length > 1 ? 's' : ''}.`;
    else msg.textContent = `${dates.length} jours de suite, du ${formatShort(dates[0])} au ${formatShort(dates[dates.length - 1])} · tu peux changer les dates.`;
    msg.classList.toggle('warn', dates.length < n);

    list.innerHTML = dates
      .map(
        (d, i) => `<li>
          <span>${t === 'examen' ? 'Révision' : 'Partie'} ${i + 1}/${dates.length}</span>
          <input type="date" value="${d}" max="${due}" aria-label="Date de la partie ${i + 1}" />
        </li>`,
      )
      .join('');
  }

  form.querySelectorAll('[name=type], [name=split], [name=parts], [name=split_start], [name=date]').forEach((el) =>
    el.addEventListener(el.type === 'number' ? 'input' : 'change', recompute),
  );
  recompute();

  // Dates choisies (null si le découpage n'est pas actif)
  return () => {
    if (box.hidden || !toggle.checked) return null;
    return [...list.querySelectorAll('input')].map((i) => i.value).filter(Boolean).sort();
  };
}

/** Ouvre le formulaire. `item` pour éditer, sinon `date` pour pré-remplir. */
export function openItemForm({ item = null, date = todayKey() } = {}) {
  dialog?.remove();
  const v = item || {
    type: 'examen',
    title: '',
    subject: '',
    date,
    time: '',
    priority: 'moyenne',
    notes: '',
    remind_minutes_before: state.prefs.defaultReminder === '' ? null : Number(state.prefs.defaultReminder),
  };
  const remindValue = v.remind_minutes_before == null ? '' : String(v.remind_minutes_before);
  const typeLabels = Object.fromEntries(Object.entries(TYPES).map(([k, t]) => [k, t.label]));

  dialog = document.createElement('dialog');
  dialog.className = 'sheet';
  dialog.innerHTML = `
  <form method="dialog" class="sheet-inner">
    <div class="sheet-head">
      <h2>${item ? 'Modifier' : 'Ajouter'}</h2>
      <button type="button" class="icon-btn" data-close aria-label="Fermer">${icons.close}</button>
    </div>

    ${segmented('type', typeLabels, v.type)}

    <label class="field">
      <span>Titre</span>
      <input name="title" required maxlength="120" placeholder="Ex. Contrôle chapitre 3" value="${esc(v.title)}" autocomplete="off" />
    </label>

    <label class="field">
      <span>Matière</span>
      <input name="subject" list="subjects-list" maxlength="60" placeholder="Ex. Histoire" value="${esc(v.subject)}" autocomplete="off" />
      <datalist id="subjects-list">${state.subjects.map((s) => `<option value="${esc(s.name)}"></option>`).join('')}</datalist>
    </label>

    <div class="row">
      <label class="field">
        <span>Date</span>
        <input type="date" name="date" required value="${esc(v.date)}" />
      </label>
      <label class="field">
        <span>Heure <em>(facultatif)</em></span>
        <input type="time" name="time" value="${esc(v.time ? v.time.slice(0, 5) : '')}" />
      </label>
    </div>

    ${item ? partsInfo(item) : splitSection()}

    <div class="field">
      <span>Priorité</span>
      ${segmented('priority', PRIORITIES, v.priority)}
    </div>

    <label class="field">
      <span>Rappel</span>
      <select name="remind">
        ${REMINDERS.map((r) => `<option value="${r.value}" ${r.value === remindValue ? 'selected' : ''}>${r.label}</option>`).join('')}
      </select>
    </label>

    <label class="field">
      <span>Notes <em>(facultatif)</em></span>
      <textarea name="notes" rows="2" maxlength="1000" placeholder="Chapitres à réviser, salle…">${esc(v.notes)}</textarea>
    </label>

    <div class="sheet-actions">
      ${item ? `<button type="button" class="btn btn-danger" data-delete>${icons.trash} Supprimer</button>` : ''}
      <button type="submit" class="btn btn-primary">Enregistrer</button>
    </div>
  </form>`;

  document.body.appendChild(dialog);
  dialog.showModal();
  if (!item) dialog.querySelector('[name=title]').focus();

  const close = () => dialog.close();
  dialog.querySelector('[data-close]').addEventListener('click', close);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close(); // clic sur le fond
  });
  dialog.addEventListener('close', () => dialog.remove());

  dialog.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const n = partsOf(item.id).length;
    if (!confirm(n ? `Supprimer cet élément et ses ${n} parties ?` : 'Supprimer cet élément ?')) return;
    try {
      await deleteItem(item.id);
      close();
      toast('Supprimé');
    } catch (err) {
      toast('Erreur : ' + err.message);
    }
  });

  const getPartDates = bindSplit(dialog.querySelector('form'));

  dialog.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const input = {
      type: f.get('type'),
      title: f.get('title'),
      subject: f.get('subject'),
      date: f.get('date'),
      time: f.get('time'),
      priority: f.get('priority'),
      notes: f.get('notes'),
      remind_minutes_before: f.get('remind'),
    };
    const partDates = item ? null : getPartDates();
    if (partDates && partDates.length < 1) return toast('Choisis au moins un jour avant la date limite.');

    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      if (partDates) await saveItemWithParts(input, partDates);
      else await saveItem(input, item?.id);
      close();
      toast(item ? 'Modifié ✓' : partDates ? `Ajouté ✓ · ${partDates.length} parties planifiées` : 'Ajouté ✓');
    } catch (err) {
      btn.disabled = false;
      toast('Erreur : ' + err.message);
    }
  });
}
