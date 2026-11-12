/* ===== Setor 4: Testes técnicos — leite residual, testes de campo e relatórios externos =====
 * Coleção DB.tt (dados v5). Tipos:
 *  - "lr"   leite residual: volume por vaca (opcionalmente por quarto) após a retirada do conjunto;
 *  - "campo" teste de campo livre: medições com nome/valor/unidade, observações e conclusão;
 *  - "ext"  relatório externo (ex.: relatório impresso de um analisador como o PT6): arquivo anexado
 *           + valores principais digitados, para comparar relatórios entre datas.
 * Leite residual só é classificado com referência verificada na biblioteca (parâmetro "lr").
 */
ARR.push("tt"); LAB.tt = "Testes técnicos"; DB.tt = DB.tt || [];
const TTP = [["lr", "Leite residual por vaca", "mL", 0], ["lrq", "Leite residual por quarto", "mL", 0]];
{ const base = ALLPAR; ALLPAR = () => base().concat(TTP.map(t => [t[0], t[1], t[2]])); }
const TTT = { lr: "Leite residual", campo: "Teste de campo", ext: "Relatório externo" };
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const NOEQ = { fab: "", mod: "" };

const newTT = tipo => ({ tipo: tipo || "lr", date: TD(), eid: "", tit: "", lote: "", met: "", milker: "", rows: [], obs: "", concl: "", file: null });
let TTF = newTT(), TTE = null, TTR = { a: "", q: "", v: "", u: "" };
DRF.push({ k: "tt", l: "Teste técnico (Setor 4)", s: 3, tv: "t4v", tab: "form", get: () => ({ f: Object.assign({}, TTF, { file: null }), id: TTE }), fresh: () => ({ f: newTT(TTF.tipo), id: null }), set: v => { TTF = Object.assign(newTT(), v.f); TTE = DB.tt.some(x => x.id == v.id) ? v.id : null; } });

/* estatística do leite residual (por vaca: soma dos quartos quando informados por quarto) */
function lrStats(t) {
  const by = {}; arr1(t.rows).forEach(r => { const v = num(r.v); if (v == null || Number.isNaN(v)) return; by[r.a] = (by[r.a] || 0) + v; });
  const v = Object.values(by), e = L("eq").find(x => x.id == t.eid) || NOEQ, r = refFor("lr", e, null);
  const out = r ? v.filter(x => judge(x, r).st == "Fora").length : null;
  return { n: v.length, mean: v.length ? mean(v) : null, med: median(v), max: v.length ? Math.max(...v) : null, min: v.length ? Math.min(...v) : null, r, out, pct: r && v.length ? out / v.length * 100 : null, by };
}
const ttList = tipo => L("tt").filter(t => !tipo || t.tipo == tipo);

