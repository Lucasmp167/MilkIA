/* ===== Setor 3: ISO Check — auditorias técnicas e biblioteca de referências =====
 *
 * Auditoria = conjunto de ensaios em um equipamento (DB.iso, ligado a DB.eq do Setor 2/8).
 * Os ensaios têm só NOME e UNIDADE. Nenhum valor normativo está no código: a avaliação usa a
 * biblioteca de referências (DB.rf), preenchida pelo técnico com norma, item, fonte e marcada
 * como verificada. Sem referência verificada → "Não avaliado".
 *
 * Biblioteca (DB.rf, compartilhada com os Setores 2 e 8):
 *   norma: "ISO 5707" | "ISO 6690" | "GEA" | "Outra"; item: cláusula/página; doc: edição/documento
 *   fab vazio = vale para todas as marcas (ex.: requisito de norma); mod vazio = todos os modelos.
 *   Quando há mais de uma referência aplicável, vale a mais específica (modelo > marca > todas).
 */
ARR.push("iso"); LAB.iso = "Auditorias ISO Check"; DB.iso = DB.iso || [];

/* Ensaios. g: s = estático (sem ordenha), p = por pulsador, d = dinâmico (durante a ordenha).
 * cz: grupo de causas/ações (CAUSE do Setor 2) usado quando o valor sai da referência. */
const ISOT = [
  ["vt", "Vácuo de trabalho (ponto de medição de referência)", "kPa", 1, "s", "vac"],
  ["vrg", "Vácuo junto ao regulador", "kPa", 1, "s", "vac"],
  ["vbp", "Vácuo na bomba de vácuo", "kPa", 1, "s", "vac"],
  ["cb", "Capacidade da bomba de vácuo", "L/min", 0, "s", "res"],
  ["re", "Reserva efetiva", "L/min", 0, "s", "res"],
  ["rm", "Reserva manual", "L/min", 0, "s", "res"],
  ["vzr", "Vazamento do regulador", "L/min", 0, "s", "vz"],
  ["vzs", "Vazamento de ar no sistema", "L/min", 0, "s", "vz"],
  ["sr", "Sensibilidade de regulação", "kPa", 1, "s", "vac"],
  ["dr", "Desvio de regulação", "kPa", 1, "s", "vac"],
  ["ptax", "Taxa de pulsação", "ciclos/min", 0, "p", "tax"],
  ["prel", "Relação de pulsação", "%", 1, "p", "rel"],
  ["pa", "Fase a (abertura)", "ms", 0, "p", "rel"],
  ["pb", "Fase b (aberta)", "ms", 0, "p", "rel"],
  ["pc", "Fase c (fechamento)", "ms", 0, "p", "rel"],
  ["pd", "Fase d (fechada)", "ms", 0, "p", "rel"],
  ["pdif", "Diferença de relação entre lados (alternada)", "%", 1, "p", "rel"],
  ["vmt", "Vácuo médio na ponta do teto (fluxo máximo)", "kPa", 1, "d", "vd"],
  ["vfl", "Flutuação de vácuo na ponta do teto", "kPa", 1, "d", "vd"],
  ["vml", "Queda de vácuo na linha de leite durante a ordenha", "kPa", 1, "d", "vd"],
  ["qdd", "Quedas/deslizamentos de conjuntos no ensaio", "un", 0, "d", "qd"]];
const IT = Object.fromEntries(ISOT.map(t => [t[0], t]));
const ISOG = { s: "Ensaios estáticos (sem ordenha)", p: "Pulsação (por pulsador)", d: "Ensaios dinâmicos (durante a ordenha)" };
const NORMAS = ["ISO 5707", "ISO 6690", "GEA", "Outra"];
/* parâmetros que a biblioteca aceita: os do Setor 2 (MP) + os ensaios ISO */
let ALLPAR = () => MP.map(p => [p[0], p[1], p[2]]).concat(ISOT.map(t => [t[0], t[1], t[2]]));
const parName = k => { const p = ALLPAR().find(x => x[0] == k); return p ? p[1] : k; };

/* Referência aplicável mais específica (substitui a versão do Setor 2: agora aceita norma para todas as marcas). */
refFor = function (par, e, pt) {
  const c = L("rf").filter(r => r.ver && r.par == par && (!r.fab || nrm(r.fab) == nrm(e.fab)) && (!r.mod || (r.fab && nrm(r.mod) == nrm(e.mod))) && (pt ? nrm(r.pt) == nrm(pt) : !r.pt));
  const sc = r => (r.mod ? 2 : 0) + (r.fab ? 1 : 0);
  return c.sort((a, b) => sc(b) - sc(a))[0] || null;
};

