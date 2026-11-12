/* ===== Interface: apresentação mais limpa e fácil de usar =====
 * Só muda a apresentação; cálculos, dados e funções continuam os mesmos.
 *  - Dentro de uma fazenda: barra superior fixa (nome da fazenda para trocar, situação) + abas.
 *  - Sem navegação duplicada: some o "← Fazenda" e o nome repetido das telas dos setores.
 *  - Avisos enxutos: o aviso de armazenamento sai das telas (fica em Dados e no selo do topo);
 *    a demonstração vira uma linha curta. Alertas de erro continuam em destaque.
 *  - Resumo da fazenda como painel; setores em blocos com cor própria.
 *  - Formulário de análise recolhido num botão grande (abre direto vindo do "＋ Registrar").
 */
const SCOL = ["#5b6b8c", "#3b6fb6", "#7a55b5", "#b5651d", "#0f7a55", "#c0392b", "#1b8a9c", "#8a6d1e", "#4f6b3a"]; // cor de cada setor (ícone)
const inFarm = () => ["sector", "farm", "kpi", "frel", "gv"].includes(V.v);

/* barra superior da fazenda (celular e computador) */
function appBar() {
  const f = F(), o = overall(allStat(f)), opt = l => l.map(x => `<option value="${x.id}" ${x.id == f.id ? "selected" : ""}>${E(x.name)}</option>`).join("");
  return `<div class="abar"><div class="abar-row"><button class="abar-back" onclick="go('home')" aria-label="Todas as fazendas">‹</button><div class="abar-t"><select class="fsel" aria-label="Trocar de fazenda" onchange="go(V.v=='sector'?'sector':V.v,this.value${V.v == "sector" ? ",V.s" : ""})">${realFarms().length ? `<optgroup label="Minhas fazendas">${opt(realFarms())}</optgroup>` : ""}<optgroup label="Demonstração">${opt(demoFarms())}</optgroup></select><span class="abar-s">${f.demo ? '<span class="demo">DEMO · dados fictícios</span> ' : ""}${badge(o)}${typeof ONLINE != "undefined" && !ONLINE ? ' <span class="chip wa">● Offline</span>' : ""}</span></div></div>${sectorStrip()}</div>`;
}
/* remove a navegação duplicada e os avisos repetidos das telas antigas dos setores */
function tidy(html) {
  return html
    .replace(/<button class="btn s noprint" onclick="go\('farm','[^']*'\)">← [^<]*<\/button>/g, "")
    .replace(/<div class="banner noprint">💾 Salvo neste aparelho[^<]*<\/div>/g, "")
    .replace(/<div class="banner">Os testes desta fazenda são de demonstração[^<]*<\/div>/g, "")
    .replace(/<div class="banner">Registros marcados DEMO são fictícios[^<]*<\/div>/g, "")
    .replace(/<div class="banner">O app não traz limites normativos\.[^<]*<\/div>/g, "")
    .replace(/([>(\s])(\d{4})-(\d{2})-(\d{2})(?=[\s<·,)])/g, "$1$4/$3/$2"); // datas aaaa-mm-dd em texto → dd/mm/aaaa (campos de data não são afetados)
}
render = function () {
  if (!farms.some(x => x.id == V.f)) V.f = (realFarms()[0] || farms[0]).id;
  const m = { home, farm, kpi: kpiv, sector, visit, new: newf, backup: bkv, fdel: farmDelView, gv, frel };
  if (V.v == "backup" && !IDBS.est && typeof storageInfo == "function") storageInfo().then(() => { if (V.v == "backup") render(); });
  const app = $("app"); app.classList.toggle("infarm", inFarm());
  app.innerHTML = printHead() + (inFarm() ? appBar() : "") + statusBar() + tidy((m[V.v] || home)()) + sheet();
  $("nav").innerHTML = bottomNav();
  const sd = $("side"); if (sd) sd.innerHTML = sideNav();
  if (V.v == "sector" && V.s == 5) { calc(); tickT(); }
  const on = document.querySelector(".strip .on"); if (on && on.scrollIntoView) try { on.scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) { }
  drSoon(); uiSave();
};
/* o seletor repetido de fazenda sai das telas (a barra superior troca a fazenda) */
farmSwitch = () => "";

