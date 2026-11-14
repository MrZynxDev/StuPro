// Service worker StuPro : reçoit les notifications push et ouvre le bon jour au clic.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'StuPro', body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'StuPro', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = all.find((c) => c.url.startsWith(self.location.origin));
      if (client) {
        await client.navigate(url).catch(() => {});
        return client.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
