/* MilkIQ — service worker (gerado por tools/build-site.js; não editar o sw.js publicado).
 * Guarda todos os arquivos do app no aparelho para funcionar sem internet.
 * Uma nova versão só assume quando o usuário toca em "Atualizar agora" (mensagem skipWaiting). */
const VERSION = "152ed6447b4d", ENV = "teste", CACHE = "milkiq-" + ENV + "-" + VERSION, FILES = ["./","index.html","css/app.css","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","js/00-ambiente.js","js/01-base.js","js/02-armazenamento.js","js/03-setor6-ordenha.js","js/04-setor5-qualidade.js","js/05-setor7-cip.js","js/06-setor8-manutencao.js","js/07-dados-e-fazendas.js","js/08-backup.js","js/10-central.js","js/11-fazendas.js","js/12-equipamentos.js","js/13-offline.js","js/14-iso.js","js/15-testes.js","js/16-relatorios.js","js/17-ordenha.js","js/18-visita.js","js/19-importar.js","js/20-fases.js","js/21-relfazenda.js","js/22-interface.js","js/23-filtros.js","js/24-relatorios.js","js/25-cronometragem.js","js/99-inicio.js","manifest.webmanifest"];
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
