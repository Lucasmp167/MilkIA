/* ===== Setor 9: Documentos e relatórios — relatório da visita e plano de ação =====
 * Relatório da visita: junta, num documento só, o que foi registrado na fazenda num período
 * (análises, testes de ordenha, CIP, água, manutenção, medições, auditorias ISO, testes técnicos,
 * visitas) + indicadores e alertas atuais + plano de ação. Nada é inventado: cada seção só
 * aparece se houver registro no período.
 * Plano de ação (DB.pa, dados v6): tarefas com setor, responsável, prazo e situação.
 */
ARR.push("pa"); LAB.pa = "Plano de ação"; DB.pa = DB.pa || [];

const PAF0 = () => ({ desc: "", s: "", resp: "", prazo: "", st: "Aberta", obs: "" });
let PAF = PAF0(), PAE = null;
const paLate = a => a.st != "Concluída" && a.prazo && a.prazo < TD();
function paFromAlert(t, s) { PAF = Object.assign(PAF0(), { desc: String(t).slice(0, 300), s: String(s) }); PAE = null; V.r9v = "pa"; V.note = null; go("sector", V.f, 8); }
function paSave() {
  const o = cp(PAF); o.desc = String(o.desc || "").replace(/[<>]/g, "").trim().slice(0, 500); o.resp = String(o.resp || "").replace(/[<>]/g, "").slice(0, 80); o.obs = String(o.obs || "").replace(/[<>]/g, "").slice(0, 1000);
  if (!o.desc) return note("Descreva a ação.");
  const old = PAE ? DB.pa.find(x => x.id == PAE) : null;
  o.id = old ? old.id : "pa" + Date.now(); o.fid = V.f; o.demo = false; o.date = old ? old.date : TD(); o.done = o.st == "Concluída" ? (old && old.done || TD()) : "";
  if (!upsert("pa", o)) return note(FAIL);
  PAF = PAF0(); PAE = null; note("Ação salva e conferida.", 1);
}
function paSet(id, st) { const o = cp(DB.pa.find(x => x.id == id)); if (!o) return; o.st = st; o.done = st == "Concluída" ? TD() : ""; upsert("pa", o) ? render() : note(FAIL); }
function paEdit(id) { const o = DB.pa.find(x => x.id == id); if (!o) return; PAF = Object.assign(PAF0(), cp(o)); PAE = id; render(); scrollTo(0, 0); }

function r9() {
  const f = F(), t = V.r9v || "vis", TB = [["vis", "Relatório da visita"], ["pa", "Plano de ação"], ["set", "Relatórios por setor"]];
  return `<div class="noprint">${farmHead(f, "📄 Documentos e relatórios", E(f.name))}${demoNote(f)}<div class="tabs">${TB.map(b => `<button class="tb ${t == b[0] ? "on" : ""}" onclick="V.r9v='${b[0]}';V.note=null;render()">${b[1]}</button>`).join("")}</div>${e2note()}</div>`
    + ({ vis: visReport, pa: paView, set: secReports }[t] || visReport)(f);
}
function secReports(f) {
  return `<div class="ctr">${[[4, "🥛 Qualidade do leite", "rl"], [5, "⏱️ Otimização da ordenha", "rl"], [6, "🧼 Limpeza CIP", "rl"], [7, "🛠️ Manutenção", "rl"], [1, "⚙️ Equipamentos (relatório por equipamento)", null], [2, "📏 ISO Check (relatório por auditoria)", "list"], [3, "🔧 Testes técnicos", "lr"]].map(([s, l, tab]) => { const st = sstat(f, s); return `<button class="sec" style="min-height:0" onclick="goTab(${s},${tab ? `'${tab}'` : "null"})"><b>${l}</b>${badge(st.st == "sd" ? st : { st: "in", lab: "Abrir" })}</button>`; }).join("")}</div>`;
}

