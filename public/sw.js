self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'התראה', {
      body: data.body || '',
      tag: data.tag || 'simple-route-alert',
      renotify: true,
      vibrate: [250, 120, 250, 120, 350],
      data: data.data || {},
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification?.data?.url || '/';
  const isExternalMap = /^https:\/\/www\.google\.com\/maps/.test(target);

  if (isExternalMap) {
    event.waitUntil(self.clients.openWindow(target));
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) {
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