/* ---------- Resumo da fazenda (painel) ---------- */
farm = function () {
  const f = F(), ss = allStat(f), K = fkpi(f), A = falerts(f), act = typeof gvActive == "function" && gvActive(f.id), main = ["CCS", "CBT", "Litros/vaca", "Vacas em lactação"];
  const hero = `<div class="hero"><div class="hero-t"><h1>${E(f.name)} ${f.demo ? '<span class="demo">DEMONSTRAÇÃO</span>' : ""}</h1><p>${f.demo ? "Fazenda de demonstração · dados fictícios" : `${E(f.producer)} · ${E(f.city)}${pos(f.milking) ? ` · ${f.milking} vacas em lactação` : ""}`}</p></div><div class="hero-a">${f.demo ? "" : `<button class="btn w" onclick="gvStart()">${act ? "📋 Continuar visita" : "▶ Iniciar visita"}</button>`}<button class="btn gh w" onclick="go('frel','${f.id}')">🧾 Relatório</button></div></div>`;
  const kp = `<div class="kgrid">${K.filter(k => main.includes(k.lab)).map(k => `<div class="kc"><span class="kl">${E(k.lab)}</span>${k.v == null ? '<span class="kv sd">Sem dados</span>' : `<span class="kv ${k.c || ""}">${E(k.v)}${k.u ? ` <small>${E(k.u)}</small>` : ""}</span>`}<span class="ks">${E(k.src)}</span>${k.sp ? spark(k.sp) : ""}</div>`).join("")}</div><button class="link" onclick="go('kpi','${f.id}')">Ver todos os indicadores e gráficos ›</button>`;
  const al = A.length ? `<div class="alist">${A.slice(0, 3).map(a => `<div class="alert ${a.l}" style="border-color:currentColor" onclick="goTab(${a.s},'${a.tab || ""}','${f.id}'${a.eid ? `,'${a.eid}'` : ""})"><span style="color:var(--tx)">${E(a.t)}</span><span class="go">›</span></div>`).join("")}</div>${A.length > 3 ? `<button class="link" onclick="go('kpi','${f.id}')">Ver os ${A.length} alertas ›</button>` : ""}` : '<div class="card mu">Nenhum alerta com base nos registros.</div>';
  const order = [4, 5, 1, 2, 3, 6, 7, 8, 0];
  const tiles = `<div class="tiles">${order.map(i => `<button class="tile" onclick="go('sector','${f.id}',${i})"><span class="ti" style="background:${SCOL[i]}1f;color:${SCOL[i]}">${SECT[i][0]}</span><span class="tn">${SECT[i][1]}</span>${badge(ss[i])}<span class="tt">${E(ss[i].t)}</span></button>`).join("")}</div>`;
  return hero + `<h2 class="sh2">Indicadores</h2>` + kp + `<h2 class="sh2">Alertas${A.length ? ` <span class="cnt">${A.length}</span>` : ""}</h2>` + al
    + (typeof assistCard == "function" ? `<details class="card fold"><summary><b>🧭 Assistente técnico</b> <span class="mu">fatos, hipóteses e recomendações</span></summary>${assistCard(f, 4).replace(/^<div class="card">/, "<div>")}</details>` : "")
    + `<h2 class="sh2">Setores</h2>` + tiles;
};

/* ---------- Lista de fazendas ---------- */
{ const base = home; home = function () {
  const h = base(), i = h.indexOf("<h2>Fazendas de demonstração</h2>"), j = h.indexOf('<div class="banner">Os dados ficam neste navegador');
  if (i < 0) return h;
  const demo = h.slice(i + "<h2>Fazendas de demonstração</h2>".length, j < 0 ? undefined : j);
  return h.slice(0, i) + `<details class="fold demo-fold" ${realFarms().length ? "" : "open"}><summary><b>Fazendas de demonstração</b> <span class="mu">dados fictícios para conhecer o app</span></summary>${demo}</details>` + (j < 0 ? "" : h.slice(j));
}; }

/* ---------- Formulário de análise recolhido ---------- */
{ const base = qAn; qAn = function () {
  const h = base(), a = h.indexOf('<div class="card"><b>Nova análise</b>'), b = h.indexOf("Salvar análise</button></div>");
  if (a < 0 || b < 0) return h;
  const end = b + "Salvar análise</button></div>".length, filled = Object.entries(AF).some(([k, v]) => !["date", "turno"].includes(k) && String(v || "").trim());
  return h.slice(0, a) + `<details class="card formf" ${V.fo || filled ? "open" : ""}><summary class="btn">＋ Nova análise de leite</summary>${h.slice(a + '<div class="card">'.length, end - "</div>".length)}</details>` + h.slice(end);
}; }
/* vindo do "＋ Registrar", da visita guiada ou de um atalho, o formulário já abre */
{ const base = goTab; goTab = function (s, tab, fid, eid) { V.fo = 1; base(s, tab, fid, eid); V.fo = 0; }; }

/* dentro da fazenda, o subtítulo com o nome da fazenda é repetido (a barra superior já mostra) */
{ const base = farmHead; farmHead = function (f, title, sub) { return base(f, title, inFarm() && title && sub === E(f.name) ? "" : sub); }; }