function paView(f) {
  const l = L("pa").slice().sort((a, b) => (a.st == "Concluída") - (b.st == "Concluída") || String(a.prazo || "9").localeCompare(String(b.prazo || "9")));
  const A = falerts(f).slice(0, 8);
  return (f.demo ? "" : `<div class="card"><b>${PAE ? "Editar ação" : "Nova ação"}</b><label>Ação</label><textarea rows="2" oninput="PAF.desc=this.value">${E(PAF.desc)}</textarea><div class="grid"><div><label>Setor</label><select onchange="PAF.s=this.value"><option value="">Geral</option>${SECT.map((s, i) => `<option value="${i}" ${String(PAF.s) === String(i) ? "selected" : ""}>${i + 1}. ${s[1]}</option>`).join("")}</select></div><div><label>Responsável</label><input value="${E(PAF.resp)}" oninput="PAF.resp=this.value"></div><div><label>Prazo</label><input type="date" value="${E(PAF.prazo)}" oninput="PAF.prazo=this.value"></div><div><label>Situação</label><select onchange="PAF.st=this.value">${["Aberta", "Em andamento", "Concluída"].map(x => `<option ${PAF.st == x ? "selected" : ""}>${x}</option>`).join("")}</select></div></div><label>Observações</label><input value="${E(PAF.obs)}" oninput="PAF.obs=this.value"><br><br><div class="acts"><button class="btn w" onclick="paSave()">${PAE ? "Salvar alterações" : "Adicionar ação"}</button>${PAE ? `<button class="btn gh w" onclick="PAF=PAF0();PAE=null;render()">Cancelar</button>` : ""}</div></div>`)
    + (A.length && !f.demo ? `<div class="card"><b>Criar ação a partir dos alertas</b>${A.map(a => `<p class="mu">${E(a.t)} <button class="btn s" onclick="paFromAlert(${JSON.stringify(a.t).replace(/"/g, "&quot;")},${a.s})">+ ação</button></p>`).join("")}</div>` : "")
    + `<h2>Ações (${l.filter(a => a.st != "Concluída").length} em aberto)</h2>` + (l.map(a => `<div class="card"><div class="top"><b>${E(a.desc)}</b>${a.demo ? '<span class="demo">DEMO</span>' : `<span class="acts"><button class="btn s" onclick="paEdit('${a.id}')">Editar</button><button class="btn s" onclick="qdel('pa','${a.id}')">${V.del == a.id ? "Confirmar" : "Excluir"}</button></span>`}</div><p class="mu">${a.s !== "" && SECT[a.s] ? SECT[a.s][1] + " · " : ""}${a.resp ? "Resp.: " + E(a.resp) + " · " : ""}${a.prazo ? "Prazo " + fmtD(a.prazo) : "sem prazo"} · <span class="${a.st == "Concluída" ? "ok" : paLate(a) ? "cr" : "wa"}">${a.st}${paLate(a) ? " (atrasada)" : ""}${a.done ? " em " + fmtD(a.done) : ""}</span></p>${a.obs ? `<p class="mu">${E(a.obs)}</p>` : ""}${a.demo || a.st == "Concluída" ? "" : `<button class="btn s" onclick="paSet('${a.id}','Concluída')">✔ Concluir</button>`}</div>`).join("") || '<div class="card mu">Nenhuma ação cadastrada.</div>');
}

