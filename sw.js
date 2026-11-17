// Kspasem service worker (վեբ/PWA տարբերակ)՝ ամբողջ հավելվածը աշխատում է օֆլայն
// + ցույց է տալիս ծանուցումները։ APK-ում պետք չէ. այնտեղ ֆայլերը արդեն հեռախոսի մեջ են։
var CACHE = 'kspasem-v3';
var CORE = ['./', 'index.html', 'app.js', 'firebase-config.js', 'style.css', 'manifest.json',
  'assets/icons/icon-192.png', 'assets/icons/icon-180.png', 'assets/icons/icon-512.png', 'assets/icons/logo.png', 'assets/icons/premium-badge.png',
  'assets/images/background.png', 'assets/images/lock-background.png', 'assets/images/setup-hero.png', 'assets/images/achievement.png',
  'assets/images/day-celebrate-icon.png', 'assets/images/onboarding-0.png', 'assets/images/onboarding-1.png',
  'assets/images/onboarding-2.jpg', 'assets/images/onboarding-3.png'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(CORE.map(function(u){ return c.add(u).catch(function(){}); }));
  }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e){
  var req = e.request, url = new URL(req.url);
  if(req.method !== 'GET' || url.origin !== self.location.origin) return;   // Firebase և այլն՝ առանց քեշի
  var isCode = /\.(html|js|css|json)$/.test(url.pathname) || url.pathname.slice(-1) === '/';
  if(isCode){
    // առցանց՝ նոր տարբերակը, օֆլայն՝ պահվածը
    e.respondWith(fetch(req).then(function(r){
      var copy = r.clone(); caches.open(CACHE).then(function(c){ c.put(req, copy); }); return r;
    }).catch(function(){
      return caches.match(req, { ignoreSearch: true }).then(function(m){ return m || caches.match('index.html'); });
    }));
  } else {
    e.respondWith(caches.match(req).then(function(m){
      return m || fetch(req).then(function(r){
        var copy = r.clone(); caches.open(CACHE).then(function(c){ c.put(req, copy); }); return r;
      });
    }));
  }
});

self.addEventListener('message', function(e){
  var d = e.data;
  if(d && d.title) e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body || '', icon: 'assets/icons/icon-192.png', badge: 'assets/icons/icon-192.png', tag: d.tag || 'kspasem'
  }));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(function(c){ return c.length ? c[0].focus() : self.clients.openWindow('./'); }));
});
