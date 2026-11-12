/* ===== Setor 6 (nova organização): ordenhadores, turnos e otimização inteligente da ordenha =====
 *
 * Reaproveita o Setor 6 original (cronômetro, histórico, relatório, calculadoras, agregações) e
 * acrescenta:
 *  - cadastro único de ordenhadores (DB.op, dados v7) com sugestão automática nos testes;
 *  - turnos Manhã/Tarde/Noite, equipe, horário de início e fim (duração calculada);
 *  - painel por turno, comparação entre ordenhadores e entre períodos, evolução diária/semanal/mensal;
 *  - ranking ponderado que NÃO premia só velocidade (rotina, preparo, sobreordenha, ocorrências,
 *    qualidade por turno quando houver; produtividade pesa pouco);
 *  - diagnóstico da rotina (fatos, hipóteses, recomendações, prioridade) e criação de ações;
 *  - assistente técnico da fazenda (análise automática por REGRAS, offline; não é IA generativa).
 *
 * Critérios: só as metas da rotina que o usuário cadastra (com fonte). Sem meta, o app mostra os
 * valores e as diferenças entre turnos/ordenhadores, mas não classifica.
 */
ARR.push("op"); LAB.op = "Ordenhadores"; DB.op = DB.op || [];

/* ---------- dados de demonstração complementares (fictícios) ---------- */
(() => {
  DM.op = [];
  [["modelo", 0], ["critica", 1]].forEach(([fid, b]) => ["Ordenhador A", "Ordenhador B", "Ordenhador C"].forEach((n, i) => DM.op.push({ id: "dop" + fid + i, fid, demo: true, nome: n, equipe: i < 2 ? "Equipe 1" : "Equipe 2", ativo: true, obs: "" })));
  let r = 11; const q = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  DEMO.forEach(s => {
    s.equipe = /C$/.test(s.milker) ? "Equipe 2" : "Equipe 1";
    const crit = s.fid == "critica", fT = crit ? [0, 1, 1.12, 1.3][s.turn] : [0, 1, 1.03, 1.06][s.turn], fM = crit && /C$/.test(s.milker) ? 1.1 : 1;
    s.dur = Math.round((s.dur || 140) * fT * fM * (.96 + q() * .08)); s.litros = Math.round(s.litros * (crit ? [0, 1, .97, .92][s.turn] : 1) * (.97 + q() * .06));
    s.cows.forEach(c => { if (crit && s.turn == 3 && c.m.fim != null && c.m.ret != null) { c.m.ret = +(c.m.ret + 40 + q() * 30).toFixed(1); } });
    const h0 = s.turn == 1 ? 5 : s.turn == 2 ? 14 : 21, m0 = Math.floor(q() * 20), d = s.dur || 140;
    s.hi = `${String(h0).padStart(2, "0")}:${String(m0).padStart(2, "0")}`; const end = h0 * 60 + m0 + d; s.hf = `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
    s.cows.forEach(c => { if (c.m.ret != null && (s.fid == "modelo" || q() > .3)) c.m.pos = +(c.m.ret + 4 + q() * 8).toFixed(1); });
  });
})();
const DEMOROT = { ctMin: "30", ctMax: "", paMin: "60", paMax: "120", soMax: "30", dif: "20", fonte: "DEMO (metas fictícias, não são recomendação técnica)" };

/* ---------- ordenhadores ---------- */
const opNames = () => [...new Set(L("op").filter(o => o.ativo !== false).map(o => o.nome).concat(SS().map(s => s.milker)).filter(Boolean))].sort();
const opTeams = () => [...new Set(L("op").map(o => o.equipe).concat(SS().map(s => s.equipe)).filter(Boolean))].sort();
function opList() { return `<datalist id="dl-ops">${opNames().map(n => `<option value="${E(n)}">`).join("")}</datalist><datalist id="dl-eqp">${opTeams().map(n => `<option value="${E(n)}">`).join("")}</datalist>`; }
function opFill(n) { const o = L("op").find(x => x.nome == n), d = dr(); if (o && o.equipe && !d.equipe) { d.equipe = o.equipe; svD(); render(); } }
/* duração calculada a partir do início e término (passa da meia-noite) */
{ const base = dset; dset = function (k, v) { base(k, v); if (k == "hi" || k == "hf") { const d = dr(), t = x => { const m = /^(\d\d):(\d\d)$/.exec(x || ""); return m ? +m[1] * 60 + +m[2] : null; }, a = t(d.hi), b = t(d.hf); if (a != null && b != null) { d.dur = (b - a + 1440) % 1440 || ""; svD(); } } }; }
let OPF = { nome: "", equipe: "", obs: "" }, OPE = null;
function opSave() {
  const o = { nome: String(OPF.nome || "").replace(/[<>]/g, "").trim().slice(0, 60), equipe: String(OPF.equipe || "").replace(/[<>]/g, "").trim().slice(0, 40), obs: String(OPF.obs || "").replace(/[<>]/g, "").slice(0, 300) };
  if (!o.nome) return note("Informe o nome do ordenhador.");
  if (L("op").some(x => x.id != OPE && nrm(x.nome) == nrm(o.nome))) return note("Já existe um ordenhador com esse nome nesta fazenda.");
  const old = OPE ? DB.op.find(x => x.id == OPE) : null;
  Object.assign(o, { id: old ? old.id : "op" + Date.now(), fid: V.f, demo: false, ativo: old ? old.ativo : true });
  if (old && old.nome != o.nome) { DB.sessions.forEach(s => { if (s.fid == V.f && s.milker == old.nome) s.milker = o.nome; }); } // renomeia nos testes
  if (!upsert("op", o)) return note(FAIL);
  OPF = { nome: "", equipe: "", obs: "" }; OPE = null; note("Ordenhador salvo e conferido.", 1);
}
function opToggle(id) { const o = cp(DB.op.find(x => x.id == id)); if (!o) return; o.ativo = o.ativo === false; upsert("op", o) ? render() : note(FAIL); }

/* ---------- filtros e agregações ---------- */
const PER = [["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"], ["365", "12 meses"], ["", "Tudo"]];
V.of = V.of || { p: "", m: "", e: "" };
const ssF = () => { const o = V.of, lim = o.p ? DD(TD(), -o.p) : ""; return SS().filter(s => (!lim || s.date >= lim) && (!o.m || s.milker == o.m) && (!o.e || (s.equipe || "") == o.e)); };
function filters(opts = {}) {
  const o = V.of, sel = (k, l, list, all) => `<div><label>${l}</label><select onchange="V.of.${k}=this.value;render()"><option value="">${all}</option>${list.map(x => `<option value="${E(x[0])}" ${o[k] == x[0] ? "selected" : ""}>${E(x[1])}</option>`).join("")}</select></div>`;
  return `<div class="card noprint"><div class="grid">${sel("p", "Período", PER.filter(x => x[0]), "Todo o período")}${opts.noM ? "" : sel("m", "Ordenhador", opNames().map(n => [n, n]), "Todos")}${sel("e", "Equipe", opTeams().map(n => [n, n]), "Todas")}</div></div>`;
}
const rotMeta = f => f.demo ? DEMOROT : ((DB.gl[f.id] || {}).rot || {});
const inR = (v, lo, hi) => v != null && (num(lo) == null || v >= num(lo)) && (num(hi) == null || v <= num(hi));
/* métricas de um conjunto de testes (por turno, ordenhador, período...) */
function met(ss) {
  const cs = ss.flatMap(s => s.cows.map(cd)), A = agg(ss), sum = k => ss.reduce((a, s) => a + (num(s[k]) || 0), 0), vac = sum("vacas"), dur = ss.filter(s => s.dur && s.vacas).reduce((a, s) => a + num(s.dur), 0), vacD = ss.filter(s => s.dur && s.vacas).reduce((a, s) => a + num(s.vacas), 0);
  const pct = f => cs.length ? cs.filter(f).length / cs.length * 100 : null, mv = k => { const v = cs.map(c => c[k]).filter(x => x != null); return v.length ? mean(v) : null; };
  return { n: ss.length, nc: cs.length, vac, lit: sum("litros"), lpt: ss.length ? sum("litros") / ss.length : null, lv: A.lv, lh: A.lh, vph: dur ? vacD / dur * 60 : null, tpv: vacD ? dur * 60 / vacD : null, pa: A.pa, ct: A.ct, or: A.or, so: A.so, fl: mv("fl"), rp: mv("rp"), oc: vac ? (sum("drops") + sum("rec")) / vac * 100 : null,
    rot: pct(c => c.full), hig: pct(c => c.hyg), cs };
}
function cowsMiss(ss) { const cows = ss.flatMap(s => s.cows); if (!cows.length) return {}; const o = {}; ["jatos", "pre", "sec", "est", "pos"].forEach(k => o[k] = cows.filter(c => c.ph ? c.ph[k] == null : (c.m || {})[k] == null).length / cows.length * 100); return o; }
const MET = { lpt: ["Produção por teste", "L", 0], lv: ["Litros por vaca", "L", 1], vph: ["Vacas por hora", "vacas/h", 0], tpv: ["Tempo médio por vaca", "s", 0], pa: ["Preparo até a colocação", "s", 0], ct: ["Contato do pré-dipping", "s", 0], or: ["Tempo de ordenha", "s", 0], fl: ["Tempo de fluxo (até o fim do fluxo)", "s", 0], so: ["Sobreordenha", "s", 0], rp: ["Retirada até pós-dipping", "s", 0], oc: ["Quedas + reacoplamentos por 100 vacas", "", 1] };

/* ---------- gráficos ---------- */
const TC = ["", "var(--wa)", "var(--in)", "var(--cr)"];
function colChart(items, o = {}) {
  const it = items.filter(x => x.v != null && !isNaN(x.v)); if (!it.length) return '<p class="mu">Sem dados.</p>';
  const W = 300, H = 150, B = 26, T = 18, mx = Math.max(...it.map(x => x.v), o.ref || 0) * 1.12 || 1, bw = Math.min(56, (W - 20) / items.length - 14);
  const ry = o.ref != null ? H - B - o.ref / mx * (H - B - T) : 0, refSvg = o.ref != null ? `<line class="gl" x1="6" x2="${W - 6}" y1="${ry}" y2="${ry}"/><text x="8" y="${ry - 4}" style="fill:var(--wa);paint-order:stroke;stroke:var(--card);stroke-width:3px">${E(o.refLab || "meta")} ${fm(o.ref, o.dec || 0)}</text>` : "";
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${E(o.label || "")}">${items.map((x, i) => { const cx = 10 + (i + .5) * (W - 20) / items.length, h = x.v == null || isNaN(x.v) ? 0 : x.v / mx * (H - B - T); return `<rect x="${cx - bw / 2}" y="${H - B - h}" width="${bw}" height="${Math.max(h, 0)}" rx="5" fill="${x.c || "var(--pr)"}"><title>${E(x.l)}: ${fm(x.v, o.dec || 0)} ${E(o.u || "")}</title></rect><text x="${cx}" y="${H - B - h - 5}" text-anchor="middle" style="fill:var(--tx);font-weight:700">${x.v == null || isNaN(x.v) ? "—" : fm(x.v, o.dec || 0)}</text><text x="${cx}" y="${H - 8}" text-anchor="middle">${E(x.l)}</text>`; }).join("")}<line class="ax" x1="6" x2="${W - 6}" y1="${H - B}" y2="${H - B}"/>${refSvg}</svg>`;
}
/* várias séries no tempo (ex.: um turno por linha) */
function mchart(series, o = {}) {
  const S = series.map(s => Object.assign({}, s, { pts: s.pts.filter(p => p.v != null && !isNaN(p.v)) })).filter(s => s.pts.length);
  if (!S.length) return '<p class="mu">Sem dados.</p>';
  const xs = [...new Set(S.flatMap(s => s.pts.map(p => p.d)))].sort(), vs = S.flatMap(s => s.pts.map(p => p.v));
  const W = 640, H = 220, L0 = 46, R0 = 14, T0 = 14, B0 = 30; let mx = Math.max(...vs), mn = Math.min(...vs); const pd = (mx - mn) * .12 || Math.abs(mx) * .1 || 1; mx += pd; mn = Math.max(0, mn - pd);
  const X = d => L0 + (xs.length == 1 ? (W - L0 - R0) / 2 : xs.indexOf(d) * (W - L0 - R0) / (xs.length - 1)), Y = v => T0 + (mx - v) / (mx - mn || 1) * (H - T0 - B0), dc = o.dec || 0;
  const yt = [mn, (mn + mx) / 2, mx].map(v => `<line class="ax" x1="${L0}" x2="${W - R0}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L0 - 6}" y="${Y(v) + 4}" text-anchor="end">${fm(v, dc)}</text>`).join("");
  const lab = d => o.fmt ? o.fmt(d) : fmtD(d).slice(0, 5), xi = [...new Set([0, Math.floor((xs.length - 1) / 2), xs.length - 1])];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${E(o.label || "")}">${yt}${S.map(s => `${s.pts.length > 1 ? `<polyline fill="none" stroke="${s.c}" stroke-width="2.4" points="${s.pts.map(p => X(p.d) + "," + Y(p.v)).join(" ")}"/>` : ""}${s.pts.map(p => `<circle cx="${X(p.d)}" cy="${Y(p.v)}" r="3.4" fill="${s.c}"><title>${E(s.n)} · ${E(lab(p.d))}: ${fm(p.v, dc)} ${E(o.u || "")}</title></circle>`).join("")}`).join("")}${xi.map(i => `<text x="${X(xs[i])}" y="${H - 10}" text-anchor="${xs.length == 1 ? "middle" : i == 0 ? "start" : i == xs.length - 1 ? "end" : "middle"}">${E(lab(xs[i]))}</text>`).join("")}</svg><p class="mu">${S.map(s => `<span style="color:${s.c}">●</span> ${E(s.n)}`).join(" &nbsp; ")}</p>`;
}
const GRAN = { d: ["Diária", d => d], w: ["Semanal", d => { const t = new Date(d + "T12:00:00"), k = (t.getDay() + 6) % 7; t.setDate(t.getDate() - k); return t.toISOString().slice(0, 10); }], m: ["Mensal", d => d.slice(0, 7) + "-01"] };
function evol(ss, key, by) {
  const g = GRAN[V.og || "w"][1], grp = {}; ss.forEach(s => { const k = by(s), d = g(s.date); ((grp[k] = grp[k] || {})[d] = grp[k][d] || []).push(s); });
  return Object.entries(grp).map(([k, o]) => ({ k, pts: Object.keys(o).sort().map(d => ({ d, v: met(o[d])[key] })) }));
}

/* ---------- ranking: rotina, preparo, sobreordenha, ocorrências, qualidade, produtividade ---------- */
const RW = [["rot", "Rotina completa", 25], ["pre", "Preparo dentro da meta", 20], ["ctm", "Contato do pré-dipping na meta", 10], ["som", "Sobreordenha dentro do limite", 20], ["occ", "Poucas quedas/reacoplamentos", 10], ["qual", "Qualidade do leite nos seus turnos", 10], ["prod", "Produtividade (vacas/hora)", 5]];
function qualByTurn(f) { // CCS média das análises que têm turno, comparada à meta do usuário
  const g = gls(f), a = QA(f.id).filter(x => x.turno && x.ccs != null && (!V.of.p || x.date >= DD(TD(), -V.of.p))), o = {};
  if (g.ccs == null) return null;
  [1, 2, 3].forEach(t => { const l = a.filter(x => String(x.turno) == String(t)); if (l.length) o[t] = { n: l.length, ccs: mean(l.map(x => x.ccs)), ok: l.filter(x => x.ccs <= g.ccs).length / l.length * 100 }; });
  return Object.keys(o).length ? o : null;
}
function rank2(ss, f, by = s => s.milker) {
  const M = rotMeta(f), qt = qualByTurn(f), grp = {};
  ss.forEach(s => (grp[by(s) || "—"] = grp[by(s) || "—"] || []).push(s));
  const R = Object.entries(grp).map(([n, l]) => {
    const m = met(l), cs = m.cs, c = {};
    c.rot = m.rot;
    if (num(M.paMin) != null || num(M.paMax) != null) { const v = cs.filter(x => x.pa != null); c.pre = v.length ? v.filter(x => inR(x.pa, M.paMin, M.paMax)).length / v.length * 100 : null; }
    if (num(M.ctMin) != null || num(M.ctMax) != null) { const v = cs.filter(x => x.ct != null); c.ctm = cs.length ? v.filter(x => inR(x.ct, M.ctMin, M.ctMax)).length / cs.length * 100 : null; } // sem pré-dip conta como fora
    if (num(M.soMax) != null) { const v = cs.filter(x => x.so != null); c.som = v.length ? v.filter(x => x.so <= num(M.soMax)).length / v.length * 100 : null; }
    c._oc = m.oc; c._vph = m.vph;
    if (qt) { const ts = [...new Set(l.map(s => s.turn))].filter(t => qt[t]); c.qual = ts.length ? mean(ts.map(t => qt[t].ok)) : null; }
    return { n, l, m, c };
  });
  const mo = Math.max(0, ...R.map(r => r.c._oc || 0)), mv = Math.max(0, ...R.map(r => r.c._vph || 0));
  R.forEach(r => {
    r.c.occ = r.c._oc != null ? (mo ? 100 - r.c._oc / mo * 100 : 100) : null; r.c.prod = r.c._vph != null && mv ? r.c._vph / mv * 100 : null;
    let s = 0, w = 0; r.used = []; RW.forEach(([k, l, wt]) => { if (r.c[k] != null) { s += r.c[k] * wt; w += wt; r.used.push(k); } });
    r.sc = w ? s / w : null; r.w = w;
  });
  return R.sort((a, b) => (b.sc == null ? -1 : b.sc) - (a.sc == null ? -1 : a.sc));
}

/* ---------- diagnóstico da rotina: fatos, hipóteses, recomendações ---------- */
const PRI = { Alta: "cr", Média: "wa", Baixa: "in" };
function routineFindings(ss, f) {
  const F2 = [], M = rotMeta(f), m = met(ss), miss = cowsMiss(ss), dif = num(M.dif) || 20, add = (pri, fato, hip, rec, kpi) => F2.push({ pri, fato, hip, rec, kpi });
  if (!ss.length) return F2;
  const pr = x => x >= 30 ? "Alta" : x >= 10 ? "Média" : "Baixa";
  [["pre", "pré-dipping", "desinfecção dos tetos antes da ordenha não realizada (ou não registrada)", "Padronizar o pré-dipping em todas as vacas e conferir o registro no cronômetro"], ["sec", "secagem", "tetos úmidos na colocação podem levar resíduos de desinfetante e água ao leite", "Secar os tetos com papel ou toalha individual"], ["jatos", "retirada dos primeiros jatos", "falta de estímulo e de detecção precoce de mastite clínica", "Retirar os primeiros jatos em caneca de fundo escuro"], ["pos", "pós-dipping", "tetos sem proteção após a ordenha", "Aplicar o pós-dipping logo após a retirada do conjunto"]].forEach(([k, l, hip, rec]) => {
    if (miss[k] > 0 && !(k == "pos" && miss.pos == 100 && !ss.some(s => s.cows.some(c => c.ph ? c.ph.pos != null : (c.m || {}).pos != null)))) add(pr(miss[k]), `${fm(miss[k], 0)}% das vacas cronometradas sem ${l} registrado (${m.nc} vacas).`, `Possível ${hip}.`, rec, { k: "miss_" + k, v: miss[k] });
  });
  const cs = m.cs, out = (k, lo, hi) => { const v = cs.filter(x => x[k] != null); return v.length ? v.filter(x => !inR(x[k], lo, hi)).length / v.length * 100 : null; };
  if (num(M.paMin) != null || num(M.paMax) != null) { const o = out("pa", M.paMin, M.paMax), lo = cs.filter(x => x.pa != null && num(M.paMin) != null && x.pa < num(M.paMin)).length; if (o) add(pr(o), `${fm(o, 0)}% das vacas com preparo até a colocação fora da meta (${M.paMin || "—"}–${M.paMax || "—"} s; média ${fm(m.pa, 0)} s).`, lo ? "Preparo curto pode significar estimulação insuficiente, atrasando a descida do leite e aumentando o tempo de ordenha." : "Preparo longo demais faz o efeito da ocitocina passar antes da colocação.", "Treinar a sequência de preparo e conferir o tempo até a colocação por ordenhador.", { k: "pa", v: m.pa }); }
  if (num(M.ctMin) != null) { const o = out("ct", M.ctMin, M.ctMax); if (o) add(pr(o), `${fm(o, 0)}% das vacas com contato do pré-dipping fora da meta (mín. ${M.ctMin} s; média ${fm(m.ct, 0)} s).`, "Tempo de contato insuficiente pode reduzir a ação do desinfetante.", "Respeitar o tempo de contato indicado pelo fabricante do produto antes de secar.", { k: "ct", v: m.ct }); }
  if (num(M.soMax) != null && m.so != null) { const o = out("so", null, M.soMax); if (o) { const ex = cs.filter(x => x.so != null && x.so > num(M.soMax)).reduce((a, x) => a + x.so - num(M.soMax), 0) / Math.max(1, cs.filter(x => x.so != null).length), vd = pos(f.milking) && pos(f.turns) ? f.milking * f.turns : null;
      add(pr(o), `${fm(o, 0)}% das vacas com sobreordenha acima do limite de ${M.soMax} s (média ${fm(m.so, 0)} s).`, "Possível retirada tardia: ajuste do retirador automático, atenção do ordenhador ou excesso de conjuntos por pessoa.", "Revisar a configuração do retirador automático e a rotina de retirada.", { k: "so", v: m.so });
      if (vd && ss.length >= 3) add("Baixa", `Estimativa: reduzir a sobreordenha ao limite economizaria cerca de ${fm(ex * vd / 60, 0)} min de conjunto acoplado por dia (${fm(ex, 0)} s × ${vd} ordenhas/dia, pelo cadastro).`, "Estimativa baseada nos testes do período e no rebanho cadastrado.", "Acompanhar o indicador de sobreordenha após o ajuste.", null); } }
  // diferenças entre turnos e entre ordenhadores (limite de diferença definido nas metas; padrão 20%)
  const cmp = (by, nome) => { const grp = {}; ss.forEach(s => (grp[by(s)] = grp[by(s)] || []).push(s)); const ks = Object.keys(grp).filter(k => grp[k].length >= 2); if (ks.length < 2) return;
    [["pa", "preparo até a colocação", "s"], ["so", "sobreordenha", "s"], ["vph", "vacas por hora", ""], ["oc", "quedas+reacoplamentos por 100 vacas", ""]].forEach(([k, l, u]) => {
      const v = ks.map(x => ({ x, v: met(grp[x])[k] })).filter(x => x.v != null); if (v.length < 2) return;
      const hi = v.reduce((a, b) => b.v > a.v ? b : a), lo = v.reduce((a, b) => b.v < a.v ? b : a); if (!lo.v || (hi.v - lo.v) / lo.v * 100 < dif) return;
      const nm = x => nome == "turno" ? TURNO[x] : x;
      add("Média", `Diferença de ${fm((hi.v - lo.v) / lo.v * 100, 0)}% em ${l} entre ${nome}s: ${nm(hi.x)} ${fm(hi.v, 0)}${u} × ${nm(lo.x)} ${fm(lo.v, 0)}${u}.`, k == "vph" ? "A diferença pode vir do lote, da equipe ou do número de conjuntos em uso, e não só da pessoa." : `Rotina diferente entre ${nome}s (equipe, lote, treinamento) ou condição diferente do equipamento.`, `Comparar a rotina dos ${nome}s e padronizar a melhor prática observada.`, { k, v: hi.v });
    }); };
  cmp(s => s.turn, "turno"); cmp(s => s.milker || "—", "ordenhador");
  // relações com outros setores (hipóteses)
  const g = gls(f), ccs = lastOf(anSeries("ccs")), cbt = lastOf(anSeries("cbt"));
  if (ccs && g.ccs != null && ccs.v > g.ccs && miss.pre > 0) add("Alta", `CCS ${fm(ccs.v, 0)} mil/mL acima da meta e ${fm(miss.pre, 0)}% das vacas sem pré-dipping registrado.`, "Falhas no preparo podem contribuir para novas infecções (relação possível, não comprovada pelos dados).", "Investigar casos de mastite e reforçar a rotina de preparo e de pós-dipping.", null);
  const bad = CYS().slice(-5).filter(c => cf(c, f, PRODS()).out.length);
  if (cbt && g.cbt != null && cbt.v > g.cbt && bad.length) add("Alta", `CBT ${fm(cbt.v, 0)} mil UFC/mL acima da meta e ${bad.length} das últimas lavagens CIP com item fora da faixa cadastrada.`, "Limpeza deficiente do equipamento é uma causa possível de CBT alta.", "Revisar temperatura, concentração e tempo do CIP (Setor 7).", null);
  const eqP = L("eq").map(e => { const d = lastOf(L("dx").filter(x => x.eid == e.id)); return d ? evalDx(d, e).probs.map(p => ({ e, p })) : []; }).flat();
  if (m.oc != null && m.oc > 0 && eqP.length) add("Média", `Há ${fm(m.oc, 1)} quedas/reacoplamentos por 100 vacas e ${eqP.length} problema(s) registrados nos equipamentos (ex.: ${eqP[0].p.t}).`, "Problemas de vácuo, pulsação ou teteiras podem aumentar quedas e reacoplamentos.", "Conferir os problemas do equipamento no Setor 2 antes de atribuir as quedas à rotina.", null);
  const lr = lastOf(L("tt").filter(t => t.tipo == "lr")); if (lr) { const s = lrStats(lr); if (s.r && s.out) add("Média", `Leite residual: ${s.out} de ${s.n} vacas acima da referência em ${fmtD(lr.date)}${lr.milker ? " (" + lr.milker + ")" : ""}.`, "Estimulação insuficiente ou retirada precoce podem deixar leite residual.", "Conferir preparo, tempo até a colocação e configuração da retirada.", null); }
  return F2.sort((a, b) => ["Alta", "Média", "Baixa"].indexOf(a.pri) - ["Alta", "Média", "Baixa"].indexOf(b.pri));
}
function findingCard(x, i, f) {
  return `<div class="alert ${PRI[x.pri]}" style="border-color:currentColor"><span style="color:var(--tx)"><b>${x.pri}</b> · <b>Fato medido:</b> ${E(x.fato)}<br><span class="mu"><b>Hipótese:</b> ${E(x.hip)}</span><br><span class="mu"><b>Recomendação:</b> ${E(x.rec)}</span>${f.demo ? "" : `<br><button class="btn s noprint" style="margin-top:6px" onclick="paFromFinding(${i})">+ Plano de melhoria</button>`}</span></div>`;
}
let LASTF = [];
function paFromFinding(i) { const x = LASTF[i]; if (!x) return; PAF = Object.assign(PAF0(), { desc: x.rec, s: "5", pri: x.pri, obs: "Origem: " + x.fato, kpi: x.kpi ? x.kpi.k : "", base: x.kpi ? String(+x.kpi.v.toFixed(1)) : "" }); PAE = null; V.r9v = "pa"; V.note = null; go("sector", V.f, 8); }
/* indicador atual de uma ação do plano de melhoria (para acompanhar o resultado) */
function paKpi(a) {
  if (!a.kpi) return ""; const m = met(SS().filter(s => s.date >= (a.date || ""))), miss = cowsMiss(SS().filter(s => s.date >= (a.date || "")));
  const cur = a.kpi.startsWith("miss_") ? miss[a.kpi.slice(5)] : m[a.kpi], lab = a.kpi.startsWith("miss_") ? "% sem " + a.kpi.slice(5) : (MET[a.kpi] || [a.kpi])[0];
  return `<br><span class="mu">Indicador: ${E(lab)} · antes ${E(a.base || "—")} → depois ${cur == null ? "sem novos testes" : fm(cur, 1)}</span>`;
}

/* ---------- telas do Setor 6 ---------- */
const O6 = [["cro", "⏱️ Registrar"], ["tur", "Turnos"], ["opr", "Ordenhadores"], ["dia", "Diagnóstico"], ["hi", "Histórico"], ["rl", "Relatório"]];
ord = function () {
  const f = F(), t = { cmp: "tur", gr: "tur", rk: "opr", calc: "cro" }[V.o] || V.o || "cro";
  const body = { cro: () => vCro() + `<details class="card"><summary><b>Calculadoras</b></summary>${(() => { const s = sector(1); return s.slice(s.indexOf('<div class="card"><b>Calculadoras')); })()}</details>`, tur: vTurnos, opr: vOps, dia: vDiag, hi: vHi, rl: vRl }[t] || vCro;
  return farmHead(f, "⏱️ Ordenha e ordenhadores", E(f.name)) + stBanner() + `<div class="tabs noprint">${O6.map(b => `<button class="tb ${t == b[0] ? "on" : ""}" onclick="V.o='${b[0]}';V.note=null;render()">${b[1]}</button>`).join("")}</div>`
    + (V.note ? `<div class="alert ${V.note.ok ? "ok" : "cr"}" style="border-color:currentColor"><span style="color:var(--tx)">${V.note.t}</span></div>` : "") + body();
};
function vTurnos() {
  const f = F(), ss = ssF(); if (!SS().length) return EMP;
  const T3 = [1, 2, 3].map(t => ({ t, m: met(ss.filter(s => s.turn == t)) })), has = T3.filter(x => x.m.n), M = rotMeta(f), qt = qualByTurn(f);
  const bars = (k, ref, refLab) => colChart(T3.map(x => ({ l: TURNO[x.t], v: x.m.n ? x.m[k] : null, c: TC[x.t] })), { u: MET[k][1], dec: MET[k][2], ref, refLab, label: MET[k][0] });
  const card = (k, ref, refLab) => `<div class="card"><b>${MET[k][0]}</b> <span class="mu">${MET[k][1]}</span>${bars(k, ref, refLab)}</div>`;
  const ek = V.oe || "vph";
  return filters() + (ss.length ? `<div class="ov card"><table><tr><th></th>${has.map(x => `<th style="color:${TC[x.t]}">${TURNO[x.t]}<br><span class="mu">${x.m.n} teste(s) · ${x.m.nc} vacas</span></th>`).join("")}</tr>${Object.keys(MET).map(k => `<tr><td>${MET[k][0]}</td>${has.map(x => `<td>${fm(x.m[k], MET[k][2])} ${x.m[k] == null ? "" : MET[k][1]}</td>`).join("")}</tr>`).join("")}<tr><td>Rotina completa</td>${has.map(x => `<td>${fm(x.m.rot, 0)}%</td>`).join("")}</tr>${qt ? `<tr><td>CCS média (análises do turno)</td>${has.map(x => `<td>${qt[x.t] ? fm(qt[x.t].ccs, 0) + ` <span class="mu">(${qt[x.t].n})</span>` : "—"}</td>`).join("")}</tr>` : ""}</table></div>
<div class="two">${card("lpt")}${card("vph")}${card("tpv")}${card("lv")}${card("pa", num(M.paMax), "máx.")}${card("so", num(M.soMax), "limite")}</div>
<div class="card"><div class="top"><b>Evolução por turno</b><span class="acts">${Object.entries(GRAN).map(([k, g]) => `<button class="tb ${(V.og || "w") == k ? "on" : ""}" onclick="V.og='${k}';render()">${g[0]}</button>`).join("")}</span></div><div class="tabs">${["vph", "lv", "pa", "so", "tpv"].map(k => `<button class="tb ${ek == k ? "on" : ""}" onclick="V.oe='${k}';render()">${MET[k][0]}</button>`).join("")}</div>${mchart(evol(ss, ek, s => s.turn).map(x => ({ n: TURNO[x.k], c: TC[x.k], pts: x.pts })), { dec: MET[ek][2], u: MET[ek][1], label: MET[ek][0] })}</div>
${qt ? "" : '<p class="mu">Qualidade por turno: informe o turno da coleta nas análises de leite (Setor 5) para comparar CCS entre turnos.</p>'}
<details class="card"><summary><b>Tabelas e gráficos anteriores</b> <span class="mu">(comparação com a manhã, tempos por etapa)</span></summary>${vCmp()}${vGr()}</details>` : '<div class="card mu">Nenhum teste no período/filtro escolhido.</div>');
}
function vOps() {
  const f = F(), ss = ssF(), R = rank2(ss, f), M = rotMeta(f), lots = new Set(ss.map(s => s.lot || "—"));
  const form = f.demo ? "" : `<div class="card"><b>${OPE ? "Editar ordenhador" : "Cadastrar ordenhador"}</b><div class="grid"><div><label>Nome</label><input value="${E(OPF.nome)}" oninput="OPF.nome=this.value"></div><div><label>Equipe</label><input list="dl-eqp" value="${E(OPF.equipe)}" oninput="OPF.equipe=this.value"></div></div>${opList()}<br><div class="acts"><button class="btn w" onclick="opSave()">${OPE ? "Salvar" : "Cadastrar"}</button>${OPE ? `<button class="btn gh w" onclick="OPE=null;OPF={nome:'',equipe:'',obs:''};render()">Cancelar</button>` : ""}</div></div>`;
  const ops = L("op"), cadastro = `<h2>Ordenhadores cadastrados (${ops.length})</h2>${ops.map(o => `<div class="card"><div class="top"><b>${E(o.nome)}</b>${o.demo ? '<span class="demo">DEMO</span>' : `<span class="acts"><button class="btn s" onclick="OPE='${o.id}';OPF={nome:${JSON.stringify(o.nome).replace(/"/g, "&quot;")},equipe:${JSON.stringify(o.equipe || "").replace(/"/g, "&quot;")},obs:''};render()">Editar</button><button class="btn s" onclick="opToggle('${o.id}')">${o.ativo === false ? "Reativar" : "Desativar"}</button></span>`}</div><p class="mu">${E(o.equipe || "sem equipe")} · ${SS().filter(s => s.milker == o.nome).length} teste(s)${o.ativo === false ? " · inativo" : ""}</p></div>`).join("") || '<p class="mu">Nenhum ordenhador cadastrado: os nomes digitados nos testes também aparecem nas sugestões.</p>'}`;
  const metas = [M.paMin, M.paMax, M.soMax, M.ctMin].some(x => num(x) != null);
  const rk = R.length ? R.map((r, i) => `<div class="card"><div class="top"><b>${i + 1}º ${E(r.n)}</b><b class="res">${r.sc == null ? "—" : fm(r.sc, 0) + " pts"}</b></div><p class="mu">${r.m.n} teste(s) · ${r.m.nc} vacas · ${fm(r.m.vph, 0)} vacas/h · preparo ${fm(r.m.pa, 0)} s · sobreordenha ${fm(r.m.so, 0)} s${r.m.nc < 10 ? ' · <span class="wa">amostra pequena</span>' : ""}</p><div class="dl" style="grid-template-columns:minmax(150px,auto) 1fr;font-size:13px">${RW.map(([k, l, w]) => `<dt>${l} <span class="mu">(${w})</span></dt><dd>${r.c[k] == null ? '<span class="mu">não avaliado</span>' : fm(r.c[k], 0) + "%"}</dd>`).join("")}</div></div>`).join("") : '<div class="card mu">Sem testes no filtro escolhido.</div>';
  const pa = V.opa || "", pb = V.opb || "", sel = opNames()[0] || "", who = V.opw || sel;
  const perM = (from, to) => met(SS().filter(s => s.milker == who && (!from || s.date >= from) && (!to || s.date <= to)));
  const A = perM(pa, V.opa2), B = perM(pb, V.opb2);
  return filters() + (lots.size > 1 ? `<div class="alert wa" style="border-color:currentColor"><span style="color:var(--tx)">Os testes envolvem lotes diferentes (${[...lots].map(E).join(", ")}): parte das diferenças pode ser do lote, não da pessoa.</span></div>` : "")
    + `<h2>Ranking de eficiência</h2><div class="card"><b>Pontuação por componente</b>${colChart(R.slice(0, 8).map(r => ({ l: r.n.length > 12 ? r.n.slice(0, 11) + "…" : r.n, v: r.sc })), { u: "pts", label: "Ranking" })}<p class="mu">Pontuação = média ponderada dos componentes avaliados (pesos entre parênteses). Rotina, preparo e sobreordenha pesam mais que velocidade: ordenhar rápido sem cumprir a rotina não sobe no ranking. ${metas ? `Metas usadas: ${E(M.fonte || "definidas pelo usuário")}.` : "Sem metas da rotina, só rotina, ocorrências e produtividade são avaliadas: cadastre as metas na aba Diagnóstico."}</p></div>${rk}
<h2>Comparar o mesmo ordenhador em dois períodos</h2><div class="card"><div class="grid"><div style="grid-column:1/-1"><label>Ordenhador</label><select onchange="V.opw=this.value;render()">${opNames().map(n => `<option ${who == n ? "selected" : ""}>${E(n)}</option>`).join("")}</select></div><div><label>Período A: de</label><input type="date" value="${E(pa)}" onchange="V.opa=this.value;render()"></div><div><label>até</label><input type="date" value="${E(V.opa2 || "")}" onchange="V.opa2=this.value;render()"></div><div><label>Período B: de</label><input type="date" value="${E(pb)}" onchange="V.opb=this.value;render()"></div><div><label>até</label><input type="date" value="${E(V.opb2 || "")}" onchange="V.opb2=this.value;render()"></div></div><div class="ov"><table><tr><th></th><th>A</th><th>B</th><th>Δ</th></tr>${["vph", "lv", "pa", "ct", "so", "oc"].map(k => `<tr><td>${MET[k][0]}</td><td>${fm(A[k], MET[k][2])}</td><td>${fm(B[k], MET[k][2])}</td><td>${dl(A[k], B[k], MET[k][2])}</td></tr>`).join("")}<tr><td>Rotina completa (%)</td><td>${fm(A.rot, 0)}</td><td>${fm(B.rot, 0)}</td><td>${dl(A.rot, B.rot, 0)}</td></tr><tr><td>Testes / vacas</td><td>${A.n} / ${A.nc}</td><td>${B.n} / ${B.nc}</td><td></td></tr></table></div></div>
<h2>Equipes</h2><div class="card">${colChart(rank2(ss, f, s => s.equipe || "sem equipe").map(r => ({ l: r.n, v: r.sc })), { u: "pts", label: "Equipes" })}</div>` + form + cadastro;
}
function rotSet(k, v) { const o = DB.gl[V.f] = DB.gl[V.f] || {}; o.rot = Object.assign({}, o.rot, { [k]: String(v).replace(/[<>]/g, "").slice(0, 200) }); svD(); }
function vDiag() {
  const f = F(), ss = ssF(), M = rotMeta(f), m = met(ss), L2 = routineFindings(ss, f); LASTF = L2;
  const vh = m.vph, nc = (L("eq")[0] || {}).nc;
  const inp = (k, l) => `<div><label>${l}</label><input inputmode="decimal" ${f.demo ? "disabled" : ""} value="${E(M[k] || "")}" onchange="rotSet('${k}',this.value);render()"></div>`;
  return filters() + `<div class="card"><b>Indicadores da rotina no filtro</b><div class="kgrid" style="margin-top:8px">${[["vph", vh], ["tpv", m.tpv], ["pa", m.pa], ["ct", m.ct], ["fl", m.fl], ["so", m.so], ["rp", m.rp], ["oc", m.oc]].map(([k, v]) => `<div class="kc"><span class="kl">${MET[k][0]}</span>${v == null ? '<span class="kv sd">Sem dados</span>' : `<span class="kv">${fm(v, MET[k][2])} <small>${MET[k][1]}</small></span>`}</div>`).join("")}<div class="kc"><span class="kl">Capacidade observada</span>${vh != null && pos(num(nc)) ? `<span class="kv">${fm(vh / num(nc), 1)} <small>vacas/h por conjunto</small></span><span class="ks">${E(nc)} conjuntos (Setor 2)</span>` : '<span class="kv sd">Sem dados</span><span class="ks">precisa de testes com duração e do nº de conjuntos</span>'}</div><div class="kc"><span class="kl">Permanência média na ordenha</span>${m.n ? `<span class="kv">${fm(mean(ss.filter(s => s.dur).map(s => num(s.dur))), 0)} <small>min por ordenha</small></span>` : '<span class="kv sd">Sem dados</span>'}</div></div></div>
<div class="card"><b>Tempo médio por etapa (s)</b>${colChart([["pa", "Preparo"], ["ct", "Pré-dip"], ["fl", "Fluxo"], ["so", "Sobreord."], ["rp", "Pós-dip"]].map(([k, l]) => ({ l, v: m[k] })), { u: "s", label: "Etapas" })}</div>
<h2>Gargalos e oportunidades</h2>${L2.length ? L2.map((x, i) => findingCard(x, i, f)).join("") : '<div class="card mu">Nenhum ponto identificado com os dados e metas atuais.</div>'}
<p class="mu">Análise automática por regras, feita no aparelho (sem IA generativa e sem internet). Fatos vêm dos testes; hipóteses são possibilidades a investigar; a prioridade é uma sugestão do app.</p>
<div class="card"><b>Metas da rotina desta fazenda</b><p class="mu">Defina as metas com base em uma fonte (manual, recomendação técnica, protocolo da fazenda). O app não traz valores prontos.${f.demo ? " Na fazenda demo, as metas são fictícias." : ""}</p><div class="grid">${inp("paMin", "Preparo até a colocação — mín. (s)")}${inp("paMax", "Preparo até a colocação — máx. (s)")}${inp("ctMin", "Contato do pré-dipping — mín. (s)")}${inp("soMax", "Sobreordenha — máx. (s)")}${inp("dif", "Diferença relevante entre turnos (%)")}</div><label>Fonte das metas</label><input ${f.demo ? "disabled" : ""} value="${E(M.fonte || "")}" onchange="rotSet('fonte',this.value);render()"></div>`;
}

/* ---------- assistente técnico da fazenda (regras, offline) ---------- */
function assist(f) {
  return withFarm(f.id, () => {
    const out = [], A = falerts(f);
    A.filter(a => a.l == "cr" || a.l == "wa").slice(0, 6).forEach(a => out.push({ pri: a.l == "cr" ? "Alta" : "Média", fato: a.t, hip: "", rec: "", s: a.s, tab: a.tab, eid: a.eid }));
    // tendência de qualidade (3 últimas análises × 3 anteriores)
    const g = gls(f), a = QA();
    ["ccs", "cbt"].forEach(k => { const t = qtr(a, k); if (t && t.ch > 0 && g[k] != null && t.l > g[k] * .9) out.push({ pri: t.l > g[k] ? "Alta" : "Média", fato: `${k.toUpperCase()} subiu ${fm(t.ch, 0)}% (média das 3 últimas análises: ${fm(t.l, 0)}; meta ${fm(g[k], 0)}).`, hip: k == "ccs" ? "Possível aumento de infecções intramamárias: rotina de preparo, equipamento (vácuo/pulsação, teteiras) ou manejo de vacas com mastite." : "Possível falha de limpeza (CIP), resfriamento ou higiene na ordenha.", rec: k == "ccs" ? "Conferir rotina de preparo, situação do equipamento e casos clínicos; fazer CMT ou análise individual." : "Conferir as últimas lavagens CIP, a temperatura do tanque e a higiene dos conjuntos.", s: 4, tab: "ev" }); });
    routineFindings(SS(), f).slice(0, 4).forEach(x => out.push(Object.assign({ s: 5, tab: "dia" }, x)));
    const seen = new Set(); return out.filter(x => !seen.has(x.fato) && seen.add(x.fato)).sort((a, b) => ["Alta", "Média", "Baixa"].indexOf(a.pri) - ["Alta", "Média", "Baixa"].indexOf(b.pri));
  });
}
function assistCard(f, max = 5) {
  const X = assist(f); if (!X.length) return "";
  return `<div class="card"><div class="top"><b>🧭 Assistente técnico</b><span class="mu">análise automática por regras · offline</span></div>${X.slice(0, max).map(x => `<div class="alert ${PRI[x.pri]} tap" style="border-color:currentColor" onclick="goTab(${x.s},'${x.tab || ""}','${f.id}'${x.eid ? `,'${x.eid}'` : ""})"><span style="color:var(--tx)"><b>${x.pri}</b> · ${E(x.fato)}${x.hip ? `<br><span class="mu"><b>Hipótese:</b> ${E(x.hip)}</span>` : ""}${x.rec ? `<br><span class="mu"><b>Recomendação:</b> ${E(x.rec)}</span>` : ""}</span></div>`).join("")}${X.length > max ? `<p class="mu">+ ${X.length - max} ponto(s) no relatório da visita (Setor 9).</p>` : ""}<p class="mu">Separa fatos medidos, hipóteses e recomendações. Não é IA generativa: usa só os seus registros, metas e referências verificadas.</p></div>`;
}
/* resumo em linguagem simples para o produtor (usado no relatório da visita) */
function producerSummary(f) {
  const ss = allStat(f), good = ss.map((s, i) => ({ s, i })).filter(x => x.s.st == "ok").map(x => SECT[x.i][1]), X = assist(f).slice(0, 3), open = L("pa").filter(a => a.st != "Concluída").slice(0, 3);
  return `<div class="card" style="border-width:2px"><b>Resumo para o produtor</b><ul>${good.length ? `<li><b>Em dia:</b> ${good.map(E).join(", ")}.</li>` : ""}${X.length ? `<li><b>Precisa de atenção:</b> ${X.map(x => E(x.fato)).join(" ")}</li>` : "<li>Nenhum ponto de atenção identificado nos registros.</li>"}${open.length ? `<li><b>Próximos passos:</b> ${open.map(a => E(a.desc) + (a.prazo ? " (até " + fmtD(a.prazo) + ")" : "")).join("; ")}.</li>` : ""}</ul></div>`;
}
