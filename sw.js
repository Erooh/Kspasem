// Kspasem service worker: shows greeting notifications even when the page is closed
// (works where the browser supports periodic background sync / notification triggers).
var MORNING = ['Բարի լույս, սիրելիս ☀️ Թող այսօրվա օրը լինի թեթև ու լույսով լի ♥️','Բարի լույս 🥹 Ամեն առավոտ քեզ մի քայլ ավելի մոտ է տանը 🪖','Բարի լույս 😇 Այսօր էլ հպարտ եմ քեզնով 💖','Բարի լույս ✨ Մտքովս քեզ հետ եմ, ամեն պահ 🫶🏼','Բարի լույս 💚 Թող օրդ անցնի խաղաղ ու ժպիտով 🪖'];
var NIGHT = ['Բարի գիշեր 😇 Թող քնդ խաղաղ լինի ♥️','Բարի գիշեր 💫 Եվս մեկ օր մոտ ենք հանդիպմանը 🫶🏼','Բարի գիշեր 🥺 Երազներում հանդիպենք 💋','Բարի գիշեր ✨ Հանգիստ քնիր, ես քեզ սպասում եմ 💖','Բարի գիշեր 🪖 Թող Աստված պահի քեզ ✝️'];
function pick(a){ return a[Math.floor(Date.now()/86400000) % a.length]; }
function show(kind){
  var m = kind === 'morning';
  return self.registration.showNotification(m ? 'Բարի լույս' : 'Բարի գիշեր', {
    body: pick(m ? MORNING : NIGHT), icon: 'icons/icon-192.png', tag: 'kspasem-' + kind, renotify: false
  });
}
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('message', function(e){ if(e.data && e.data.show) e.waitUntil(show(e.data.show)); });
self.addEventListener('periodicsync', function(e){
  if(e.tag !== 'kspasem-greetings') return;
  var h = new Date().getHours();
  if(h >= 10 && h < 12) e.waitUntil(show('morning'));
  else if(h >= 23 || h < 1) e.waitUntil(show('night'));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window'}).then(function(c){ return c.length ? c[0].focus() : self.clients.openWindow('./'); }));
});
