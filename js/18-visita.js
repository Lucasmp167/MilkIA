/* ===== Visita guiada: o técnico percorre a fazenda em etapas, num fluxo só =====
 * A visita é um registro comum de DB.vs (o mesmo das visitas rápidas), com campos a mais:
 *   gst: "andamento" | "concluída", steps: { k: { st, obs } }, obj, tec, ini, fim.
 * Cada etapa mostra a situação do setor e os registros feitos no dia, abre o formulário do setor
 * com um toque e, enquanto a visita estiver aberta, uma barra no topo leva de volta à visita.
 * Ao concluir, o relatório da visita (Setor 9) já abre com esta visita e as notas de cada etapa.
 */
const GV = [
  { k: "q", n: "Qualidade do leite", ic: "🥛", s: 4, tab: "an", col: ["an"], acts: [["+ Análise", "goTab(4,'an')"], ["Importar laudo", "goTab(4,'an');V.imp=1;render()"]] },
  { k: "r", n: "Rotina de ordenha", ic: "⏱️", s: 5, tab: "cro", col: ["sessions"], acts: [["+ Teste cronometrado", "goTab(5,'cro')"], ["Diagnóstico", "goTab(5,'dia')"]] },
  { k: "e", n: "Equipamento", ic: "⚙️", s: 1, tab: "med", col: ["dx"], acts: [["+ Medição", "regEq()"]] },
  { k: "i", n: "ISO Check", ic: "📏", s: 2, tab: "form", col: ["iso"], acts: [["+ Auditoria", "go('sector',V.f,2);isoNew()"]] },
  { k: "t", n: "Tetos e leite residual", ic: "🐄", s: 4, tab: "te", col: ["ts", "tt"], acts: [["+ Avaliação de tetos", "goTab(4,'te')"], ["+ Leite residual", "go('sector',V.f,3);ttNew('lr')"]] },
  { k: "c", n: "Limpeza CIP e água", ic: "🧼", s: 6, tab: "cy", col: ["cy", "wa"], acts: [["+ Lavagem", "goTab(6,'cy')"], ["+ Água", "goTab(6,'wa')"]] },
  { k: "m", n: "Manutenção", ic: "🛠️", s: 7, tab: "mt", col: ["sv"], acts: [["+ Serviço", "goTab(7,'mt')"]] },
  { k: "p", n: "Plano de ação", ic: "✅", s: 8, tab: "pa", col: ["pa"], acts: [["Abrir plano", "V.r9v='pa';go('sector',V.f,8)"]] }];
const GVST = ["Pendente", "Concluída", "Não se aplica"];
function gvActive(fid) { return DB.vs.find(v => v.fid == (fid || V.f) && v.gst == "andamento"); }

function gvStart() {
  const f = F(); if (f.demo) return note("Fazenda de demonstração: a visita guiada fica disponível nas suas fazendas.");
  const a = gvActive(); if (a) { V.gv = a.id; return go("gv"); }
  const v = { id: "v" + Date.now(), fid: f.id, demo: false, date: TD(), tipo: "Visita completa", notas: "", created: Date.now(), gst: "andamento", ini: new Date().toISOString(), steps: {}, obj: "", tec: "" };
  if (!upsert("vs", v)) return note(FAIL);
  V.gv = v.id; V.gvs = 0; go("gv");
}
function gvSet(k, f2, val) { const v = DB.vs.find(x => x.id == V.gv); if (!v) return; v.steps = v.steps || {}; const o = v.steps[k] = v.steps[k] || { st: "Pendente", obs: "" }; o[f2] = String(val).replace(/[<>]/g, "").slice(0, 2000); svD(); }
function gvField(k, val) { const v = DB.vs.find(x => x.id == V.gv); if (!v) return; v[k] = String(val).replace(/[<>]/g, "").slice(0, 2000); svD(); }
function gvFinish() {
  const v = DB.vs.find(x => x.id == V.gv); if (!v) return;
  const pend = GV.filter(s => ((v.steps || {})[s.k] || {}).st != "Concluída" && ((v.steps || {})[s.k] || {}).st != "Não se aplica");
  if (pend.length && V.gvForce != v.id) { V.gvForce = v.id; return note(`Ainda há ${pend.length} etapa(s) pendente(s): ${pend.map(s => s.n).join(", ")}. Toque de novo em “Concluir visita” para concluir assim mesmo.`); }
  v.gst = "concluída"; v.fim = new Date().toISOString();
  v.notas = [v.obj ? "Objetivo: " + v.obj : "", ...GV.map(s => { const o = (v.steps || {})[s.k]; return o && (o.obs || o.st != "Pendente") ? `${s.n}: ${o.st}${o.obs ? " — " + o.obs : ""}` : ""; })].filter(Boolean).join("\n");
  if (!svS()) { v.gst = "andamento"; return note(FAIL); }
  V.gvForce = null; V.r9v = "vis"; V.r9vis = v.id; V.r9from = V.r9to = null; V.gv = null;
  go("sector", v.fid, 8); note("Visita concluída. O relatório abaixo já traz os registros e as notas de cada etapa.", 1);
}
/* registros feitos na data da visita, por etapa */
function gvCount(st, date) { return withFarm(V.f, () => st.col.reduce((a, k) => a + L(k).filter(x => (x.date || "").slice(0, 10) == date).length, 0)); }