/* ---------- avaliação de uma auditoria ---------- */
function evalIso(a, e) {
  const rows = [], probs = [];
  const one = (k, v, who) => {
    const t = IT[k], val = num(v); if (val == null || Number.isNaN(val)) return;
    const r = refFor(k, e, null), j = judge(val, r), row = Object.assign({ k, t, v: val, r, who }, j); rows.push(row);
    if (j.st == "Fora") { const cz = (CAUSE[t[5]] || {})[j.dir] || LOWCHK; probs.push({ g: j.g || "Média", t: `${t[1]}${who ? " — " + who : ""}: ${fm(val, t[3])} ${t[2]}, ${j.dir == "baixo" ? "abaixo do mínimo" : "acima do máximo"} da referência (${rng(r)}; ${r.norma ? r.norma + " · " : ""}${r.fonte})`, c: cz.c, a: cz.a }); }
  };
  ISOT.filter(t => t[4] != "p").forEach(t => one(t[0], (a.v || {})[t[0]]));
  arr1(a.pul).forEach((p, i) => {
    const A = num(p.pa), B = num(p.pb), C = num(p.pc), D = num(p.pd), tot = [A, B, C, D].every(x => x != null && !Number.isNaN(x)) ? A + B + C + D : 0;
    const rel = p.prel !== "" && p.prel != null ? p.prel : tot > 0 ? String(((A + B) / tot * 100).toFixed(1)) : "";
    const who = "pulsador " + (p.n || i + 1);
    ["ptax", "pa", "pb", "pc", "pd", "pdif"].forEach(k => one(k, p[k], who)); one("prel", rel, who);
  });
  probs.sort((x, y) => GR.indexOf(y.g) - GR.indexOf(x.g));
  const cf = rows.filter(x => x.st == "Conforme").length, nf = rows.filter(x => x.st == "Fora").length, nn = rows.filter(x => x.st == "Não avaliado").length;
  const st = probs.some(p => p.g == "Alta") ? "cr" : nf ? "wa" : cf ? "ok" : rows.length ? "na" : "sd";
  return { rows, probs, cf, nf, nn, st, lab: { cr: "Crítico", wa: "Atenção", ok: "Conforme", na: "Sem referência", sd: "Sem valores" }[st] };
}
const isoOf = eid => L("iso").filter(a => a.eid == eid);

/* ---------- estado do formulário ---------- */
const newISO = () => ({ eid: "", date: TD(), tec: "", tipo: "Completa", cond: "", v: {}, pul: [], obs: "", concl: "" });
let ISF = newISO(), ISE = null;
DRF.push({ k: "iso", l: "Auditoria ISO Check (Setor 3)", s: 2, tv: "i3v", tab: "form", get: () => ({ f: ISF, id: ISE }), fresh: () => ({ f: newISO(), id: null }), set: v => { ISF = Object.assign(newISO(), v.f); ISE = DB.iso.some(x => x.id == v.id) ? v.id : null; } });

