/* MilkIQ — service worker (gerado por tools/build-site.js; não editar o sw.js publicado).
 * Guarda todos os arquivos do app no aparelho para funcionar sem internet.
 * Uma nova versão só assume quando o usuário toca em "Atualizar agora" (mensagem skipWaiting). */
const VERSION = "__VERSION__", ENV = "__ENV__", CACHE = "milkiq-" + ENV + "-" + VERSION, FILES = __FILES__;
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("milkiq-" + ENV + "-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));
self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  const scope = new URL(self.registration.scope);
  if (!u.pathname.startsWith(scope.pathname)) return;
  if (r.mode === "navigate") { // páginas: sempre o app guardado (abre offline e rápido)
    e.respondWith(caches.open(CACHE).then(c => c.match("index.html").then(m => m || fetch(r))));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c => c.match(r, { ignoreSearch: true }).then(m => m || fetch(r).then(res => {
    if (res.ok && res.type === "basic") c.put(r, res.clone()); return res;
  }))));
});
