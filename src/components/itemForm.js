import { esc, TYPES, PRIORITIES, REMINDERS, todayKey } from '../utils.js';
import { state, saveItem, deleteItem } from '../store.js';
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
    if (!confirm('Supprimer cet élément ?')) return;
    try {
      await deleteItem(item.id);
      close();
      toast('Supprimé');
    } catch (err) {
      toast('Erreur : ' + err.message);
    }
  });

  dialog.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await saveItem(
        {
          type: f.get('type'),
          title: f.get('title'),
          subject: f.get('subject'),
          date: f.get('date'),
          time: f.get('time'),
          priority: f.get('priority'),
          notes: f.get('notes'),
          remind_minutes_before: f.get('remind'),
        },
        item?.id,
      );
      close();
      toast(item ? 'Modifié ✓' : 'Ajouté ✓');
    } catch (err) {
      btn.disabled = false;
      toast('Erreur : ' + err.message);
    }
  });
}
