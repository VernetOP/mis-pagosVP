const C='mispagos-v6';
// Recordatorios: el aviso llega por Firebase Cloud Messaging y este archivo lo muestra, aunque la app esté cerrada.
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{};}catch(x){d={notification:{body:e.data?e.data.text():''}};}
  const n=d.notification||(d.data&&d.data.notification)||{};
  const link=(d.fcmOptions&&d.fcmOptions.link)||(n.click_action)||self.registration.scope;
  e.waitUntil(self.registration.showNotification(n.title||'MisPagosVP',{body:n.body||'',icon:'icon-192.png',badge:'icon-192.png',data:{link:link},tag:d.fcmMessageId||undefined}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url=(e.notification.data&&e.notification.data.link)||self.registration.scope;
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{
    for(const w of ws){if(w.url.startsWith(self.registration.scope)&&'focus'in w)return w.focus();}
    return clients.openWindow(url);
  }));
});
const FILES=["./","./index.html","./app.js?v=6","./config.js?v=6","./manifest.json","./icon-192.png","./icon-512.png"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return; // los datos de Google siempre van directo, nunca se guardan
  e.respondWith(fetch(e.request,{cache:'no-cache'}).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(e.request,cp));}return res;})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));
});