/* ---------- relatório consolidado da visita ---------- */
function visReport(f) {
  const vs = L("vs").slice().sort((a, b) => a.date < b.date ? 1 : -1), sel = vs.find(v => v.id == V.r9vis);
  const to = V.r9to || (sel ? sel.date : TD()), from = V.r9from || (sel ? DD(sel.date, -30) : DD(TD(), -30)), inP = d => d && d >= from && d <= to;
  const ctl = `<div class="card noprint"><b>Período do relatório</b><div class="grid"><div><label>Visita (opcional)</label><select onchange="V.r9vis=this.value;V.r9from=V.r9to=null;render()"><option value="">— escolher período —</option>${vs.map(v => `<option value="${v.id}" ${V.r9vis == v.id ? "selected" : ""}>${fmtD(v.date)} · ${E(v.tipo)}</option>`).join("")}</select></div><div><label>De</label><input type="date" value="${from}" onchange="V.r9from=this.value;render()"></div><div><label>Até</label><input type="date" value="${to}" onchange="V.r9to=this.value;render()"></div></div><p class="mu">Inclui tudo o que foi registrado nesta fazenda entre as datas. Com uma visita escolhida, o padrão é os 30 dias até a data da visita.</p><button class="btn w" onclick="window.print()">🖨️ Imprimir / salvar em PDF</button></div>`;
  return ctl + withFarm(f.id, () => {
    const sec = [], an = QA().filter(x => inP(x.date)), ss = SS().filter(x => inP(x.date)), cy = CYS().filter(x => inP(x.date)), wa = WAS().filter(x => inP(x.date)), sv = L("sv").filter(x => inP(x.date)), dx = L("dx").filter(x => inP(x.date)), iso = L("iso").filter(x => inP(x.date)), tt = L("tt").filter(x => inP(x.date)), ts = QT().filter(x => inP(x.date)), vv = vs.filter(x => inP(x.date));
    const eqn2 = id => E(eqt(L("eq").find(e => e.id == id)));
    if (vv.length) sec.push(["📝 Visitas", vv.map(v => `<p><b>${fmtD(v.date)} · ${E(v.tipo)}</b><br><span class="mu" style="white-space:pre-wrap">${E(v.notas || "")}</span></p>`).join("")]);
    if (an.length) sec.push(["🥛 Qualidade do leite", `<div class="ov"><table><tr><th>Data</th>${PR.slice(0, 6).map(p => `<th>${p[1]}</th>`).join("")}</tr>${an.map(a => `<tr><td>${fmtD(a.date)}</td>${PR.slice(0, 6).map(p => `<td>${fm(a[p[0]], p[3])}</td>`).join("")}</tr>`).join("")}</table></div>`]);
    if (ts.length) { const h = qhk(f.id).filter(x => inP(x[0])); sec.push(["🐄 Tetos (avaliação manual)", `<p>${ts.length} avaliação(ões)${h.length ? " · escore ≥3: " + h.map(x => fmtD(x[0]) + " " + fm(x[1], 0) + "%").join(", ") : ""}</p>`]); }
    if (ss.length) { const A = agg(ss); sec.push(["⏱️ Ordenha", `<p>${ss.length} teste(s) · ${A.nc} vacas cronometradas · ${fm(A.lv, 1)} L/vaca · ${fm(A.lh, 0)} L/h · preparo–acoplamento ${fm(A.pa, 0)} s · sobreordenha ${fm(A.so, 0)} s</p>`]); }
    if (cy.length || wa.length) { const P = PRODS(), bad = cy.filter(c => cf(c, f, P).out.length); sec.push(["🧼 Limpeza CIP e água", `<p>${cy.length} lavagem(ns)${bad.length ? ` · <b class="wa">${bad.length} com item fora da faixa cadastrada</b>` : ""} · ${wa.length} análise(s) de água</p>${bad.map(c => `<p class="mu">${fmtD(c.date)}: ${cf(c, f, P).out.map(E).join("; ")}</p>`).join("")}`]); }
    if (dx.length) sec.push(["⚙️ Medições de equipamentos", dx.map(d => { const e = L("eq").find(x => x.id == d.eid); if (!e) return ""; const x = evalDx(d, e); return `<p><b>${fmtD(d.date)} · ${eqn2(d.eid)}</b> — ${x.probs.length ? x.probs.map(p => E(p.t)).join("; ") : "sem problemas identificados"}</p>`; }).join("")]);
    if (iso.length) sec.push(["📏 ISO Check", iso.map(a => { const e = L("eq").find(x => x.id == a.eid); if (!e) return ""; const x = evalIso(a, e); return `<p><b>${fmtD(a.date)} · ${eqn2(a.eid)}</b> — ${badge({ st: x.st, lab: x.lab })} ${x.cf} conforme · ${x.nf} fora · ${x.nn} sem referência</p>${x.probs.map(p => `<p class="mu">${E(p.t)}</p>`).join("")}${a.concl ? `<p class="mu">Conclusão: ${E(a.concl)}</p>` : ""}`; }).join("")]);
    if (tt.length) sec.push(["🔧 Testes técnicos", tt.map(t => { const s = t.tipo == "lr" ? lrStats(t) : null; return `<p><b>${fmtD(t.date)} · ${TTT[t.tipo]}${t.tit ? " — " + E(t.tit) : ""}</b>${s ? ` — ${s.n} vacas, média ${fm(s.mean, 0)} mL, máx. ${fm(s.max, 0)} mL${s.r ? `, ${s.out} acima da referência` : ""}` : ""}</p>`; }).join("")]);
    if (sv.length) sec.push(["🛠️ Manutenção", sv.map(s => `<p><b>${fmtD(s.date)} · ${E(s.tipo)} · ${eqn2(s.eid)}</b>${s.prob ? " — " + E(s.prob) : ""}${s.parts.length ? " · peças: " + s.parts.map(p => E(p.n) + " ×" + E(p.q)).join(", ") : ""}</p>`).join("")]);
    const K = fkpi(f).filter(k => k.v != null), A = falerts(f), PA = L("pa").filter(a => a.st != "Concluída" || inP(a.done));
    const ob = (DB.ob[f.id + "_vis"] || {});
    return `<div class="card report"><h1>Relatório da visita técnica</h1>${f.demo ? '<p><span class="demo" style="white-space:normal;display:inline-block">DADOS DE DEMONSTRAÇÃO — fazenda e registros fictícios</span></p>' : ""}
<p><b>${E(f.name)}</b> · ${E(f.producer)} · ${E(f.city)}</p><p class="mu">Período: ${fmtD(from)} a ${fmtD(to)} · emitido em ${new Date().toLocaleString("pt-BR")}</p>
<h2>Indicadores atuais</h2>${K.length ? kpiGrid(K) : '<p class="mu">Sem dados.</p>'}
<h2>Alertas</h2>${A.length ? `<ul>${A.map(a => `<li class="${a.l}"><span style="color:var(--tx)">${E(a.t)}</span></li>`).join("")}</ul>` : '<p class="mu">Nenhum alerta com base nos registros.</p>'}
${sec.length ? sec.map(([h, b]) => `<h2>${h}</h2>${b}`).join("") : '<h2>Registros do período</h2><p class="mu">Nenhum registro nesta fazenda no período escolhido.</p>'}
<h2>Plano de ação</h2>${PA.length ? `<div class="ov"><table><tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Situação</th></tr>${PA.map(a => `<tr><td>${E(a.desc)}</td><td>${E(a.resp || "—")}</td><td>${a.prazo ? fmtD(a.prazo) : "—"}</td><td>${E(a.st)}${paLate(a) ? " (atrasada)" : ""}</td></tr>`).join("")}</table></div>` : '<p class="mu">Nenhuma ação registrada.</p>'}
<h2>Considerações do técnico</h2><textarea class="noprint" rows="4" oninput="rset9('obs',this.value)">${E(ob.obs || "")}</textarea><p style="white-space:pre-wrap">${E(ob.obs || "")}</p>
<p class="mu">Classificações só usam metas definidas pelo usuário e referências técnicas cadastradas e verificadas, com a fonte indicada em cada relatório de setor. Avaliação de tetos é manual (sem IA).</p>
<div class="grid" style="margin-top:28px"><div style="border-top:1px solid var(--tx);padding-top:4px;text-align:center"><input class="noprint" placeholder="Nome do técnico" value="${E(ob.tec || "")}" oninput="rset9('tec',this.value)"><span>${E(ob.tec || "Técnico responsável")}</span></div><div style="border-top:1px solid var(--tx);padding-top:4px;text-align:center"><span>${E(f.producer && f.producer != "—" ? f.producer : "Produtor")}</span></div></div></div>`;
  });
}
function rset9(k, v) { if (F().demo) return; const key = V.f + "_vis", o = DB.ob[key] = DB.ob[key] && typeof DB.ob[key] == "object" ? DB.ob[key] : {}; o[k] = String(v).replace(/[<>]/g, "").slice(0, 4000); svD(); }

