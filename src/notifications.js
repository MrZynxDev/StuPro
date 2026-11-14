import { supabase, hasSupabase } from './supabase.js';
import { state } from './store.js';
import { TYPES, formatTime, relativeDay } from './utils.js';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const LS_SHOWN = 'stupro:notified';

export const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function permission() {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** true si cet appareil est abonné aux notifications push serveur. */
export async function isSubscribed() {
  if (!pushSupported) return false;
  const reg = await navigator.serviceWorker.ready;
  return Boolean(await reg.pushManager.getSubscription());
}

/** Demande la permission puis abonne l'appareil (push serveur si Supabase + clé VAPID, sinon rappels locaux). */
export async function enableNotifications() {
  if (!('Notification' in window)) throw new Error("Ce navigateur ne gère pas les notifications. Sur iPhone, ajoute d'abord le site à l'écran d'accueil.");
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permission refusée. Autorise les notifications dans les réglages du navigateur.');

  if (hasSupabase && VAPID_PUBLIC_KEY && pushSupported) {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
    const json = sub.toJSON();
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ user_id: state.user.id, endpoint: json.endpoint, keys: json.keys, user_agent: navigator.userAgent }, { onConflict: 'endpoint' });
    if (error) throw error;
  }
  await sendTest();
}

export async function disableNotifications() {
  if (!pushSupported) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  if (hasSupabase) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

async function show(title, options) {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) return reg.showNotification(title, options);
  return new Notification(title, options);
}

export function sendTest() {
  return show('StuPro 🔔', { body: 'Les notifications sont activées.', icon: '/icons/icon-192.png', badge: '/icons/badge.png' });
}

export function notificationText(item) {
  const t = TYPES[item.type];
  return {
    title: `${t.emoji} ${t.label} — ${item.title}`,
    body: [item.subject, `${relativeDay(item.date)}${item.time ? ' à ' + formatTime(item.time) : ''}`].filter(Boolean).join(' · '),
  };
}

/**
 * Rappels locaux : quand le site est ouvert (ou en mode démo sans serveur push),
 * on vérifie chaque minute les rappels arrivés à échéance.
 */
export function startLocalReminders() {
  const check = async () => {
    if (permission() !== 'granted') return;
    if (hasSupabase && VAPID_PUBLIC_KEY && (await isSubscribed())) return; // le serveur s'en charge
    let shown;
    try {
      shown = new Set(JSON.parse(localStorage.getItem(LS_SHOWN) || '[]'));
    } catch {
      shown = new Set();
    }
    const now = Date.now();
    for (const it of state.items) {
      if (it.done || !it.remind_at || shown.has(it.id + it.remind_at)) continue;
      const at = new Date(it.remind_at).getTime();
      if (at <= now && now - at < 6 * 3600000) {
        const { title, body } = notificationText(it);
        await show(title, { body, icon: '/icons/icon-192.png', badge: '/icons/badge.png', tag: it.id, data: { url: `/?date=${it.date}` } });
        shown.add(it.id + it.remind_at);
      }
    }
    try {
      localStorage.setItem(LS_SHOWN, JSON.stringify([...shown].slice(-300)));
    } catch {}
  };
  check();
  setInterval(check, 60000);
}
