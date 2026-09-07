const CACHE = 'tochka-dnya-v5.8.0';
const FONTS = 'tochka-dnya-fonts-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './supabase.js',
  './icon-180-v3.png',
  './icon-192-v3.png',
  './icon-512-v3.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('tochka-dnya-') && key !== CACHE && key !== FONTS).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // шрифты лежат на чужом домене: без этого они скачивались при каждом открытии
  if (FONT_HOSTS.indexOf(url.hostname) >= 0) {
    event.respondWith(
      caches.open(FONTS).then(cache =>
        cache.match(request).then(cached =>
          cached || fetch(request).then(response => {
            cache.put(request, response.clone());
            return response;
          }).catch(() => cached)
        )
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/activate.html')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (!response.ok) return response;
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (!response.ok) return response;
          const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
      return response;
    }))
  );
});

self.addEventListener('push', event => {
 let data={};try{data=event.data?.json()||{};}catch{}
 event.waitUntil(self.registration.showNotification(data.title||'Точка дня',{
  body:data.body||'Откройте приложение, чтобы посмотреть напоминание.',
  icon:'./icon-192-v3.png',badge:'./icon-192-v3.png',tag:data.tag||'tochka-reminder',
  data:{url:new URL('./',self.registration.scope).href},renotify:false
 }));
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 event.waitUntil((async()=>{
  const url=new URL('./',self.registration.scope).href;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(w=>w.url.startsWith(self.registration.scope));
  if(existing)return existing.focus();return self.clients.openWindow(url);
 })());
});