/* ---------- dados de demonstração: visitas e plano de ação ---------- */
(() => {
  DM.vs = []; DM.pa = [];
  [["modelo", 0], ["critica", 1]].forEach(([fid, b]) => {
    [[-60, "Rotina de ordenha", b ? "DEMO: preparo curto e sobreordenha no turno da tarde." : "DEMO: rotina adequada; manter treinamento."], [-25, "ISO Check", b ? "DEMO: vácuo acima da faixa fictícia; pulsador 3 com fase d curta." : "DEMO: equipamento dentro das faixas fictícias."], [-3, "Qualidade do leite", b ? "DEMO: CCS elevada; revisar linha de tratamento de mastite." : "DEMO: CCS e CBT dentro das metas."]].forEach(([d, tipo, notas], i) => DM.vs.push({ id: "dvs" + fid + i, fid, demo: true, date: DD(TD(), d), tipo, notas }));
    (b ? [["Ajustar o regulador de vácuo conforme o manual", 1, -5, "Em andamento"], ["Substituir peças do pulsador 3", 7, -10, "Aberta"], ["Treinar ordenhadores no preparo dos tetos", 5, 15, "Aberta"], ["Corrigir a concentração do detergente alcalino", 6, -20, "Concluída"]]
      : [["Manter a rotina de preparo", 5, 30, "Aberta"], ["Revisar teteiras no próximo intervalo", 7, 40, "Aberta"]]).forEach(([desc, s, pz, st], i) => DM.pa.push({ id: "dpa" + fid + i, fid, demo: true, date: DD(TD(), -30), desc: desc + " (demo)", s: String(s), resp: "Responsável DEMO", prazo: DD(TD(), pz), st, obs: "", done: st == "Concluída" ? DD(TD(), -18) : "" }));
  });
})();
