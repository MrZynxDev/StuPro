// Edge Function Supabase : envoie les rappels push arrivés à échéance.
// Appelée chaque minute par pg_cron (voir README). Protégée par l'en-tête x-cron-secret.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const TYPES: Record<string, { label: string; emoji: string }> = {
  examen: { label: 'Examen', emoji: '📝' },
  devoir: { label: 'Devoir', emoji: '📚' },
  etude: { label: 'Étude', emoji: '🧠' },
};

const MAX_LATE_MS = 6 * 3600 * 1000; // un rappel en retard de plus de 6 h n'est plus envoyé

function whenText(date: string, time: string | null) {
  const d = new Date(`${date}T12:00:00Z`);
  const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);
  if (!time) return `Le ${day}`;
  const [h, m] = time.split(':');
  return `Le ${day} à ${Number(h)}h${m === '00' ? '' : m}`;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('Forbidden', { status: 403 });
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  );

  const now = new Date();
  // "Réserve" les rappels dus en une seule requête pour éviter les doublons
  const { data: due, error } = await sb
    .from('items')
    .update({ notified_at: now.toISOString() })
    .lte('remind_at', now.toISOString())
    .is('notified_at', null)
    .eq('done', false)
    .select('id, user_id, type, title, subject, date, time, remind_at');
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  for (const item of due ?? []) {
    if (now.getTime() - new Date(item.remind_at).getTime() > MAX_LATE_MS) continue;

    const { data: subs } = await sb.from('push_subscriptions').select('id, endpoint, keys').eq('user_id', item.user_id);
    const t = TYPES[item.type] ?? TYPES.devoir;
    const payload = JSON.stringify({
      title: `${t.emoji} ${t.label} — ${item.title}`,
      body: [item.subject, whenText(item.date, item.time)].filter(Boolean).join(' · '),
      tag: item.id,
      url: `/?date=${item.date}`,
    });

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 3600 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('id', sub.id); // abonnement expiré
        else console.error('push error', code, e);
      }
    }
  }

  return Response.json({ due: due?.length ?? 0, sent });
});
