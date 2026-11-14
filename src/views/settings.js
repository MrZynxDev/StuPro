import { state, setPref, addSubject, deleteSubject, updateSubjectColor, signOut } from '../store.js';
import { hasSupabase } from '../supabase.js';
import { esc, REMINDERS } from '../utils.js';
import { icons } from '../icons.js';
import { permission, enableNotifications, disableNotifications, isSubscribed, sendTest } from '../notifications.js';
import { toast } from '../components/toast.js';

let subscribed = false;

function notifStatus() {
  const p = permission();
  if (p === 'unsupported') return { text: 'Non pris en charge par ce navigateur', on: false };
  if (p === 'denied') return { text: 'Bloquées — autorise-les dans les réglages du navigateur', on: false };
  if (p === 'granted' && (subscribed || !hasSupabase)) return { text: 'Activées sur cet appareil', on: true };
  return { text: 'Désactivées sur cet appareil', on: false };
}

export function renderSettings() {
  const st = notifStatus();
  return `
  <div class="settings-view">
    <section class="panel">
      <h3>${icons.bell} Notifications</h3>
      <p class="muted">${st.text}</p>
      <div class="actions">
        ${
          st.on
            ? `<button class="btn btn-ghost" data-notif="test">Envoyer un test</button>
               ${hasSupabase ? `<button class="btn btn-ghost" data-notif="off">Désactiver</button>` : ''}`
            : `<button class="btn btn-primary" data-notif="on" ${permission() === 'denied' || permission() === 'unsupported' ? 'disabled' : ''}>Activer les notifications</button>`
        }
      </div>
      <label class="field">
        <span>Rappel par défaut pour les nouveaux éléments</span>
        <select data-pref="defaultReminder">
          ${REMINDERS.map((r) => `<option value="${r.value}" ${r.value === state.prefs.defaultReminder ? 'selected' : ''}>${r.label}</option>`).join('')}
        </select>
      </label>
      <p class="hint">À activer sur chaque appareil (téléphone et laptop). Sur iPhone : Partager → « Sur l'écran d'accueil », puis ouvre l'app depuis l'icône.</p>
    </section>

    <section class="panel">
      <h3>Matières</h3>
      <ul class="subjects">
        ${
          state.subjects.length
            ? state.subjects
                .map(
                  (s) => `<li>
              <input type="color" value="${esc(s.color)}" data-color="${esc(s.id)}" aria-label="Couleur de ${esc(s.name)}" />
              <span>${esc(s.name)}</span>
              <button class="icon-btn" data-del-subject="${esc(s.id)}" aria-label="Supprimer ${esc(s.name)}">${icons.trash}</button>
            </li>`,
                )
                .join('')
            : '<li class="muted">Aucune matière. Elles sont créées automatiquement quand tu ajoutes un élément.</li>'
        }
      </ul>
      <form class="add-subject">
        <input name="name" placeholder="Nouvelle matière" maxlength="60" autocomplete="off" />
        <button class="btn btn-ghost" type="submit">Ajouter</button>
      </form>
    </section>

    <section class="panel">
      <h3>Compte</h3>
      ${
        hasSupabase
          ? `<p class="muted">Connecté : ${esc(state.user?.email)}</p>
             <button class="btn btn-ghost" data-logout>${icons.logout} Se déconnecter</button>`
          : `<p class="muted"><strong>Mode démo</strong> : les données sont enregistrées uniquement dans ce navigateur.
             Configure Supabase (voir README) pour synchroniser téléphone et laptop.</p>`
      }
    </section>
  </div>`;
}

export function bindSettings(root, rerender) {
  isSubscribed().then((v) => {
    if (v !== subscribed) {
      subscribed = v;
      rerender();
    }
  });

  root.querySelector('[data-notif="on"]')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try {
      await enableNotifications();
      subscribed = await isSubscribed();
      toast('Notifications activées ✓');
    } catch (err) {
      toast(err.message);
    }
    rerender();
  });
  root.querySelector('[data-notif="off"]')?.addEventListener('click', async () => {
    await disableNotifications();
    subscribed = false;
    toast('Notifications désactivées');
    rerender();
  });
  root.querySelector('[data-notif="test"]')?.addEventListener('click', () => sendTest());

  root.querySelector('[data-pref]')?.addEventListener('change', (e) => setPref(e.target.dataset.pref, e.target.value));

  root.querySelectorAll('[data-color]').forEach((el) => el.addEventListener('change', () => updateSubjectColor(el.dataset.color, el.value)));
  root.querySelectorAll('[data-del-subject]').forEach((el) =>
    el.addEventListener('click', () => {
      if (confirm('Supprimer cette matière ? Les éléments existants gardent leur nom de matière.')) deleteSubject(el.dataset.delSubject);
    }),
  );
  root.querySelector('.add-subject').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    try {
      await addSubject(name);
    } catch (err) {
      toast('Erreur : ' + err.message);
    }
  });

  root.querySelector('[data-logout]')?.addEventListener('click', () => signOut());
}