/* ---------- tela do setor ---------- */
function isov() {
  const f = F(), t = V.i3v || "list", TB = [["list", "Auditorias"], ["form", ISE ? "Editar auditoria" : "Nova auditoria"], ["cmp", "Comparar"], ["ref", "Referências"]];
  if (V.i3 && t == "list") { const a = L("iso").find(x => x.id == V.i3); if (a) return isoDetail(f, a); }
  return farmHead(f, "📏 ISO Check", E(f.name)) + demoNote(f)
    + `<div class="tabs noprint">${TB.filter(b => !(f.demo && b[0] == "form")).map(b => `<button class="tb ${t == b[0] ? "on" : ""}" onclick="V.i3v='${b[0]}';V.i3=null;V.note=null;render()">${b[1]}</button>`).join("")}</div>` + e2note()
    + ({ list: isoList, form: isoForm, cmp: isoCompare, ref: refLib }[t] || isoList)(f);
}
function isoList(f) {
  const es = L("eq"), all = L("iso").slice().reverse();
  if (!es.length) return `<div class="card empty"><div class="big">📏</div><b>Cadastre primeiro uma ordenhadeira</b><p class="mu">A auditoria é feita por equipamento (Setor 2).</p><br><button class="btn w" onclick="goTab(1,'res')">Ir para Ordenhadeiras</button></div>`;
  const nref = L("rf").filter(r => r.ver).length;
  return (f.demo ? "" : `<button class="btn w" onclick="isoNew()">+ Nova auditoria ISO Check</button>`)
    + (nref ? "" : `<div class="banner">Nenhuma referência verificada cadastrada: os ensaios serão registrados como “Não avaliado”. Cadastre os valores da norma ou do fabricante em <b>Referências</b>, com a fonte.</div>`)
    + es.map(e => { const l = isoOf(e.id), la = lastOf(l), ev = la ? evalIso(la, e) : null;
      return `<h2>${E(eqt(e))} ${e.demo ? '<span class="demo">DEMO</span>' : ""}</h2>` + (l.length ? [...l].reverse().map(a => { const x = evalIso(a, e); return `<div class="card tap" onclick="V.i3='${a.id}';render();scrollTo(0,0)"><div class="top"><b>${fmtD(a.date)} · ${E(a.tipo)}</b>${badge({ st: x.st, lab: x.lab })}</div><p class="mu">${x.rows.length} ensaio(s) · ${x.cf} conforme · ${x.nf} fora · ${x.nn} sem referência${a.tec ? " · " + E(a.tec) : ""}</p></div>`; }).join("") : '<div class="card mu">Nenhuma auditoria neste equipamento.</div>'); }).join("")
}
function isoNew(eid) { ISF = newISO(); ISF.eid = eid || (L("eq")[0] || {}).id || ""; ISE = null; V.i3v = "form"; V.i3 = null; V.note = null; render(); scrollTo(0, 0); }
function isoEdit(id) { const a = DB.iso.find(x => x.id == id); if (!a) return note("Auditorias de demonstração não podem ser editadas."); ISF = Object.assign(newISO(), cp(a)); ISE = id; V.i3v = "form"; V.i3 = null; render(); scrollTo(0, 0); }
function isoSetV(k, v) { ISF.v[k] = v; }
function isoAddPul() { ISF.pul.push({ n: String(ISF.pul.length + 1), ptax: "", prel: "", pa: "", pb: "", pc: "", pd: "", pdif: "", obs: "" }); render(); }
function isoForm(f) {
  if (f.demo) return '<div class="card mu">Fazenda de demonstração: não é possível registrar auditorias.</div>';
  const es = L("eq"); if (!es.length) return isoList(f);
  if (!ISF.eid || !es.some(e => e.id == ISF.eid)) ISF.eid = es[0].id;
  const inp = (k, val, on) => `<input inputmode="decimal" value="${E(val == null ? "" : val)}" oninput="${on}">`;
  const grp = g => `<div class="card"><b>${ISOG[g]}</b><div class="grid" style="margin-top:6px">${ISOT.filter(t => t[4] == g).map(t => `<div><label>${t[1]} (${t[2]})</label>${inp(t[0], ISF.v[t[0]], `isoSetV('${t[0]}',this.value)`)}</div>`).join("")}</div></div>`;
  return `<div class="card"><b>${ISE ? "Editar auditoria" : "Nova auditoria"}</b><div class="grid"><div><label>Equipamento</label><select onchange="ISF.eid=this.value">${es.map(e => `<option value="${e.id}" ${ISF.eid == e.id ? "selected" : ""}>${E(eqt(e))}</option>`).join("")}</select></div><div><label>Data</label><input type="date" value="${E(ISF.date)}" oninput="ISF.date=this.value"></div><div><label>Tipo</label><select onchange="ISF.tipo=this.value">${["Completa", "Estática", "Dinâmica", "Pulsação"].map(x => `<option ${ISF.tipo == x ? "selected" : ""}>${x}</option>`).join("")}</select></div><div><label>Técnico responsável</label><input value="${E(ISF.tec)}" oninput="ISF.tec=this.value"></div></div><label>Condições do ensaio (conjuntos em uso, instrumentos, observações)</label><input value="${E(ISF.cond)}" oninput="ISF.cond=this.value"><p class="mu">Preencha só os ensaios realizados; os vazios não entram na avaliação.</p></div>
${grp("s")}
<div class="card"><div class="top"><b>${ISOG.p}</b><button class="btn s" onclick="isoAddPul()">+ Pulsador</button></div>${ISF.pul.map((p, i) => `<div style="border-top:1px solid var(--bd);margin-top:8px;padding-top:6px"><div class="top"><span><label style="margin:0">Identificação</label><input style="max-width:160px" value="${E(p.n)}" oninput="ISF.pul[${i}].n=this.value"></span><button class="btn s" onclick="ISF.pul.splice(${i},1);render()">Remover</button></div><div class="grid">${["ptax", "pa", "pb", "pc", "pd", "prel", "pdif"].map(k => `<div><label>${IT[k][1]} (${IT[k][2]})</label>${inp(k, p[k], `ISF.pul[${i}].${k}=this.value`)}</div>`).join("")}</div></div>`).join("") || '<p class="mu">Nenhum pulsador medido. Toque em “+ Pulsador” para cada pulsador avaliado.</p>'}<p class="mu">Se a relação ficar vazia e as 4 fases forem informadas, ela é calculada: (a+b)/(a+b+c+d).</p></div>
${grp("d")}
<div class="card"><label>Observações</label><textarea rows="2" oninput="ISF.obs=this.value">${E(ISF.obs)}</textarea><label>Conclusão do técnico</label><textarea rows="3" oninput="ISF.concl=this.value">${E(ISF.concl)}</textarea></div>
<div class="acts"><button class="btn w" onclick="isoSave()">${ISE ? "Salvar alterações" : "Salvar auditoria"}</button><button class="btn gh w" onclick="ISF=newISO();ISE=null;V.i3v='list';render()">Cancelar</button></div>`;
}
function isoSave() {
  const a = cp(ISF); if (!a.eid || !L("eq").some(e => e.id == a.eid && !e.demo)) return note("Escolha um equipamento.");
  if (!a.date) return note("Informe a data.");
  const bad = [];
  Object.entries(a.v).forEach(([k, v]) => { const n = num(v); if (Number.isNaN(n) || (n != null && n < 0)) bad.push(IT[k][1]); if (v === "" || v == null) delete a.v[k]; else a.v[k] = String(n); });
  a.pul.forEach(p => ["ptax", "prel", "pa", "pb", "pc", "pd", "pdif"].forEach(k => { const n = num(p[k]); if (Number.isNaN(n) || (n != null && n < 0)) bad.push(IT[k][1] + " (pulsador " + p.n + ")"); else p[k] = n == null ? "" : String(n); }));
  a.pul.forEach(p => { const ph = ["pa", "pb", "pc", "pd"].filter(k => p[k] !== ""); if (ph.length && ph.length < 4) bad.push("fases a–d do pulsador " + p.n + " (informe as 4 ou nenhuma)"); });
  if (a.pul.some(p => num(p.prel) > 100)) bad.push("relação de pulsação acima de 100 %");
  if (bad.length) return note("Valores inválidos: " + bad.join(", ") + ".");
  if (!Object.keys(a.v).length && !a.pul.some(p => ["ptax", "prel", "pa", "pdif"].some(k => p[k] !== ""))) return note("Registre ao menos um ensaio.");
  ["tec", "cond", "obs", "concl"].forEach(k => a[k] = String(a[k] || "").replace(/[<>]/g, "").slice(0, 3000));
  const old = ISE ? DB.iso.find(x => x.id == ISE) : null;
  a.id = old ? old.id : "iso" + Date.now(); a.fid = V.f; a.demo = false; a.created = old && old.created || new Date().toISOString(); a.updated = new Date().toISOString(); if (old && old.sig) a.sig = old.sig;
  if (!upsert("iso", a)) return note(FAIL);
  ISF = newISO(); ISE = null; V.i3v = "list"; V.i3 = a.id; note("Auditoria salva e conferida.", 1);
}
function isoDel(id) { if (V.del != id) { V.del = id; return render(); } V.del = null; const i = DB.iso.findIndex(x => x.id == id), o = DB.iso[i]; if (i < 0) return; DB.iso.splice(i, 1); if (!svS()) { DB.iso.splice(i, 0, o); return note(FAIL); } V.i3 = null; note("Auditoria excluída.", 1); }
function isoSig(id) { const a = DB.iso.find(x => x.id == id); if (!a) return; const d = $("sg").toDataURL("image/png"), p = a.sig; a.sig = d; if (svS()) note("Assinatura salva e conferida.", 1); else { a.sig = p; note(FAIL); } }

