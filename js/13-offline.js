/* ===== Offline-first: banco do aparelho (IndexedDB), conexão, instalação e atualização =====
 *
 * Armazenamento em duas camadas:
 *  1. localStorage ("mq_ord"): cópia rápida e síncrona, como sempre foi (limite típico ~5 MB).
 *  2. IndexedDB ("milkiq" → "kv" → "db"): banco do aparelho, sem esse limite. Recebe uma cópia
 *     de toda gravação (svS) e é conferido lendo de volta.
 * Se o localStorage encher (fotos, diagramas), svS continua gravando no IndexedDB e o app segue
 * funcionando. Na abertura, bootOffline() escolhe a cópia mais nova (meta.savedAt).
 * Dados ilegíveis no localStorage nunca são sobrescritos automaticamente: o usuário escolhe
 * restaurar a cópia do IndexedDB.
 *
 * Não há servidor/nuvem nesta versão: "sincronização" = backup em arquivo. A estrutura
 * (ids únicos por registro, versão de dados, meta.savedAt) já serve de base para sincronizar depois.
 */
const IDB_NAME = "milkiq" + (typeof MQ_NS != "undefined" && MQ_NS ? "-teste" : "");
const IDBS = { ok: typeof indexedDB != "undefined", ts: null, err: null, copyTs: null, busy: false, persisted: null, est: null };
let idbConn = null, idbNext = null;

function idbOpen() {
  if (idbConn) return Promise.resolve(idbConn);
  return new Promise((res, rej) => {
    let rq; try { rq = indexedDB.open(IDB_NAME, 1); } catch (e) { return rej(e); }
    rq.onupgradeneeded = () => rq.result.createObjectStore("kv");
    rq.onsuccess = () => { idbConn = rq.result; idbConn.onversionchange = () => { idbConn.close(); idbConn = null; }; res(idbConn); };
    rq.onerror = () => rej(rq.error); rq.onblocked = () => rej(Error("banco bloqueado"));
  });
}
function idbTx(mode, fn) {
  return idbOpen().then(db => new Promise((res, rej) => {
    const tx = db.transaction("kv", mode), st = tx.objectStore("kv"); let out;
    const r = fn(st); if (r) r.onsuccess = () => { out = r.result; };
    tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || Error("abortado"));
  }));
}
const idbGet = k => idbTx("readonly", st => st.get(k));
const idbPut = (k, v) => idbTx("readwrite", st => st.put(v, k));

/* Grava uma cópia no IndexedDB (chamado por svS). Coalesce gravações seguidas: só a mais nova vai.
 * Devolve true se o banco do aparelho está disponível (a gravação foi enfileirada). */
function idbMirror(s) {
  if (!IDBS.ok) return false;
  idbNext = s; if (IDBS.busy) return true;
  IDBS.busy = true;
  (async () => {
    while (idbNext !== null) {
      const v = idbNext; idbNext = null;
      try {
        await idbPut("db", v); const back = await idbGet("db");
        if (back !== v) throw Error("conferência falhou");
        IDBS.ts = Date.now(); IDBS.err = null; IDBS.copyTs = IDBS.ts;
      } catch (e) {
        IDBS.err = String(e && e.message || e).slice(0, 80);
        if (SV.mode == "idb") { SV.ok = false; SV.err = "falha no banco do aparelho: " + IDBS.err; try { render(); } catch (x) { } }
      }
    }
    IDBS.busy = false;
  })();
  return true;
}
function idbFlush() { return new Promise(res => { const t = setInterval(() => { if (!IDBS.busy) { clearInterval(t); res(); } }, 20); }); }