function gv() {
  const f = F(), v = DB.vs.find(x => x.id == V.gv && x.fid == f.id) || gvActive();
  if (!v) return farmHead(f, "📋 Visita guiada") + `<div class="card empty"><div class="big">📋</div><b>Nenhuma visita em andamento</b><p class="mu">A visita guiada percorre qualidade, rotina, equipamento, ISO Check, tetos, limpeza, manutenção e plano de ação, e no fim gera o relatório.</p><br><button class="btn w" onclick="gvStart()">▶ Iniciar visita</button></div>`;
  V.gv = v.id; const i = Math.max(0, Math.min(GV.length, V.gvs || 0)), steps = v.steps || {}, done = GV.filter(s => (steps[s.k] || {}).st && steps[s.k].st != "Pendente").length;
  const chips = `<div class="tabs noprint">${GV.map((s, j) => { const st = (steps[s.k] || {}).st || "Pendente"; return `<button class="tb ${i == j ? "on" : ""}" onclick="V.gvs=${j};render()">${st == "Concluída" ? "✔" : st == "Não se aplica" ? "–" : s.ic} ${s.n}</button>`; }).join("")}<button class="tb ${i == GV.length ? "on" : ""}" onclick="V.gvs=${GV.length};render()">🏁 Concluir</button></div>`;
  let body;
  if (i == GV.length) {
    body = `<div class="card"><b>Concluir a visita</b><p class="mu">${done} de ${GV.length} etapas avaliadas.</p><ul>${GV.map(s => { const o = steps[s.k] || {}; return `<li><b>${s.n}:</b> ${E(o.st || "Pendente")}${o.obs ? " — " + E(o.obs) : ""}</li>`; }).join("")}</ul><label>Técnico responsável</label><input value="${E(v.tec || "")}" oninput="gvField('tec',this.value)"><br><br><button class="btn w" onclick="gvFinish()">🏁 Concluir visita e gerar relatório</button></div>${typeof assistCard == "function" ? assistCard(f, 6) : ""}`;
  } else {
    const s = GV[i], o = steps[s.k] || { st: "Pendente", obs: "" }, st = sstat(f, s.s), n = gvCount(s, v.date);
    body = `<div class="card"><div class="top"><b style="font-size:18px">${s.ic} ${s.n}</b>${badge(st)}</div><p class="mu">${E(st.t)}</p><p class="mu">${n} registro(s) nesta etapa em ${fmtD(v.date)}.</p>
<div class="acts" style="margin:10px 0">${s.acts.map(a => `<button class="btn w" onclick="${a[1]}">${a[0]}</button>`).join("")}<button class="btn gh w" onclick="go('sector',V.f,${s.s})">Abrir setor</button></div>
<label>Situação da etapa</label><div class="acts">${GVST.map(x => `<button class="btn ${o.st == x ? "" : "gh"} w" onclick="gvSet('${s.k}','st','${x}');render()">${x == "Concluída" ? "✔ " : ""}${x}</button>`).join("")}</div>
<label>Observações da etapa</label><textarea rows="3" oninput="gvSet('${s.k}','obs',this.value)">${E(o.obs || "")}</textarea></div>
<div class="acts"><button class="btn gh w" ${i == 0 ? "disabled" : ""} onclick="V.gvs=${i - 1};render();scrollTo(0,0)">← Anterior</button><button class="btn w" onclick="${o.st == "Pendente" ? `gvSet('${s.k}','st','Concluída');` : ""}V.gvs=${i + 1};render();scrollTo(0,0)">${o.st == "Pendente" ? "Concluir etapa e avançar →" : "Próxima →"}</button></div>`;
  }
  return farmHead(f, "📋 Visita guiada", `${fmtD(v.date)} · ${done}/${GV.length} etapas`) + `<div class="card"><label style="margin-top:0">Objetivo da visita</label><input value="${E(v.obj || "")}" placeholder="ex.: CCS alta no último mês" oninput="gvField('obj',this.value)"></div>` + chips + body;
}
/* barra no topo enquanto há visita guiada aberta e o técnico está em outra tela */
function gvBar() {
  if (V.v == "gv") return ""; const v = gvActive(); if (!v) return "";
  const i = Math.min(V.gvs || 0, GV.length), s = GV[i];
  return `<div class="alert in noprint tap" style="border-color:currentColor" onclick="V.gv='${v.id}';go('gv')"><span style="color:var(--tx)">📋 <b>Visita em andamento</b>${s ? " · etapa: " + s.n : ""} — <u>voltar à visita</u></span></div>`;
}