/* ---------- detalhe / relatório de uma auditoria ---------- */
function isoTable(rows, withWho) {
  if (!rows.length) return '<p class="mu">Nenhum ensaio.</p>';
  return `<div class="ov"><table><tr>${withWho ? "<th>Pulsador</th>" : ""}<th>Ensaio</th><th>Valor</th><th>Referência</th><th>Situação</th></tr>${rows.map(x => `<tr>${withWho ? `<td>${E(x.who.replace("pulsador ", ""))}</td>` : ""}<td>${x.t[1]}</td><td>${fm(x.v, x.t[3])} ${x.t[2]}</td><td>${x.r ? `${E(rng(x.r))}<br><span class="mu">${E([x.r.norma, x.r.item].filter(Boolean).join(" · "))}${x.r.norma || x.r.item ? " · " : ""}${E(x.r.fonte)}</span>` : '<span class="mu">sem referência verificada</span>'}</td><td class="${x.st == "Fora" ? (x.g == "Alta" ? "cr" : "wa") : x.st == "Conforme" ? "ok" : "na"}">${x.st}${x.g ? " (" + x.g + ")" : ""}</td></tr>`).join("")}</table></div>`;
}
/* Pulsação em matriz: uma linha por pulsador, uma coluna por ensaio; a cor mostra a situação. */
function isoPulTable(rows) {
  const ks = ["ptax", "prel", "pa", "pb", "pc", "pd", "pdif"].filter(k => rows.some(r => r.k == k)), who = [...new Set(rows.map(r => r.who))];
  const cell = r => !r ? "<td>—</td>" : `<td class="${r.st == "Fora" ? (r.g == "Alta" ? "cr" : "wa") : r.st == "Conforme" ? "ok" : ""}" title="${E(r.t[1] + ": " + r.st + (r.r ? " · ref. " + rng(r.r) + " · " + r.r.fonte : ""))}">${fm(r.v, r.t[3])}${r.st == "Fora" ? " ⚠" : r.st == "Conforme" ? " ✔" : ""}</td>`;
  const refs = ks.map(k => { const r = rows.find(x => x.k == k && x.r); return r ? `${IT[k][1]}: ${rng(r.r)} (${[r.r.norma, r.r.fonte].filter(Boolean).join(" · ")})` : null; }).filter(Boolean);
  return `<div class="ov"><table><tr><th>Pulsador</th>${ks.map(k => `<th>${{ ptax: "Taxa", prel: "Relação", pa: "a", pb: "b", pc: "c", pd: "d", pdif: "Dif. lados" }[k]}<br><span class="mu">${IT[k][2]}</span></th>`).join("")}</tr>${who.map(w => `<tr><td>${E(w.replace("pulsador ", ""))}</td>${ks.map(k => cell(rows.find(r => r.who == w && r.k == k))).join("")}</tr>`).join("")}</table></div><p class="mu">✔ conforme · ⚠ fora da referência · sem símbolo = sem referência verificada.${refs.length ? " Referências: " + refs.map(E).join("; ") + "." : ""}</p>`;
}
function isoDetail(f, a) {
  const e = L("eq").find(x => x.id == a.eid) || { fab: "?", mod: "(equipamento excluído)", id: a.eid }, x = evalIso(a, e);
  const prev = isoOf(a.eid).filter(y => y.date < a.date || (y.date == a.date && y.id < a.id)).pop(), px = prev ? evalIso(prev, e) : null;
  const used = [...new Set(x.rows.filter(r => r.r).map(r => r.r))];
  const cmp = prev ? `<h2>Comparação com a auditoria anterior (${fmtD(prev.date)})</h2>${isoCmpTable(prev, a, e)}` : '<p class="mu">Primeira auditoria deste equipamento: sem comparação.</p>';
  return `<div class="pagehead noprint"><div><div class="crumb"><button onclick="go('farm','${f.id}')">${E(f.name)}</button> › <button onclick="V.i3=null;render()">ISO Check</button></div></div><div class="acts">${a.demo ? "" : `<button class="btn s" onclick="isoEdit('${a.id}')">Editar</button><button class="btn s" onclick="isoDel('${a.id}')">${V.del == a.id ? "Confirmar exclusão" : "Excluir"}</button>`}<button class="btn s" onclick="window.print()">Imprimir / PDF</button></div></div>` + e2note()
    + `<div class="card report"><h1>Relatório ISO Check</h1>${a.demo ? '<p><span class="demo" style="white-space:normal;display:inline-block">DADOS DE DEMONSTRAÇÃO — ensaios e referências fictícios, não é uma auditoria real</span></p>' : ""}
<p><b>${E(f.name)}</b> · ${E(f.producer)} · ${E(f.city)}</p><p>${E(eqt(e))} · ${E(e.tipo || "")} ${e.nc ? "· " + E(e.nc) + " conjuntos" : ""}</p><p class="mu">Auditoria ${E(a.tipo)} em ${fmtD(a.date)}${a.tec ? " · técnico: " + E(a.tec) : ""}${a.cond ? " · " + E(a.cond) : ""}</p>
<p>${badge({ st: x.st, lab: x.lab })} <span class="mu">${x.rows.length} ensaio(s) · ${x.cf} conforme · ${x.nf} fora da referência · ${x.nn} sem referência verificada</span></p>
${["s", "d"].map(g => { const r = x.rows.filter(y => y.t[4] == g); return r.length ? `<h2>${ISOG[g]}</h2>${isoTable(r)}` : ""; }).join("")}
${x.rows.some(y => y.t[4] == "p") ? `<h2>${ISOG.p}</h2>${isoPulTable(x.rows.filter(y => y.t[4] == "p"))}` : ""}
<h2>Problemas, causas possíveis e ações</h2>${probList(x.probs)}
${cmp}
<h2>Referências utilizadas</h2>${used.length ? `<ul>${used.map(r => `<li>${E(parName(r.par))}: ${E(rng(r))} · ${E([r.norma, r.item, r.doc].filter(Boolean).join(" · "))} · ${r.fab ? E(r.fab) + " " + E(r.mod || "") : "todas as marcas"} · fonte: ${E(r.fonte)} · verificada</li>`).join("")}</ul>` : '<p class="mu">Nenhuma referência verificada aplicada: todos os ensaios aparecem como “Não avaliado”.</p>'}
${a.obs ? `<h2>Observações</h2><p style="white-space:pre-wrap">${E(a.obs)}</p>` : ""}<h2>Conclusão do técnico</h2><p style="white-space:pre-wrap">${E(a.concl || "—")}</p>
<p class="mu">O MilkIQ não contém valores das normas ISO nem especificações GEA: a classificação usa apenas as referências cadastradas e verificadas pelo técnico, com a fonte indicada.</p>
${a.sig ? `<img src="${a.sig}" alt="Assinatura" style="max-width:100%;height:80px">` : ""}<p>${E(a.tec || "")}</p>
${a.demo ? "" : `<div class="noprint"><canvas id="sg" width="300" height="100" style="border:1px solid var(--bd);border-radius:8px;touch-action:none;width:100%;background:#fff" onpointerdown="sgd(event)" onpointermove="sgm(event)" onpointerup="sgu()" onpointerleave="sgu()"></canvas><div class="grid"><button class="btn s" style="width:100%" onclick="$('sg').getContext('2d').clearRect(0,0,300,100)">Limpar</button><button class="btn s" style="width:100%" onclick="isoSig('${a.id}')">Salvar assinatura</button></div></div>`}</div>`;
}
/* valores por ensaio (média dos pulsadores para ensaios por pulsador) */
function isoVals(a, e) { const o = {}; evalIso(a, e).rows.forEach(r => (o[r.k] = o[r.k] || []).push(r)); return o; }
function isoCmpTable(A, B, e) {
  const va = isoVals(A, e), vb = isoVals(B, e), keys = ISOT.map(t => t[0]).filter(k => va[k] || vb[k]);
  if (!keys.length) return '<p class="mu">Sem ensaios em comum.</p>';
  const m = l => l ? l.reduce((s, r) => s + r.v, 0) / l.length : null, st = l => l ? (l.some(r => r.st == "Fora") ? "Fora" : l.every(r => r.st == "Conforme") ? "Conforme" : "Não avaliado") : "";
  return `<div class="ov"><table><tr><th>Ensaio</th><th>${fmtD(A.date)}</th><th>${fmtD(B.date)}</th><th>Δ</th></tr>${keys.map(k => { const t = IT[k], a = m(va[k]), b = m(vb[k]); return `<tr><td>${t[1]}${t[4] == "p" ? " <span class='mu'>(média)</span>" : ""}</td><td>${a == null ? "—" : fm(a, t[3]) + " " + t[2]}<br><span class="mu">${st(va[k])}</span></td><td>${b == null ? "—" : fm(b, t[3]) + " " + t[2]}<br><span class="mu">${st(vb[k])}</span></td><td>${dl(a, b, t[3])}</td></tr>`; }).join("")}</table></div><p class="mu">Δ = segunda − primeira. Mudanças podem refletir desgaste, ajustes ou condições diferentes de ensaio.</p>`;
}
function isoCompare(f) {
  const all = L("iso"); if (all.length < 2) return '<div class="card mu">São necessárias ao menos duas auditorias para comparar.</div>';
  const ia = V.i3a && all.some(x => x.id == V.i3a) ? V.i3a : all[all.length - 2].id, ib = V.i3b && all.some(x => x.id == V.i3b) ? V.i3b : all[all.length - 1].id;
  const A = all.find(x => x.id == ia), B = all.find(x => x.id == ib), e = L("eq").find(x => x.id == B.eid) || {};
  const op = s => all.map(x => `<option value="${x.id}" ${x.id == s ? "selected" : ""}>${fmtD(x.date)} · ${E(eqt(L("eq").find(y => y.id == x.eid)))}</option>`).join("");
  return `<div class="card"><div class="grid"><div><label>Auditoria A</label><select onchange="V.i3a=this.value;render()">${op(ia)}</select></div><div><label>Auditoria B</label><select onchange="V.i3b=this.value;render()">${op(ib)}</select></div></div>${A.eid != B.eid ? '<p class="wa">Atenção: auditorias de equipamentos diferentes.</p>' : ""}</div><div class="card">${isoCmpTable(A, B, e)}</div>`;
}