/* Abertura: decide entre a cópia do localStorage e a do IndexedDB. */
let IDB_COPY = null; // cópia válida do IndexedDB oferecida quando o localStorage está ilegível
async function bootOffline() {
  if (!IDBS.ok) return;
  let raw = null;
  try { raw = await idbGet("db"); } catch (e) { IDBS.ok = false; IDBS.err = String(e && e.message || e).slice(0, 80); return; }
  let o = null; if (typeof raw == "string") { try { o = JSON.parse(raw); if (!o || typeof o != "object" || Array.isArray(o)) o = null; } catch (e) { o = null; } }
  if (o) { IDBS.copyTs = (o.meta && o.meta.savedAt) || null; o.sessions = Array.isArray(o.sessions) ? o.sessions : []; o.drafts = o.drafts && typeof o.drafts == "object" ? o.drafts : {}; }
  if (CORRUPT !== null) { IDB_COPY = o; return; }                         // usuário decide
  let lsRaw = null; try { lsRaw = localStorage.getItem("mq_ord"); } catch (e) { }
  const lsT = DB.meta && typeof DB.meta.savedAt == "number" ? DB.meta.savedAt : null, idT = o && o.meta && typeof o.meta.savedAt == "number" ? o.meta.savedAt : null;
  if (o && (!lsRaw || (lsT != null && idT != null && idT > lsT))) { DB = o; SV.mode = "idb"; SV.loadedFrom = "idb"; return; }
  if (lsRaw && raw !== lsRaw) idbMirror(lsRaw);                             // mantém o banco do aparelho atualizado
}
/* Botão do aviso de dados ilegíveis: guarda o texto original e restaura a cópia do IndexedDB. */
function restoreFromIdb() {
  if (!IDB_COPY) return note("Não há cópia válida no banco do aparelho.");
  try { localStorage.setItem("mq_corrupt_" + Date.now(), CORRUPT || ""); } catch (e) { }
  DB = IDB_COPY; CORRUPT = null; STORE_OK = true; IDB_COPY = null; initData(); svS();
  go("home"); note("Dados restaurados da cópia do banco do aparelho. O texto ilegível foi guardado à parte.", 1);
}

/* Pede ao navegador para não apagar os dados do app (persistência) e estima o espaço. */
async function storageInfo() {
  try { if (navigator.storage && navigator.storage.persisted) IDBS.persisted = await navigator.storage.persisted(); } catch (e) { }
  try { if (navigator.storage && navigator.storage.estimate) IDBS.est = await navigator.storage.estimate(); } catch (e) { }
}
async function askPersist() {
  try { if (navigator.storage && navigator.storage.persist) IDBS.persisted = await navigator.storage.persist(); } catch (e) { }
  await storageInfo(); try { if (V.v == "backup") render(); } catch (e) { }
}

/* ---------- conexão ---------- */
let ONLINE = typeof navigator == "undefined" || navigator.onLine !== false;
function netChange() { ONLINE = navigator.onLine !== false; try { render(); } catch (e) { } }
function netNotice() {
  return ONLINE ? "" : '<div class="alert in noprint" style="border-color:currentColor"><span style="color:var(--tx)">📴 <b>Sem internet.</b> O MilkIQ continua funcionando: tudo o que você registrar fica salvo neste aparelho.</span></div>';
}
function netChip() {
  const st = SV.ok === false ? ["cr", "Falha ao gravar"] : SV.mode == "idb" ? ["ok", "Salvo no aparelho"] : ["ok", "Salvo no aparelho"];
  return `<span class="chip ${ONLINE ? "ok" : "wa"}">${ONLINE ? "● Online" : "● Offline"}</span> <span class="chip ${st[0]}">${st[1]}</span>`;
}

/* ---------- instalação (PWA) ---------- */
let INSTALL_EVT = null;
const isStandalone = () => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; } };
function installCard() {
  if (isStandalone()) return "";
  if (INSTALL_EVT) return `<div class="card noprint"><div class="top"><span><b>📲 Instalar o MilkIQ neste aparelho</b><br><span class="mu">Abre como aplicativo, em tela cheia, e funciona sem internet.</span></span><button class="btn w" onclick="doInstall()">Instalar</button></div></div>`;
  return "";
}
async function doInstall() { if (!INSTALL_EVT) return; INSTALL_EVT.prompt(); try { await INSTALL_EVT.userChoice; } catch (e) { } INSTALL_EVT = null; render(); }

