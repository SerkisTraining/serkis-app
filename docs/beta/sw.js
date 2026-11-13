const C="serkis-3.0-prova";
const BASE=new URL("./",self.registration.scope).pathname;
const SHELL=["./","index.html","manifest.webmanifest","favicon.svg","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png","icons/favicon-32.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin)return;
  if(/^(c|beta)\//.test(u.pathname.slice(BASE.length)))return;
  if(r.mode==="navigate"||u.pathname.endsWith("/")||u.pathname.endsWith("index.html")){
    e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put("index.html",cp));return res}).catch(()=>caches.match("index.html")));return;
  }
  e.respondWith(caches.match(r).then(x=>x||fetch(r)));
});