/* ---------- biblioteca de referências (Setores 2, 3 e 8) ---------- */
const newRF = () => Object.assign(NEW.rf(), { norma: "ISO 5707", item: "", fab: "" });
chkRf = o => !String(o.fonte || "").trim() ? "Informe a fonte (norma, manual ou boletim)." : (o.norma == "GEA" && !String(o.fab || "").trim()) ? "Referência GEA: informe o fabricante (GEA)." : num(o.min) == null && num(o.max) == null ? "Informe mínimo e/ou máximo." : nneg(o, ["min", "max"]) || (num(o.min) != null && num(o.max) != null && num(o.min) > num(o.max) ? "Mínimo maior que máximo." : null) || (o.mod && !o.fab ? "Para restringir a um modelo, informe também o fabricante." : null);
function refLib(f) {
  const R = "rf", rf = L("rf"), fl = V.rfn || "", lst = rf.filter(r => !fl || (r.norma || "Outra") == fl);
  if (!FS.rf || FS.rf.norma == null) FS.rf = Object.assign(newRF(), FS.rf || {});
  return (f.demo ? "" : `<div class="card"><b>${FE.rf ? "Editar referência" : "Nova referência técnica"}</b>
<div class="grid"><div><label>Norma / origem</label><select onchange="FS.rf.norma=this.value;if(this.value=='GEA'&&!FS.rf.fab)FS.rf.fab='GEA';render()">${NORMAS.map(n => `<option ${FS.rf.norma == n ? "selected" : ""}>${n}</option>`).join("")}</select></div>${fld(R, "item", "Item / cláusula / página")}
<div style="grid-column:1/-1"><label>Ensaio ou parâmetro</label><select onchange="FS.rf.par=this.value">${ALLPAR().map(p => `<option value="${p[0]}" ${FS.rf.par == p[0] ? "selected" : ""}>${p[1]} (${p[2]})</option>`).join("")}</select></div>
${fld(R, "min", "Mínimo", "n")}${fld(R, "max", "Máximo", "n")}${fld(R, "un", "Unidade")}${fld(R, "grav", "Gravidade se fora", "sel", GR)}
${fld(R, "fab", "Fabricante (vazio = todas as marcas)")}${fld(R, "mod", "Modelo (vazio = todos)")}<div style="grid-column:1/-1"><label>Ponto da instalação</label><select onchange="FS.rf.pt=this.value"><option value="">Medição geral / ensaio</option>${PTS.map(p => `<option ${FS.rf.pt == p ? "selected" : ""}>${p}</option>`).join("")}</select></div></div>
${fld(R, "fonte", "Fonte (obrigatória: título da norma, manual ou boletim)")}${fld(R, "doc", "Edição / documento (ex.: ano da edição, revisão do manual)")}
${fld(R, "ver", "Conferi o valor no documento original (referência verificada)", "chk")}<br><div class="acts"><button class="btn w" onclick="gs('rf',chkRf,null,()=>{FS.rf=newRF()})">${FE.rf ? "Salvar alterações" : "Salvar referência"}</button>${FE.rf ? `<button class="btn gh w" onclick="FE.rf=null;FS.rf=newRF();render()">Cancelar</button>` : ""}</div>
<p class="mu">O MilkIQ <b>não traz valores das normas ISO nem especificações GEA</b>. Digite os valores do documento original e marque como verificada; referências não verificadas ficam guardadas, mas não classificam medições.</p></div>`)
    + `<h2>Biblioteca (${rf.length})</h2><div class="tabs">${["", ...NORMAS].map(n => `<button class="tb ${fl == n ? "on" : ""}" onclick="V.rfn='${n}';render()">${n || "Todas"} (${rf.filter(r => !n || (r.norma || "Outra") == n).length})</button>`).join("")}</div>`
    + (lst.map(r => `<div class="card"><div class="top"><b>${E(parName(r.par))}${r.pt ? " · " + E(r.pt) : ""}</b>${xbtn("rf", r, 1)}</div><p class="mu"><span class="badge in">${E(r.norma || "Outra")}</span> ${E(rng(r))} · <span class="${r.ver ? "ok" : "wa"}">${r.ver ? "verificada" : "NÃO verificada (não usada)"}</span> · gravidade ${E(r.grav)}</p><p class="mu">${r.fab ? E(r.fab) + " " + (E(r.mod) || "(todos os modelos)") : "Todas as marcas"}${r.item ? " · item " + E(r.item) : ""} · Fonte: ${E(r.fonte)}${r.doc ? " · " + E(r.doc) : ""}</p></div>`).join("") || '<div class="card mu">Nenhuma referência nesta categoria: os ensaios correspondentes aparecem como “Não avaliado”.</div>');
}
/* O Setor 2 passa a usar a mesma biblioteca completa. */
eqRefs = refLib;

