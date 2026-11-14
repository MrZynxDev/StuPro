import { supabase, hasSupabase } from './supabase.js';
import { computeTimes, PALETTE } from './utils.js';

const LS_ITEMS = 'stupro:items';
const LS_SUBJECTS = 'stupro:subjects';
const LS_PREFS = 'stupro:prefs';

export const state = {
  user: null,
  items: [],
  subjects: [],
  status: hasSupabase ? 'sync' : 'demo', // 'sync' | 'offline' | 'demo'
  prefs: { defaultReminder: '1440' },
};

const listeners = new Set();
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((fn) => fn(state));
}

/* ---------- Préférences (par appareil) ---------- */
try {
  Object.assign(state.prefs, JSON.parse(localStorage.getItem(LS_PREFS) || '{}'));
} catch {}
export function setPref(key, value) {
  state.prefs[key] = value;
  try {
    localStorage.setItem(LS_PREFS, JSON.stringify(state.prefs));
  } catch {}
  emit();
}

/* ---------- Stockage local (mode démo) ---------- */
function lsRead(k) {
  try {
    return JSON.parse(localStorage.getItem(k) || '[]');
  } catch {
    return [];
  }
}
function lsWrite(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

/* ---------- Auth ---------- */
let channel = null;

export async function initAuth() {
  if (!hasSupabase) {
    state.user = { id: 'demo', email: 'Mode démo' };
    await load();
    return;
  }
  const { data } = await supabase.auth.getSession();
  await setUser(data.session?.user ?? null);
  supabase.auth.onAuthStateChange((_e, session) => {
    const next = session?.user ?? null;
    if (next?.id !== state.user?.id) setUser(next);
  });
  window.addEventListener('online', () => {
    state.status = 'sync';
    load();
  });
  window.addEventListener('offline', () => {
    state.status = 'offline';
    emit();
  });
}

async function setUser(user) {
  state.user = user;
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  if (user) {
    await load();
    channel = supabase
      .channel('stupro-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `user_id=eq.${user.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subjects', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
  } else {
    state.items = [];
    state.subjects = [];
  }
  emit();
}

/** Connexion e-mail + mot de passe (sans e-mail de confirmation : mailer_autoconfirm activé). */
export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error('Compte créé, mais la confirmation par e-mail est encore active côté Supabase.');
}

export async function signOut() {
  if (hasSupabase) await supabase.auth.signOut();
}

/* ---------- Chargement ---------- */
export async function load() {
  if (!hasSupabase) {
    state.items = lsRead(LS_ITEMS);
    state.subjects = lsRead(LS_SUBJECTS);
    emit();
    return;
  }
  const [items, subjects] = await Promise.all([
    supabase.from('items').select('*').order('date').order('time', { nullsFirst: true }),
    supabase.from('subjects').select('*').order('name'),
  ]);
  if (items.error || subjects.error) {
    state.status = 'offline';
  } else {
    state.items = items.data;
    state.subjects = subjects.data;
    state.status = 'sync';
  }
  emit();
}

/* ---------- Items ---------- */
function normalize(input) {
  const remind = input.remind_minutes_before === '' || input.remind_minutes_before == null ? null : Number(input.remind_minutes_before);
  const { due_at, remind_at } = computeTimes(input.date, input.time, remind);
  return {
    type: input.type,
    title: input.title.trim(),
    subject: (input.subject || '').trim(),
    date: input.date,
    time: input.time || null,
    priority: input.priority,
    notes: (input.notes || '').trim(),
    remind_minutes_before: remind,
    due_at,
    remind_at,
  };
}

export async function saveItem(input, id) {
  const row = normalize(input);
  if (row.subject) await ensureSubject(row.subject);

  if (!hasSupabase) {
    const items = lsRead(LS_ITEMS);
    if (id) {
      const i = items.findIndex((x) => x.id === id);
      if (i >= 0) items[i] = { ...items[i], ...row };
    } else {
      items.push({ id: uid(), done: false, created_at: new Date().toISOString(), ...row });
    }
    lsWrite(LS_ITEMS, items);
    return load();
  }
  const q = id ? supabase.from('items').update(row).eq('id', id) : supabase.from('items').insert({ ...row, user_id: state.user.id });
  const { error } = await q;
  if (error) throw error;
  return load();
}

export async function toggleDone(id) {
  const item = state.items.find((x) => x.id === id);
  if (!item) return;
  item.done = !item.done; // optimiste
  emit();
  if (!hasSupabase) {
    lsWrite(LS_ITEMS, state.items);
    return;
  }
  const { error } = await supabase.from('items').update({ done: item.done }).eq('id', id);
  if (error) load();
}

export async function deleteItem(id) {
  if (!hasSupabase) {
    lsWrite(LS_ITEMS, lsRead(LS_ITEMS).filter((x) => x.id !== id));
    return load();
  }
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw error;
  return load();
}

/* ---------- Matières ---------- */
export function subjectColor(name) {
  const s = state.subjects.find((x) => x.name.toLowerCase() === (name || '').toLowerCase());
  return s ? s.color : 'var(--muted)';
}

function nextColor() {
  const used = new Set(state.subjects.map((s) => s.color));
  return PALETTE.find((c) => !used.has(c)) || PALETTE[state.subjects.length % PALETTE.length];
}

async function ensureSubject(name) {
  if (state.subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
  await addSubject(name, nextColor());
}

export async function addSubject(name, color = nextColor()) {
  name = name.trim();
  if (!name || state.subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
  if (!hasSupabase) {
    state.subjects = [...lsRead(LS_SUBJECTS), { id: uid(), name, color }].sort((a, b) => a.name.localeCompare(b.name));
    lsWrite(LS_SUBJECTS, state.subjects);
    return emit();
  }
  const { data, error } = await supabase.from('subjects').insert({ name, color, user_id: state.user.id }).select().single();
  if (error) throw error;
  state.subjects = [...state.subjects, data].sort((a, b) => a.name.localeCompare(b.name));
  emit();
}

export async function updateSubjectColor(id, color) {
  const s = state.subjects.find((x) => x.id === id);
  if (!s) return;
  s.color = color;
  emit();
  if (!hasSupabase) return lsWrite(LS_SUBJECTS, state.subjects);
  await supabase.from('subjects').update({ color }).eq('id', id);
}

export async function deleteSubject(id) {
  state.subjects = state.subjects.filter((x) => x.id !== id);
  emit();
  if (!hasSupabase) return lsWrite(LS_SUBJECTS, state.subjects);
  await supabase.from('subjects').delete().eq('id', id);
}
