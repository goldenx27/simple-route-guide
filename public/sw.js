const CACHE_NAME='simple-route-guide-v1';
const APP_SHELL=['/','/manifest.json','/icons/app-icon.svg','/push-client.js'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))),
    self.clients.claim(),
  ]));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache=>cache.put('/',copy));
      return response;
    }).catch(()=>caches.match('/')));
    return;
  }
  if(['/manifest.json','/icons/app-icon.svg','/push-client.js'].includes(url.pathname)){
    event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
      return response;
    })));
  }
});

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
  const isExternalMap = /^https:\/\/(www\.)?google\.com\/maps/i.test(target);
  if (isExternalMap) {
    event.waitUntil(self.clients.openWindow(target));
    return;
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