function tt4() {
  const f = F(), t = V.t4v || "lr", TB = [["lr", "Leite residual"], ["campo", "Testes de campo"], ["ext", "Relatórios externos"], ["form", TTE ? "Editar teste" : "Novo teste"]];
  if (V.t4 && t != "form") { const x = L("tt").find(y => y.id == V.t4); if (x) return ttDetail(f, x); }
  return farmHead(f, "🔧 Testes técnicos", E(f.name)) + demoNote(f)
    + `<div class="tabs noprint">${TB.filter(b => !(f.demo && b[0] == "form")).map(b => `<button class="tb ${t == b[0] ? "on" : ""}" onclick="V.t4v='${b[0]}';V.t4=null;V.note=null;render()">${b[1]}</button>`).join("")}</div>` + e2note()
    + (t == "form" ? ttForm(f) : ttTab(f, t));
}
function ttNew(tipo) { TTF = newTT(tipo); TTF.eid = (L("eq")[0] || {}).id || ""; TTE = null; V.t4v = "form"; V.t4 = null; V.note = null; render(); scrollTo(0, 0); }
function ttTab(f, tipo) {
  const l = ttList(tipo).slice().reverse();
  let h = f.demo ? "" : `<button class="btn w" onclick="ttNew('${tipo}')">+ Novo: ${TTT[tipo]}</button>`;
  if (tipo == "lr") {
    const s = ttList("lr").map(t => ({ d: t.date, v: lrStats(t).mean })).filter(x => x.v != null), r = refFor("lr", NOEQ, null);
    h += `<div class="card"><b>Leite residual médio por vaca (mL)</b>${tchart(s, { u: "mL", hi: r ? num(r.max) : null, lo: r ? num(r.min) : null, label: "Leite residual" })}<p class="mu">${s.length} teste(s)${r ? ` · referência verificada: ${E(rng(r))} (${E(r.fonte)})` : " · sem referência verificada para leite residual (cadastre na biblioteca, parâmetro “Leite residual por vaca”)"}</p></div>`;
  }
  if (tipo == "ext" && l.length > 1) h += `<button class="btn s" onclick="V.t4v='ext';V.t4cmp=1;render()">Comparar relatórios</button>`;
  if (tipo == "ext" && V.t4cmp) h += ttCompare(l);
  return h + `<h2>${TTT[tipo]} (${l.length})</h2>` + (l.map(t => {
    const e = L("eq").find(x => x.id == t.eid), st = t.tipo == "lr" ? lrStats(t) : null;
    return `<div class="card tap" onclick="V.t4='${t.id}';render();scrollTo(0,0)"><div class="top"><b>${fmtD(t.date)} · ${E(t.tit || TTT[t.tipo])}</b>${t.demo ? '<span class="demo">DEMO</span>' : ""}</div><p class="mu">${e ? E(eqt(e)) + " · " : ""}${st ? `${st.n} vaca(s) · média ${fm(st.mean, 0)} mL · máx. ${fm(st.max, 0)} mL${st.r ? ` · ${st.out} acima da referência` : ""}` : `${arr1(t.rows).length} valor(es)${t.file ? " · arquivo anexado" : ""}`}</p></div>`;
  }).join("") || '<div class="card mu">Nenhum registro.</div>');
}
function ttForm(f) {
  if (f.demo) return '<div class="card mu">Fazenda de demonstração: não é possível registrar testes.</div>';
  const es = L("eq"), lr = TTF.tipo == "lr";
  return `<div class="card"><div class="grid"><div><label>Tipo</label><select onchange="TTF.tipo=this.value;TTF.rows=[];render()">${Object.entries(TTT).map(([k, l]) => `<option value="${k}" ${TTF.tipo == k ? "selected" : ""}>${l}</option>`).join("")}</select></div><div><label>Data</label><input type="date" value="${E(TTF.date)}" oninput="TTF.date=this.value"></div><div><label>Equipamento (opcional)</label><select onchange="TTF.eid=this.value"><option value="">—</option>${es.map(e => `<option value="${e.id}" ${TTF.eid == e.id ? "selected" : ""}>${E(eqt(e))}</option>`).join("")}</select></div><div><label>${lr ? "Lote" : TTF.tipo == "ext" ? "Aparelho / origem do relatório" : "Título do teste"}</label><input value="${E(lr ? TTF.lote : TTF.tit)}" oninput="TTF.${lr ? "lote" : "tit"}=this.value"></div>${lr ? `<div><label>Ordenhador</label><input value="${E(TTF.milker)}" oninput="TTF.milker=this.value"></div><div><label>Método</label><input placeholder="como o residual foi coletado" value="${E(TTF.met)}" oninput="TTF.met=this.value"></div>` : ""}</div></div>
<div class="card"><b>${lr ? "Volumes por vaca" : "Valores"}</b>${TTF.rows.map((r, i) => `<p class="mu">${lr ? `Vaca <b style="color:var(--tx)">${E(r.a)}</b>${r.q ? " · quarto " + E(r.q) : ""}: <b style="color:var(--tx)">${E(r.v)} mL</b>` : `${E(r.a)}: <b style="color:var(--tx)">${E(r.v)} ${E(r.u)}</b>`} <button class="btn s" onclick="TTF.rows.splice(${i},1);render()">×</button></p>`).join("")}
<div class="grid">${lr ? `<div><label>Vaca (nº/brinco)</label><input value="${E(TTR.a)}" oninput="TTR.a=this.value"></div><div><label>Quarto (opcional)</label><select onchange="TTR.q=this.value"><option value="">vaca inteira</option>${QS.map(q => `<option ${TTR.q == q ? "selected" : ""}>${q}</option>`).join("")}</select></div><div><label>Volume (mL)</label><input inputmode="decimal" value="${E(TTR.v)}" oninput="TTR.v=this.value"></div>` : `<div><label>Medição</label><input value="${E(TTR.a)}" oninput="TTR.a=this.value"></div><div><label>Valor</label><input inputmode="decimal" value="${E(TTR.v)}" oninput="TTR.v=this.value"></div><div><label>Unidade</label><input value="${E(TTR.u)}" oninput="TTR.u=this.value"></div>`}</div><button class="btn s" style="margin-top:8px" onclick="ttAddRow()">+ Adicionar</button></div>
${TTF.tipo == "ext" ? `<div class="card"><b>Arquivo do relatório (PDF ou imagem)</b><input type="file" accept="application/pdf,image/*" onchange="ttFile(this)">${TTF.file ? `<p class="mu">📎 ${E(TTF.file.name)} (${fm(TTF.file.data.length * .75 / 1024, 0)} KB) <button class="btn s" onclick="TTF.file=null;render()">Remover</button></p>` : ""}<p class="mu">O arquivo fica guardado no aparelho. Digite acima os valores principais para comparar com outros relatórios.</p></div>` : ""}
<div class="card"><label>Observações</label><textarea rows="2" oninput="TTF.obs=this.value">${E(TTF.obs)}</textarea><label>Conclusão do técnico</label><textarea rows="2" oninput="TTF.concl=this.value">${E(TTF.concl)}</textarea></div>
<div class="acts"><button class="btn w" onclick="ttSave()">${TTE ? "Salvar alterações" : "Salvar teste"}</button><button class="btn gh w" onclick="TTF=newTT();TTE=null;V.t4v='lr';render()">Cancelar</button></div>`;
}
function ttAddRow() {
  const v = num(TTR.v), lr = TTF.tipo == "lr", a = String(TTR.a || "").replace(/[<>]/g, "").trim().slice(0, 60);
  if (!a) return note(lr ? "Informe a vaca." : "Informe o nome da medição.");
  if (v == null || Number.isNaN(v) || (lr && v < 0)) return note("Informe um valor numérico válido.");
  if (lr && TTF.rows.some(r => r.a == a && r.q == TTR.q)) return note("Esta vaca/quarto já foi registrada neste teste.");
  TTF.rows.push(lr ? { a, q: TTR.q || "", v: String(v) } : { a, v: String(v), u: String(TTR.u || "").replace(/[<>]/g, "").slice(0, 20) });
  TTR = { a: "", q: lr ? TTR.q : "", v: "", u: lr ? "" : TTR.u }; V.note = null; render();
}
function ttFile(inp) {
  const f = inp.files && inp.files[0]; if (!f) return;
  if (f.size > 8e6) return note("Arquivo grande demais (máx. 8 MB).");
  if (/^image\//.test(f.type)) return rz(f, 1600, d => { TTF.file = { name: f.name, type: "image/jpeg", data: d }; render(); });
  const r = new FileReader(); r.onload = () => { TTF.file = { name: f.name, type: f.type || "application/pdf", data: String(r.result) }; render(); }; r.readAsDataURL(f);
}
function ttSave() {
  const t = cp(TTF); if (!t.date) return note("Informe a data.");
  if (!t.rows.length && !t.file) return note(t.tipo == "lr" ? "Registre ao menos uma vaca." : "Registre ao menos um valor ou anexe o relatório.");
  if (t.eid && !L("eq").some(e => e.id == t.eid)) t.eid = "";
  ["tit", "lote", "met", "milker", "obs", "concl"].forEach(k => t[k] = String(t[k] || "").replace(/[<>]/g, "").slice(0, 3000));
  const old = TTE ? DB.tt.find(x => x.id == TTE) : null;
  t.id = old ? old.id : "tt" + Date.now(); t.fid = V.f; t.demo = false; t.created = old && old.created || new Date().toISOString();
  if (!upsert("tt", t)) return note(FAIL + " Arquivos grandes podem ter excedido o espaço.");
  TTF = newTT(t.tipo); TTE = null; V.t4v = t.tipo; V.t4 = t.id; note("Teste salvo e conferido.", 1);
}
function ttEdit(id) { const t = DB.tt.find(x => x.id == id); if (!t) return; TTF = Object.assign(newTT(), cp(t)); TTE = id; V.t4v = "form"; V.t4 = null; render(); scrollTo(0, 0); }
function ttDel(id) { if (V.del != id) { V.del = id; return render(); } V.del = null; const i = DB.tt.findIndex(x => x.id == id), o = DB.tt[i]; if (i < 0) return; DB.tt.splice(i, 1); if (!svS()) { DB.tt.splice(i, 0, o); return note(FAIL); } V.t4 = null; note("Teste excluído.", 1); }
function ttDetail(f, t) {
  const e = L("eq").find(x => x.id == t.eid), st = t.tipo == "lr" ? lrStats(t) : null;
  const rows = t.tipo == "lr" ? Object.entries(st.by).sort((a, b) => b[1] - a[1]) : [];
  return `<div class="pagehead noprint"><div><div class="crumb"><button onclick="go('farm','${f.id}')">${E(f.name)}</button> › <button onclick="V.t4=null;render()">Testes técnicos</button></div></div><div class="acts">${t.demo ? "" : `<button class="btn s" onclick="ttEdit('${t.id}')">Editar</button><button class="btn s" onclick="ttDel('${t.id}')">${V.del == t.id ? "Confirmar exclusão" : "Excluir"}</button>`}<button class="btn s" onclick="window.print()">Imprimir / PDF</button></div></div>` + e2note()
    + `<div class="card"><h1>${TTT[t.tipo]}${t.tit ? " — " + E(t.tit) : ""}</h1>${t.demo ? '<p><span class="demo" style="white-space:normal;display:inline-block">DADOS DE DEMONSTRAÇÃO — valores fictícios</span></p>' : ""}<p><b>${E(f.name)}</b> · ${fmtD(t.date)}${e ? " · " + E(eqt(e)) : ""}${t.lote ? " · lote " + E(t.lote) : ""}${t.milker ? " · ordenhador " + E(t.milker) : ""}</p>${t.met ? `<p class="mu">Método: ${E(t.met)}</p>` : ""}
${st ? `<div class="kgrid" style="margin:10px 0">${[["Vacas", st.n, ""], ["Média", fm(st.mean, 0), "mL"], ["Mediana", fm(st.med, 0), "mL"], ["Máximo", fm(st.max, 0), "mL"]].map(k => `<div class="kc"><span class="kl">${k[0]}</span><span class="kv">${k[1]} <small>${k[2]}</small></span></div>`).join("")}</div>
<p>${st.r ? `${st.out} de ${st.n} vaca(s) (${fm(st.pct, 0)}%) acima da referência verificada ${E(rng(st.r))} · fonte: ${E(st.r.fonte)}` : '<span class="mu">Sem referência verificada para leite residual: valores apenas descritivos.</span>'}</p>
${hb(rows.slice(0, 30).map(([a, v]) => ["Vaca " + a, [v]]), [st.r ? "var(--wa)" : "var(--pr)"])}${rows.length > 30 ? `<p class="mu">+ ${rows.length - 30} vaca(s)</p>` : ""}
${arr1(t.rows).some(r => r.q) ? `<div class="ov"><table><tr><th>Vaca</th><th>Quarto</th><th>mL</th></tr>${t.rows.map(r => `<tr><td>${E(r.a)}</td><td>${E(r.q || "—")}</td><td>${fm(num(r.v), 0)}</td></tr>`).join("")}</table></div>` : ""}`
      : `<div class="ov"><table><tr><th>Medição</th><th>Valor</th></tr>${arr1(t.rows).map(r => `<tr><td>${E(r.a)}</td><td>${fm(num(r.v), 2)} ${E(r.u || "")}</td></tr>`).join("")}</table></div>`}
${t.file ? (/^image\//.test(t.file.type) ? `<img src="${t.file.data}" alt="${E(t.file.name)}" style="max-width:100%;border-radius:8px;margin-top:8px">` : `<p><a download="${E(t.file.name)}" href="${t.file.data}">📎 Abrir/baixar ${E(t.file.name)}</a></p>`) : ""}
${t.obs ? `<h2>Observações</h2><p style="white-space:pre-wrap">${E(t.obs)}</p>` : ""}${t.concl ? `<h2>Conclusão</h2><p style="white-space:pre-wrap">${E(t.concl)}</p>` : ""}</div>`;
}
function ttCompare(l) {
  const A = l.find(x => x.id == V.t4a) || l[1], B = l.find(x => x.id == V.t4b) || l[0]; if (!A || !B) return "";
  const names = [...new Set(arr1(A.rows).concat(arr1(B.rows)).map(r => r.a))], val = (t, n) => { const r = arr1(t.rows).find(x => x.a == n); return r ? num(r.v) : null; }, un = n => (arr1(A.rows).concat(arr1(B.rows)).find(r => r.a == n) || {}).u || "";
  const op = s => l.map(x => `<option value="${x.id}" ${x.id == s ? "selected" : ""}>${fmtD(x.date)} · ${E(x.tit || "")}</option>`).join("");
  return `<div class="card"><b>Comparar relatórios externos</b><div class="grid"><div><label>Relatório A</label><select onchange="V.t4a=this.value;render()">${op(A.id)}</select></div><div><label>Relatório B</label><select onchange="V.t4b=this.value;render()">${op(B.id)}</select></div></div><div class="ov"><table><tr><th>Valor</th><th>A (${fmtD(A.date)})</th><th>B (${fmtD(B.date)})</th><th>Δ</th></tr>${names.map(n => `<tr><td>${E(n)}</td><td>${fm(val(A, n), 2)} ${E(un(n))}</td><td>${fm(val(B, n), 2)} ${E(un(n))}</td><td>${dl(val(A, n), val(B, n), 2)}</td></tr>`).join("")}</table></div><p class="mu">Os valores são comparados pelo nome digitado em cada relatório.</p></div>`;
}

/* ---------- dados de demonstração ---------- */
(() => {
  DM.tt = [];
  [["modelo", 0], ["critica", 1]].forEach(([fid, b]) => {
    let r = b ? 53 : 29; const q = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    const eid = (DM.eq.find(e => e.fid == fid) || {}).id || "";
    DM.rf.push({ id: "drflr" + fid, fid, demo: true, fab: "", mod: "", par: "lr", min: "", max: b ? "250" : "250", un: "mL", fonte: "DEMO (valor fictício, não é norma)", norma: "Outra", item: "DEMO", ver: true, grav: "Média" });
    for (let i = 0; i < 4; i++) {
      const rows = []; for (let c = 1; c <= 12; c++) rows.push({ a: "D" + c, q: "", v: String(Math.round(b ? 180 + q() * (i < 2 ? 320 : 220) : 60 + q() * 120)) });
      DM.tt.push({ id: "dtt" + fid + i, fid, demo: true, tipo: "lr", date: DD(TD(), -100 + i * 28), eid, tit: "", lote: "Lote 1", met: "DEMO: ordenha manual após a retirada", milker: ["Ordenhador A", "Ordenhador B"][i % 2], rows, obs: "", concl: b ? "DEMO: residual alto; revisar estímulo e retirada." : "DEMO: residual baixo." });
    }
    DM.tt.push({ id: "dtte" + fid, fid, demo: true, tipo: "campo", date: DD(TD(), -20), eid, tit: "Teste de fluxo (demo)", rows: [{ a: "Pico de fluxo", v: b ? "3.1" : "4.2", u: "kg/min" }, { a: "Tempo de ordenha", v: b ? "8.5" : "6.2", u: "min" }], obs: "", concl: "DEMO" });
    [0, 1].forEach(i => DM.tt.push({ id: "dttx" + fid + i, fid, demo: true, tipo: "ext", date: DD(TD(), -90 + i * 60), eid, tit: "Relatório do analisador (demo)", rows: [{ a: "Vácuo médio", v: String(b ? 46 + i * 3 : 47), u: "kPa" }, { a: "Taxa de pulsação", v: "60", u: "c/min" }, { a: "Relação", v: String(b ? 62 + i * 6 : 60), u: "%" }], obs: "", concl: "DEMO", file: null }));
  });
})();
