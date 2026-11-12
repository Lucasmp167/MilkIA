/* ===== Cronômetro por item da rotina: itens personalizáveis por fazenda + relatório da cronometragem =====
 * Cada fazenda pode renomear, desligar, reordenar e criar seus próprios itens de rotina (cada item tem
 * o seu cronômetro). Configuração em DB.gl[fid].fases = { ord:[k], nm:{k:nome}, off:{k:true}, cust:[{k,n,h}] }.
 * Os itens padrão mantêm as chaves (pa, pre, fl, so, pos...) usadas nas análises; os itens criados pelo
 * usuário (u1, u2...) entram nos tempos médios, gráficos e no relatório da cronometragem.
 * O relatório traz, para cada item: vacas, média, mediana, mínimo, máximo, por turno e por ordenhador,
 * gráfico, e um texto geral escrito a partir dos dados (sem valores de referência inventados).
 */
const FASES0 = FASES.map(x => x.slice());
const PHOFF = {};
const fcfg = f => (f && !f.demo && DB.gl[f.id] && DB.gl[f.id].fases) || {};
/* reconstrói FASES/PHN para a fazenda atual (ordem, nomes, itens próprios); todos os módulos leem FASES */
function syncFases(f) {
  const c = fcfg(f), all = FASES0.map(x => x.slice()).concat(arr1(c.cust).map(x => [x.k, x.n, x.h || "item criado na fazenda"]));
  all.forEach(x => { if (c.nm && c.nm[x[0]]) x[1] = c.nm[x[0]]; });
  const ord = arr1(c.ord).filter(k => all.some(x => x[0] == k)); all.sort((a, b) => { const i = ord.indexOf(a[0]), j = ord.indexOf(b[0]); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
  FASES.length = 0; all.forEach(x => FASES.push(x));
  Object.keys(PHN).forEach(k => delete PHN[k]); FASES.forEach(x => PHN[x[0]] = x[1]);
  Object.keys(PHOFF).forEach(k => delete PHOFF[k]); Object.keys(c.off || {}).forEach(k => { if (c.off[k]) PHOFF[k] = true; });
}
function fsave(mut) {
  const f = F(); if (f.demo) return note("Fazenda de demonstração: os itens não podem ser alterados.");
  const g = DB.gl[f.id] = DB.gl[f.id] || {}, c = g.fases = Object.assign({ ord: FASES.map(x => x[0]), nm: {}, off: {}, cust: [] }, g.fases || {});
  mut(c); syncFases(f); if (!svS()) return note(FAIL); render();
}
const fRename = (k, v) => fsave(c => { v = String(v).replace(/[<>]/g, "").trim().slice(0, 40); if (v) c.nm[k] = v; else delete c.nm[k]; });
const fToggle = k => fsave(c => { c.off[k] = !c.off[k]; });
const fMove = (k, d) => fsave(c => { const o = FASES.map(x => x[0]), i = o.indexOf(k), j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; c.ord = o; });
function fAdd() {
  const n = String(V.fnew || "").replace(/[<>]/g, "").trim().slice(0, 40); if (!n) return note("Escreva o nome do novo item.");
  if (FASES.some(x => nrm(x[1]) == nrm(n))) return note("Já existe um item com esse nome.");
  fsave(c => { let i = 1; while (c.cust.some(x => x.k == "u" + i)) i++; c.cust.push({ k: "u" + i, n, h: String(V.fnewh || "").replace(/[<>]/g, "").slice(0, 80) }); c.ord = FASES.map(x => x[0]).concat(["u" + i]); });
  V.fnew = ""; V.fnewh = "";
}
function fReset() { if (V.fres != F().id) { V.fres = F().id; return note("Toque de novo em “Voltar ao padrão” para confirmar. Os tempos já registrados não são apagados."); } V.fres = null; fsave(c => { c.ord = FASES0.map(x => x[0]); c.nm = {}; c.off = {}; }); }
function fConfig() {
  const f = F();
  if (f.demo) return '<p class="mu">Na fazenda de demonstração os itens são fixos.</p>';
  return `<div class="flist">${FASES.map(([k, l], i) => `<div class="fit ${PHOFF[k] ? "off" : ""}"><input aria-label="Nome do item" value="${E(l)}" onchange="fRename('${k}',this.value)"><span class="acts"><button class="btn s" aria-label="Subir" ${i ? "" : "disabled"} onclick="fMove('${k}',-1)">↑</button><button class="btn s" aria-label="Descer" ${i < FASES.length - 1 ? "" : "disabled"} onclick="fMove('${k}',1)">↓</button><button class="btn s" onclick="fToggle('${k}')">${PHOFF[k] ? "Ligar" : "Desligar"}</button></span></div>`).join("")}</div>
<div class="grid" style="margin-top:8px"><div><label>Novo item da rotina</label><input value="${E(V.fnew || "")}" placeholder="ex.: teste da caneca" oninput="V.fnew=this.value"></div><div><label>Descrição (opcional)</label><input value="${E(V.fnewh || "")}" oninput="V.fnewh=this.value"></div></div><div class="acts" style="margin-top:8px"><button class="btn w" onclick="fAdd()">＋ Criar item com cronômetro</button><button class="btn gh w" onclick="fReset()">Voltar ao padrão</button></div>
<p class="mu">Renomear ou desligar não apaga os tempos já registrados. Os itens “Preparo até a colocação”, “Pré-dipping”, “Fluxo”, “Sobreordenha” e “Pós-dipping” também alimentam o ranking e o diagnóstico.</p>`;
}
/* o painel mostra só os itens ligados, na ordem da fazenda, com a personalização logo abaixo */
{ const base = phPanel; phPanel = function () {
  syncFases(F()); const keep = FASES.slice(); FASES.length = 0; keep.filter(x => !PHOFF[x[0]]).forEach(x => FASES.push(x));
  let h; try { h = base(); } finally { FASES.length = 0; keep.forEach(x => FASES.push(x)); }
  return h + `<details class="card fold"><summary><b>⚙️ Personalizar itens do cronômetro</b> <span class="mu">nomes, ordem, criar itens</span></summary>${fConfig()}</details>`;
}; }
/* toda tela e relatório usa os itens da fazenda que está aberta */
{ const base = render; render = function () { try { syncFases(F()); } catch (e) { } return base(); }; }

/* ---------- relatório da cronometragem ---------- */
const phSd = a => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
function phVals(ss, k) {
  const v = []; ss.forEach(s => s.cows.forEach(c => { let x = null; if (c.ph) x = c.ph[k]; else { const d = cd(c); x = { pa: d.pa, pre: d.ct, fl: d.fl, so: d.so, pos: d.rp }[k]; } if (x != null && !isNaN(x)) v.push({ v: +x, s, c }); })); return v;
}
function cronoReport() {
  const f = F(); syncFases(f);
  const ss = typeof ssF == "function" ? ssF() : SS(); if (!ss.length) return '<div class="card mu">Nenhum teste de ordenha no período/filtro escolhido.</div>';
  const M = rotMeta(f), lim = { pa: [M.paMin, M.paMax], pre: [M.ctMin, M.ctMax], so: [null, M.soMax] }, nC = ss.reduce((a, s) => a + s.cows.length, 0), d0 = ss[0].date, d1 = ss[ss.length - 1].date;
  const rows = FASES.map(([k, l, h]) => { const v = phVals(ss, k); if (!v.length) return null; const a = v.map(x => x.v);
    const byT = [1, 2, 3].map(t => { const q = v.filter(x => x.s.turn == t).map(x => x.v); return q.length ? mean(q) : null; });
    const byM = {}; v.forEach(x => (byM[x.s.milker || "—"] = byM[x.s.milker || "—"] || []).push(x.v));
    const L2 = lim[k], out = L2 && (num(L2[0]) != null || num(L2[1]) != null) ? a.filter(x => !inR(x, L2[0], L2[1])).length : null;
    return { k, l, h, n: a.length, m: mean(a), med: median(a), mn: Math.min(...a), mx: Math.max(...a), dp: phSd(a), byT, byM, out, L2 }; }).filter(Boolean);
  if (!rows.length) return '<div class="card mu">Nenhum item cronometrado nos testes escolhidos.</div>';
  const longest = rows.filter(r => !["pa", "fl"].includes(r.k)).sort((a, b) => b.m - a.m)[0], cvHi = rows.filter(r => r.dp != null && r.m > 0 && r.dp / r.m > .5);
  const turnDiff = rows.map(r => { const t = r.byT.map((v, i) => ({ v, t: i + 1 })).filter(x => x.v != null); if (t.length < 2) return null; const hi = t.reduce((a, b) => b.v > a.v ? b : a), lo = t.reduce((a, b) => b.v < a.v ? b : a); return lo.v ? { r, hi, lo, p: (hi.v - lo.v) / lo.v * 100 } : null; }).filter(x => x && x.p >= (num(M.dif) || 20)).sort((a, b) => b.p - a.p);
  const txt = [`Foram cronometradas ${nC} vacas em ${ss.length} teste(s) de ordenha, de ${fmtD(d0)} a ${fmtD(d1)}, com ${rows.length} item(ns) da rotina medidos.`,
    longest ? `Entre as etapas de manejo, a mais demorada foi “${longest.l}”, com média de ${mmss(longest.m)} por vaca.` : "",
    ...rows.filter(r => r.out != null).map(r => `${r.l}: ${r.out} de ${r.n} vacas (${fm(r.out / r.n * 100, 0)}%) fora da meta da fazenda (${r.L2[0] || "—"} a ${r.L2[1] || "—"} s; fonte: ${M.fonte || "definida pelo usuário"}).`),
    ...turnDiff.slice(0, 3).map(x => `${x.r.l}: o turno ${TURNO[x.hi.t].toLowerCase()} levou ${fm(x.p, 0)}% a mais que o da ${TURNO[x.lo.t].toLowerCase()} (${mmss(x.hi.v)} × ${mmss(x.lo.v)}).`),
    cvHi.length ? `Os tempos variaram muito entre vacas em: ${cvHi.map(r => r.l).join(", ")} — sinal de rotina pouco padronizada.` : "",
    rows.some(r => r.out != null) ? "" : "Não há metas da rotina cadastradas: os tempos estão descritos, sem classificação (cadastre as metas em Ordenha → Diagnóstico)."].filter(Boolean);
  const C = TC;
  return `<div class="card report"><h1>Relatório da cronometragem da rotina</h1>${f.demo ? '<p><span class="demo">DADOS DE DEMONSTRAÇÃO</span></p>' : ""}<p><b>${E(f.name)}</b> · ${E(f.producer)} · ${E(f.city)}</p><p class="mu">${fmtD(d0)} a ${fmtD(d1)} · ${ss.length} teste(s) · ${nC} vacas · emitido em ${new Date().toLocaleString("pt-BR")}</p>
<h2>Texto geral</h2>${txt.map(t => `<p>${E(t)}</p>`).join("")}
<h2>Resumo por item</h2><div class="ov"><table><tr><th>Item</th><th>Vacas</th><th>Média</th><th>Mín.</th><th>Máx.</th><th>Manhã</th><th>Tarde</th><th>Noite</th></tr>${rows.map(r => `<tr><td>${E(r.l)}</td><td>${r.n}</td><td><b>${mmss(r.m)}</b></td><td>${mmss(r.mn)}</td><td>${mmss(r.mx)}</td>${r.byT.map(v => `<td>${v == null ? "—" : mmss(v)}</td>`).join("")}</tr>`).join("")}</table></div>
<div class="card">${chartTitle("Tempo médio por item × turno", "segundos")}${gbar(rows.map(r => r.l), [1, 2, 3].filter(t => rows.some(r => r.byT[t - 1] != null)).map(t => ({ n: TURNO[t], c: C[t], v: rows.map(r => r.byT[t - 1]) })), { u: "s", label: "Itens por turno" })}</div>
${rows.map(r => { const ms = Object.entries(r.byM).map(([n, a]) => ({ n, v: mean(a), q: a.length })).sort((a, b) => a.v - b.v);
  return `<div class="card phrep"><h2 style="margin-top:0">⏱️ ${E(r.l)}</h2><p class="mu">${E(r.h)}</p><div class="kgrid">${[["Vacas", String(r.n), ""], ["Média", mmss(r.m), ""], ["Mediana", mmss(r.med), ""], ["Mín. – máx.", mmss(r.mn) + " – " + mmss(r.mx), ""]].map(x => `<div class="kc"><span class="kl">${x[0]}</span><span class="kv">${x[1]}</span></div>`).join("")}</div>
${r.out != null ? `<p><b class="${r.out ? "wa" : "ok"}">${r.out} de ${r.n} vacas (${fm(r.out / r.n * 100, 0)}%) fora da meta</b> <span class="mu">(${r.L2[0] || "—"} a ${r.L2[1] || "—"} s · ${E(M.fonte || "meta do usuário")})</span></p>` : ""}
<div class="two"><div>${chartTitle("Por turno", "s")}${colChart([1, 2, 3].map(t => ({ l: TURNO[t], v: r.byT[t - 1], c: C[t] })), { u: "s", ref: r.L2 && num(r.L2[1]) != null ? num(r.L2[1]) : null, refLab: "máx." })}</div><div>${chartTitle("Por ordenhador", "s")}${colChart(ms.slice(0, 6).map(x => ({ l: x.n.length > 14 ? x.n.slice(0, 13) + "…" : x.n, v: x.v })), { u: "s" })}</div></div>
<p class="mu">${ms.map(x => `${E(x.n)}: ${mmss(x.v)} (${x.q} vaca${x.q > 1 ? "s" : ""})`).join(" · ")}${r.dp != null ? ` · desvio-padrão ${fm(r.dp, 0)} s` : ""}</p></div>`; }).join("")}
<p class="mu">Tempos medidos com o cronômetro por item do MilkIQ (ou calculados a partir dos marcos, quando o teste usou o cronômetro único). Classificação só com as metas cadastradas pelo usuário.</p></div>`;
}
/* aba Relatório da ordenha: relatório da cronometragem + relatório anterior; e entrada na central de PDFs */
const vRlBase = vRl;
vRl = function () { return filters() + cronoReport() + '<div class="pbreak"></div>' + vRlBase(); };
REPS.find(r => r.k == "o").html = () => vRlBase();
REPS.splice(2, 0, { k: "cr", n: "Cronometragem da rotina (por item)", s: 5, has: () => SS().length, html: () => cronoReport() });