/* ---------- dados de demonstração (fictícios, marcados DEMO) ---------- */
(() => {
  const mk = (fid, b) => {
    let r = b ? 41 : 17; const q = () => (r = (r * 9301 + 49297) % 233280) / 233280, n = x => (q() - .5) * 2 * x, S = (x, d = 1) => String(+x.toFixed(d));
    const es = DM.eq.filter(e => e.fid == fid);
    es.forEach((e, j) => {
      [["vt", 44, 50], ["re", 400, null], ["vzr", null, 40], ["ptax", 55, 65], ["prel", 55, 70], ["vfl", null, 8]].forEach(([k, lo, hi], i) => DM.rf.push({ id: "drfi" + e.id + i, fid, demo: true, fab: e.fab, mod: e.mod, par: k, min: lo == null ? "" : String(lo), max: hi == null ? "" : String(hi), un: IT[k][2], fonte: "DEMO (valor fictício, não é norma)", norma: k[0] == "p" ? "ISO 6690" : "ISO 5707", item: "DEMO", ver: true, grav: k == "vt" || k == "vfl" ? "Alta" : "Média" }));
      for (let i = 0; i < 3; i++) {
        const bad = b && i > 0, v = { vt: S(bad ? 51 + n(.8) : 47 + n(.6)), vrg: S(bad ? 52 + n(.5) : 47.5 + n(.4)), re: S(bad ? 300 + n(40) : 560 + n(30), 0), rm: S(bad ? 420 + n(30) : 700 + n(30), 0), vzr: S(bad ? 65 + n(8) : 18 + n(5), 0), vmt: S(bad ? 41 + n(1) : 37 + n(1)), vfl: S(bad ? 11 + n(1.5) : 5 + n(1)), vml: S(bad ? 4 + n(.6) : 1.6 + n(.3)), qdd: String(bad ? 4 + Math.round(q() * 2) : Math.round(q())) };
        const pul = [1, 2, 3, 4].map(p => ({ n: String(p), ptax: S(60 + n(bad && p == 3 ? 6 : 1), 0), pa: S(bad && p == 3 ? 220 : 150 + n(10), 0), pb: S(450 + n(15), 0), pc: S(bad && p == 3 ? 200 : 150 + n(10), 0), pd: S(bad && p == 3 ? 130 : 250 + n(10), 0), prel: "", pdif: S(bad ? 6 + n(2) : 1.5 + n(.5)), obs: "" }));
        DM.iso = DM.iso || []; DM.iso.push({ id: "diso" + e.id + i, fid, demo: true, eid: e.id, date: DD(TD(), -120 + i * 55), tec: "Técnico DEMO", tipo: "Completa", cond: "DEMO", v, pul, obs: "", concl: bad ? "DEMO: vácuo e reserva fora da faixa fictícia; revisar regulador e pulsador 3." : "DEMO: ensaios dentro da faixa fictícia." });
      }
    });
  };
  DM.iso = DM.iso || []; mk("modelo", 0); mk("critica", 1);
})();
