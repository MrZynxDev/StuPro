export const TYPES = {
  examen: { label: 'Examen', emoji: '📝' },
  devoir: { label: 'Devoir', emoji: '📚' },
  etude: { label: 'Étude', emoji: '🧠' },
};

export const PRIORITIES = {
  basse: 'Basse',
  moyenne: 'Moyenne',
  haute: 'Haute',
};

export const REMINDERS = [
  { value: '', label: 'Aucun rappel' },
  { value: '15', label: '15 min avant' },
  { value: '60', label: '1 h avant' },
  { value: '1440', label: '1 jour avant' },
  { value: '4320', label: '3 jours avant' },
];

export const PALETTE = ['#f2a65a', '#7cc4f2', '#c79bf2', '#f27c8f', '#6fdba7', '#f2d45a', '#8fa4ff', '#5ad1d1'];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const pad = (n) => String(n).padStart(2, '0');

/** Date locale -> "YYYY-MM-DD" */
export function toKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" -> Date locale à minuit */
export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey() {
  return toKey(new Date());
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function daysBetween(fromK, toK) {
  return Math.round((fromKey(toK) - fromKey(fromK)) / 86400000);
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function formatLongDate(key) {
  return capitalize(fromKey(key).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
}

export function formatMonth(year, month) {
  return capitalize(new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
}

export function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  return `${Number(h)}h${m === '00' ? '' : m}`;
}

/** "Aujourd'hui", "Demain", "Dans 3 jours", "Il y a 2 jours" */
export function relativeDay(key) {
  const n = daysBetween(todayKey(), key);
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return 'Demain';
  if (n === -1) return 'Hier';
  if (n > 1) return `Dans ${n} jours`;
  return `Il y a ${-n} jours`;
}

/** Calcule due_at et remind_at (ISO, UTC) à partir de la date/heure locales. Sans heure : 8h00. */
export function computeTimes(date, time, remindMinutes) {
  const due = new Date(`${date}T${time || '08:00'}`);
  const remind = remindMinutes == null || remindMinutes === '' ? null : new Date(due.getTime() - Number(remindMinutes) * 60000);
  return { due_at: due.toISOString(), remind_at: remind ? remind.toISOString() : null };
}

export function pluralItems(n) {
  return n === 0 ? 'Rien' : n === 1 ? '1 élément' : `${n} éléments`;
}