/* ---------- service worker: cache offline e atualização ---------- */
let SW_WAITING = null;
function swRegister() {
  const m = document.querySelector('meta[name="milkiq-sw"]');
  if (!m || !("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register(m.content, { scope: "./" }).then(reg => {
    const track = w => w && w.addEventListener("statechange", () => { if (w.state == "installed" && navigator.serviceWorker.controller) { SW_WAITING = w; try { render(); } catch (e) { } } });
    if (reg.waiting && navigator.serviceWorker.controller) { SW_WAITING = reg.waiting; render(); }
    reg.addEventListener("updatefound", () => track(reg.installing));
    setInterval(() => reg.update().catch(() => { }), 30 * 60 * 1000);
  }).catch(() => { });
  // recarrega só quando uma versão nova substitui a anterior (não na primeira instalação)
  const had = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!had || reloaded) return; reloaded = true; location.reload(); });
}
function swUpdate() { if (!SW_WAITING) return; try { flushAll(); } catch (e) { } idbFlush().then(() => SW_WAITING.postMessage("skipWaiting")); }
function updateNotice() {
  return SW_WAITING ? '<div class="alert in noprint" style="border-color:currentColor"><span style="color:var(--tx)">🔄 Nova versão do MilkIQ disponível. <button class="btn s" onclick="swUpdate()">Atualizar agora</button> <span class="mu">(seus dados são mantidos)</span></span></div>' : "";
}
const envNotice = () => MQ_ENV == "previa" ? '<div class="alert in noprint" style="border-color:currentColor"><span style="color:var(--tx)">👀 <b>Prévia online.</b> Nesta prévia não há modo offline, impressão nem download de arquivos. Para usar no campo e instalar no celular, abra a versão publicada no GitHub Pages.</span></div>' : MQ_ENV == "teste" ? '<div class="alert wa noprint" style="border-color:currentColor"><span style="color:var(--tx)">🧪 <b>Versão de testes.</b> Dados separados da versão estável. Use para conferir novidades; registros definitivos, na versão estável.</span></div>' : "";

/* Card de estado para a tela Dados. */
function offlineCard() {
  const e = IDBS.est, mb = x => fm(x / 1048576, 1) + " MB";
  return `<div class="card"><b>Funcionamento offline e armazenamento</b><p class="mu">${netChip()}</p><dl class="dl" style="margin-top:8px">
<dt>Banco do aparelho</dt><dd>${IDBS.ok ? (IDBS.err ? `<span class="cr">erro: ${E(IDBS.err)}</span>` : `IndexedDB ativo${IDBS.copyTs ? " · última cópia " + new Date(IDBS.copyTs).toLocaleString("pt-BR") : ""}`) : '<span class="wa">indisponível neste navegador (usando só o localStorage)</span>'}</dd>
<dt>Cópia rápida</dt><dd>${SV.mode == "idb" ? '<span class="wa">cheia — os dados mais novos estão no banco do aparelho</span>' : "localStorage em dia"}</dd>
<dt>Proteção contra limpeza</dt><dd>${IDBS.persisted ? '<span class="ok">ativa (o navegador não apaga os dados sozinho)</span>' : `<span class="wa">não confirmada</span> <button class="btn s" onclick="askPersist()">Ativar</button>`}</dd>
<dt>Espaço usado</dt><dd>${e && e.usage != null ? `${mb(e.usage)} de ~${mb(e.quota)} disponíveis` : "—"}</dd>
<dt>App offline</dt><dd>${navigator.serviceWorker && navigator.serviceWorker.controller ? '<span class="ok">instalado para uso sem internet</span>' : document.querySelector('meta[name="milkiq-sw"]') ? "preparando (abra o app uma vez com internet)" : "disponível na versão publicada"}</dd>
<dt>Nuvem</dt><dd>sem sincronização: os dados ficam neste aparelho. Use o backup para levar para outro aparelho.</dd></dl></div>`;
}

/* Ganchos de rede e instalação (registrados ao carregar este arquivo). */
if (typeof window != "undefined" && window.addEventListener) {
  window.addEventListener("online", netChange); window.addEventListener("offline", netChange);
  window.addEventListener("beforeinstallprompt", ev => { ev.preventDefault(); INSTALL_EVT = ev; try { render(); } catch (e) { } });
  window.addEventListener("appinstalled", () => { INSTALL_EVT = null; try { render(); } catch (e) { } });
}
