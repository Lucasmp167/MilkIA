/* ===== Etapa 1: Central da Fazenda, indicadores reais, status e alertas =====
 * Tudo aqui é calculado a partir dos registros salvos (DB) — ou, nas fazendas de demonstração,
 * dos registros DEMO gerados pelo código, sempre marcados como tal. Nenhum número é fixo.
 * Quando não há registro, o painel mostra "Sem dados".
 *
 * Várias funções antigas (QA, SS, L, cls, planSt, cf...) leem a fazenda atual em V.f.
 * withFarm(id, fn) troca V.f só durante o cálculo, para avaliar qualquer fazenda sem misturar dados.
 */
ST.sd = "Sem dados"; ST.in = "Registrado";
const RANK = { cr: 4, wa: 3, ok: 2, in: 1, na: 1, sd: 0 };
const TABKEY = { 1: "e2t", 2: "i3v", 3: "t4v", 4: "q", 5: "o", 6: "c", 7: "m8" }; // aba ativa de cada setor com abas

function withFarm(id, fn) { const old = V.f; V.f = id; try { return fn(); } finally { V.f = old; } }
const fmtD = d => d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—";
const lastOf = a => a.length ? a[a.length - 1] : null;
const eqt = e => e ? [e.fab, e.mod].filter(Boolean).join(" ") + (e.ser ? " #" + e.ser : "") : "—";
const realFarms = () => farms.filter(f => !f.demo), demoFarms = () => farms.filter(f => f.demo);
const pos = v => typeof v == "number" && isFinite(v) && v > 0;

/* Abre um setor já na aba certa (menos cliques). */
function goTab(s, tab, fid, eid) { if (TABKEY[s] && tab) V[TABKEY[s]] = tab; if (s == 2) V.i3 = eid || null; else if (s == 3) V.t4 = eid || null; else if (eid) { V.e2 = eid; V.me = eid; } else if (s == 1) V.e2 = null; V.e2edit = false; V.note = null; go("sector", fid || V.f, s); }

/* Série de um parâmetro de análise de leite: [{d, v}] em ordem de data. */
function anSeries(k) { return QA().filter(x => x[k] != null && !isNaN(x[k])).map(x => ({ d: x.date, v: x[k] })); }

/* ---------- status de cada setor ---------- */
const S1REQ = [["producer", "produtor"], ["city", "cidade"], ["cows", "vacas no rebanho"], ["milking", "vacas em lactação"], ["liters", "produção diária"]];
const SSTAT = [
  /* 1 Cadastro */ f => {
    const miss = S1REQ.filter(([k]) => typeof f[k] == "number" ? !(f[k] > 0) : !f[k] || f[k] == "—").map(x => x[1]);
    return miss.length ? { st: "wa", lab: "Incompleto", t: "Falta: " + miss.join(", ") } : { st: "ok", lab: "Completo", t: `${f.cows} vacas · ${f.milking} em lactação · ${fm(f.liters, 0)} L/dia` };
  },
  /* 2 Ordenhadeiras — pior situação entre os equipamentos (última medição de cada um) */ () => {
    const es = L("eq"); if (!es.length) return { st: "sd", t: "Nenhum equipamento cadastrado" };
    const ss = es.map(estat), w = ss.reduce((a, s) => RANK[s.st] > RANK[a.st] ? s : a, { st: "sd" });
    const nm = ss.filter(s => s.lab == "Sem medição").length, np = ss.filter(s => s.st == "cr" || s.st == "wa").length;
    const t = `${es.length} equipamento(s)${np ? ` · ${np} com problema` : ""}${nm ? ` · ${nm} sem medição` : ""}`;
    return w.st == "cr" || w.st == "wa" || w.st == "ok" ? { st: w.st, t } : { st: "in", lab: "Cadastrado", t };
  },
  /* 3 ISO Check — última auditoria de cada equipamento */ () => {
    const es = L("eq"), au = es.map(e => ({ e, a: lastOf(isoOf(e.id)) })).filter(x => x.a);
    if (!au.length) return { st: "sd", t: es.length ? "Nenhuma auditoria registrada" : "Cadastre um equipamento para auditar" };
    const ev = au.map(x => evalIso(x.a, x.e)), w = ev.reduce((a, s) => RANK[s.st] > RANK[a] ? s.st : a, "sd"), last = au.map(x => x.a.date).sort().pop();
    return { st: w == "sd" ? "na" : w, lab: w == "na" || w == "sd" ? "Sem referência" : undefined, t: `${au.length} equipamento(s) auditado(s) · última em ${fmtD(last)} · ${ev.reduce((a, x) => a + x.nf, 0)} ensaio(s) fora` };
  },
  /* 4 Testes técnicos — último teste de leite residual */ () => {
    const all = L("tt"); if (!all.length) return { st: "sd", t: "Nenhum teste técnico registrado" };
    const lr = lastOf(all.filter(t => t.tipo == "lr")); if (!lr) return { st: "in", t: `${all.length} teste(s) · último ${fmtD(lastOf(all).date)}` };
    const s = lrStats(lr), t = `Leite residual ${fmtD(lr.date)}: média ${fm(s.mean, 0)} mL · ${s.n} vaca(s)`;
    return s.r ? { st: s.out ? "wa" : "ok", t: t + (s.out ? ` · ${s.out} acima da referência` : " · dentro da referência") } : { st: "in", lab: "Sem referência", t };
  },
  /* 5 Qualidade */ f => {
    const a = QA(), ts = QT(); if (!a.length && !ts.length) return { st: "sd", t: "Nenhuma análise ou avaliação de tetos" };
    const g = gls(f), c = lastOf(anSeries("ccs")), b = lastOf(anSeries("cbt")), la = lastOf(a);
    const t = la ? `Última análise ${fmtD(la.date)} · CCS ${c ? fm(c.v, 0) : "—"} · CBT ${b ? fm(b.v, 0) : "—"}` : `${ts.length} avaliação(ões) de tetos`;
    if (g.ccs == null && g.cbt == null) return { st: "na", lab: "Sem meta", t: t + " · defina metas no cadastro" };
    const over = (c && g.ccs != null && c.v > g.ccs) || (b && g.cbt != null && b.v > g.cbt);
    if (!c && !b) return { st: "na", t };
    return { st: over ? "wa" : "ok", t: t + (over ? " · acima da meta" : " · dentro da meta") };
  },
  /* 6 Ordenha */ () => {
    const ss = SS(); if (!ss.length) return { st: "sd", t: "Nenhum teste de ordenha cronometrado" };
    const l = lastOf(ss); return { st: "in", t: `${ss.length} teste(s) · último ${fmtD(l.date)}, ${l.turn}ª ordenha` };
  },
  /* 7 CIP */ f => {
    const cy = CYS(), wa = WAS(), P = PRODS(); if (!cy.length && !wa.length && !P.length) return { st: "sd", t: "Nenhuma lavagem, produto ou análise de água" };
    const low = P.filter(p => num(p.estmin) != null && stock(p) <= num(p.estmin)).length, s = cstat(f);
    const l5 = cy.slice(-5).map(c => cf(c, f, P)), fl = l5.filter(x => x.out.length).length;
    const t = (cy.length ? `Última lavagem ${fmtD(lastOf(cy).date)} · ${l5.some(x => x.ev) ? fl + " de " + l5.length + " com item fora da faixa" : "sem faixa cadastrada"}` : "Sem lavagens") + (low ? ` · ${low} produto(s) com estoque baixo` : "");
    const st = low && (!s || s == "ok" || s == "na") ? "wa" : s || "na";
    return { st, t };
  },
  /* 8 Manutenção */ () => {
    const a = allPl(), es = L("eq"); if (!a.length) return { st: "sd", t: es.length ? `${es.length} equipamento(s), nenhum plano de revisão` : "Nenhum plano de revisão" };
    const c = s => a.filter(x => x.st.s == s).length;
    const st = c("atrasada") ? "cr" : c("próxima") ? "wa" : c("em dia") ? "ok" : "na";
    return { st, t: `${c("atrasada")} atrasada(s) · ${c("próxima")} próxima(s) · ${c("em dia")} em dia` };
  },
  /* 9 Documentos */ () => {
    const has = [["Qualidade", QA().length || QT().length], ["Ordenha", SS().length], ["CIP", CYS().length], ["Manutenção", L("eq").length]].filter(x => x[1]).map(x => x[0]);
    return has.length ? { st: "in", lab: "Disponível", t: "Relatórios: " + has.join(", ") } : { st: "sd", t: "Nenhum relatório disponível ainda" };
  }];
function sstat(f, i) {
  return withFarm(f.id, () => { try { const r = SSTAT[i](f); r.lab = r.lab || ST[r.st]; return r; } catch (e) { return { st: "na", lab: ST.na, t: "Não foi possível calcular" }; } });
}
const allStat = f => SECT.map((_, i) => sstat(f, i));
function overall(ss) {
  const w = ss.reduce((a, s) => RANK[s.st] > RANK[a] ? s.st : a, "sd");
  return w == "cr" ? { st: "cr", lab: "Crítico" } : w == "wa" ? { st: "wa", lab: "Requer atenção" } : w == "ok" ? { st: "ok", lab: "Em dia" } : { st: "sd", lab: "Sem avaliação" };
}
const badge = s => `<span class="badge ${s.st}">${E(s.lab || ST[s.st])}</span>`;

/* ---------- alertas calculados ---------- */
function falerts(f) {
  return withFarm(f.id, () => {
    const A = [], add = (l, t, s, tab) => A.push({ l, t, s, tab }), g = gls(f);
    try {
      [["ccs", "CCS", "mil/mL"], ["cbt", "CBT", "mil UFC/mL"]].forEach(([k, lab, u]) => {
        const s = anSeries(k), x = lastOf(s); if (!x || g[k] == null || x.v <= g[k]) return;
        const run = s.slice().reverse().findIndex(p => p.v <= g[k]), n = run < 0 ? s.length : run;
        add(n >= 3 ? "cr" : "wa", `${lab} ${fm(x.v, 0)} ${u} em ${fmtD(x.d)}, acima da meta de ${fm(g[k], 0)}${n > 1 ? ` (${n} análises seguidas)` : ""}`, 4, "in");
      });
      if (QA().length && g.ccs == null && g.cbt == null) add("in", "Há análises de leite, mas nenhuma meta de CCS/CBT: defina no cadastro da fazenda para avaliar", 4, "in");
      allPl().forEach(x => {
        if (x.st.s == "atrasada") add("cr", `Revisão atrasada: ${x.p.nome} — ${eqt(x.e)} (${fm(Math.abs(x.st.w.left), 0)} ${x.st.w.lab} de atraso)`, 7, "mt");
        else if (x.st.s == "próxima") add("wa", `Revisão próxima: ${x.p.nome} — ${eqt(x.e)} (faltam ${fm(x.st.w.left, 0)} ${x.st.w.lab})`, 7, "mt");
      });
      const cy = CYS(), P = PRODS();
      const bad = cy.slice(-5).filter(c => cf(c, f, P).out.length);
      if (bad.length) add("wa", `${bad.length} das últimas ${Math.min(5, cy.length)} lavagens CIP com item fora da faixa cadastrada (última em ${fmtD(lastOf(bad).date)})`, 6, "cy");
      P.filter(p => num(p.estmin) != null && stock(p) <= num(p.estmin)).forEach(p => add("wa", `Estoque baixo de ${p.nome}: ${fm(stock(p), 1)} ${p.un || ""}`, 6, "pq"));
      L("eq").forEach(e => { const a = lastOf(isoOf(e.id)); if (a) evalIso(a, e).probs.forEach(p => A.push({ l: p.g == "Alta" ? "cr" : "wa", t: `ISO Check ${eqt(e)} (${fmtD(a.date)}): ${p.t}`, s: 2, tab: "list", eid: a.id })); });
      L("eq").forEach(e => {
        const d = lastOf(L("dx").filter(x => x.eid == e.id)); if (!d) return;
        evalDx(d, e).probs.forEach(p => A.push({ l: p.g == "Alta" ? "cr" : "wa", t: `${eqt(e)} (${fmtD(d.date)}): ${p.t}`, s: 1, tab: "med", eid: e.id }));
      });
    } catch (e) { add("wa", "Não foi possível calcular todos os alertas desta fazenda", 0); }
    return A.sort((a, b) => (RANK[b.l] || 0) - (RANK[a.l] || 0));
  });
}
function alertList(f, max) {
  const A = falerts(f), sh = max ? A.slice(0, max) : A;
  if (!A.length) return '<div class="card mu">Nenhum alerta com base nos registros desta fazenda.</div>';
  return `<div class="alist">${sh.map(a => `<div class="alert ${a.l}" style="border-color:currentColor" onclick="goTab(${a.s},'${a.tab || ""}','${f.id}'${a.eid ? `,'${a.eid}'` : ""})"><span style="color:var(--tx)">${E(a.t)}</span><span class="go">Setor ${a.s + 1} ›</span></div>`).join("")}${max && A.length > max ? `<p class="mu">+ ${A.length - max} alerta(s). <button class="btn s" onclick="go('kpi','${f.id}')">Ver todos</button></p>` : ""}</div>`;
}

/* ---------- indicadores (KPIs) reais ---------- */
function fkpi(f) {
  return withFarm(f.id, () => {
    const g = gls(f), K = [], ss = SS();
    const an = (k, lab, u, d, goal) => {
      const s = anSeries(k), x = lastOf(s);
      K.push({ lab, u, v: x ? fm(x.v, d) : null, src: x ? `análise de ${fmtD(x.d)}${goal != null ? " · meta " + fm(goal, 0) : ""}` : "nenhuma análise", c: x && goal != null ? (x.v <= goal ? "ok" : "wa") : "", sp: s.slice(-12).map(p => p.v) });
    };
    an("ccs", "CCS", "mil/mL", 0, g.ccs); an("cbt", "CBT", "mil UFC/mL", 0, g.cbt);
    const sl = [...ss].reverse().find(s => s.vacas && s.litros), sh = [...ss].reverse().find(s => s.dur && s.litros);
    const lvS = ss.filter(s => s.vacas && s.litros).map(s => s.litros / s.vacas), lhS = ss.filter(s => s.dur && s.litros).map(s => s.litros / s.dur * 60);
    K.push(sl ? { lab: "Litros/vaca", u: "L", v: fm(sl.litros / sl.vacas, 1), src: `teste de ordenha ${fmtD(sl.date)}`, sp: lvS.slice(-12) }
      : pos(f.liters) && pos(f.milking) ? { lab: "Litros/vaca", u: "L/dia", v: fm(f.liters / f.milking, 1), src: "informado no cadastro" } : { lab: "Litros/vaca", v: null, src: "sem teste nem cadastro" });
    K.push(sh ? { lab: "Litros/hora", u: "L/h", v: fm(sh.litros / sh.dur * 60, 0), src: `teste de ordenha ${fmtD(sh.date)}`, sp: lhS.slice(-12) }
      : pos(f.liters) && pos(f.hours) && f.hoursSet ? { lab: "Litros/hora", u: "L/h", v: fm(f.liters / f.hours, 0), src: "informado no cadastro" } : { lab: "Litros/hora", v: null, src: "nenhum teste de ordenha" });
    K.push(pos(f.liters) ? { lab: "Produção diária", u: "L", v: fm(f.liters, 0), src: "informado no cadastro" } : { lab: "Produção diária", v: null, src: "não informada no cadastro" });
    K.push(pos(f.milking) ? { lab: "Vacas em lactação", v: fm(f.milking, 0), src: pos(f.cows) ? `de ${fm(f.cows, 0)} no rebanho` : "informado no cadastro" } : { lab: "Vacas em lactação", v: null, src: "não informado no cadastro" });
    an("gor", "Gordura", "%", 2); an("pro", "Proteína", "%", 2);
    const hk = qhk(f.id), h = lastOf(hk);
    K.push(h ? { lab: "Tetos escore ≥3", u: "%", v: fm(h[1], 0), src: `avaliação manual ${fmtD(h[0])} · ${h[2]} quartos`, sp: hk.slice(-12).map(x => x[1]) } : { lab: "Tetos escore ≥3", v: null, src: "nenhuma avaliação" });
    const pl = allPl(), at = pl.filter(x => x.st.s == "atrasada").length;
    K.push(pl.length ? { lab: "Revisões atrasadas", v: String(at), c: at ? "cr" : "ok", src: `de ${pl.length} plano(s) de revisão` } : { lab: "Revisões atrasadas", v: null, src: "nenhum plano de revisão" });
    return K;
  });
}
function spark(v) {
  if (v.length < 2) return "";
  const mx = Math.max(...v), mn = Math.min(...v), W = 100, H = 22, X = i => i * W / (v.length - 1), Y = x => H - 2 - (x - mn) / (mx - mn || 1) * (H - 4);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="var(--pr)" stroke-width="1.6" vector-effect="non-scaling-stroke" points="${v.map((x, i) => X(i).toFixed(1) + "," + Y(x).toFixed(1)).join(" ")}"/></svg>`;
}
function kpiGrid(K) {
  return `<div class="kgrid">${K.map(k => `<div class="kc"><span class="kl">${E(k.lab)}</span>${k.v == null ? '<span class="kv sd">Sem dados</span>' : `<span class="kv ${k.c || ""}">${E(k.v)}${k.u ? ` <small>${E(k.u)}</small>` : ""}</span>`}<span class="ks" title="${E(k.src)}">${E(k.src)}</span>${k.sp ? spark(k.sp) : ""}</div>`).join("")}</div>`;
}

/* ---------- gráfico temporal com eixos, datas e meta ---------- */
function tchart(pts, o = {}) {
  pts = pts.filter(p => p.v != null && !isNaN(p.v));
  if (!pts.length) return '<p class="mu">Sem dados.</p>';
  const W = 640, H = 210, L0 = 46, R0 = 14, T0 = 14, B0 = 28, vs = pts.map(p => p.v).concat([o.goal, o.lo, o.hi].filter(x => x != null && !isNaN(x)));
  let mx = Math.max(...vs), mn = Math.min(...vs); const pad = (mx - mn) * .12 || Math.abs(mx) * .1 || 1; mx += pad; mn = Math.max(o.zero === false ? mn - pad : 0, mn - pad);
  const X = i => L0 + (pts.length == 1 ? (W - L0 - R0) / 2 : i * (W - L0 - R0) / (pts.length - 1)), Y = v => T0 + (mx - v) / (mx - mn || 1) * (H - T0 - B0), d = o.dec || 0;
  const yt = [mn, (mn + mx) / 2, mx].map(v => `<line class="ax" x1="${L0}" x2="${W - R0}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L0 - 6}" y="${Y(v) + 4}" text-anchor="end">${fm(v, d)}</text>`).join("");
  const xi = [...new Set([0, Math.floor((pts.length - 1) / 2), pts.length - 1])];
  const xt = xi.map(i => `<text x="${X(i)}" y="${H - 8}" text-anchor="${pts.length == 1 ? "middle" : i == 0 ? "start" : i == pts.length - 1 ? "end" : "middle"}">${fmtD(pts[i].d).slice(0, 5)}${i == pts.length - 1 || i == 0 ? "/" + String(pts[i].d).slice(2, 4) : ""}</text>`).join("");
  const gl = o.goal != null ? `<line class="gl" x1="${L0}" x2="${W - R0}" y1="${Y(o.goal)}" y2="${Y(o.goal)}"/><text x="${W - R0}" y="${Y(o.goal) - 5}" text-anchor="end" style="fill:var(--wa)">meta ${fm(o.goal, d)}</text>` : "";
  const band = [["lo", "mín."], ["hi", "máx."]].filter(([k]) => o[k] != null && !isNaN(o[k])).map(([k, l]) => `<line class="gl" x1="${L0}" x2="${W - R0}" y1="${Y(o[k])}" y2="${Y(o[k])}"/><text x="${L0 + 4}" y="${Y(o[k]) - 5}" style="fill:var(--wa)">${l} ${fm(o[k], d)}</text>`).join("");
  const out = p => (o.lo != null && p.v < o.lo) || (o.hi != null && p.v > o.hi) || (o.goal != null && p.v > o.goal);
  const c = o.color || "var(--pr)", ln = pts.length > 1 ? `<polyline fill="none" stroke="${c}" stroke-width="2.4" stroke-linejoin="round" points="${pts.map((p, i) => X(i) + "," + Y(p.v)).join(" ")}"/>` : "";
  const dots = pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.v)}" r="${pts.length > 30 ? 2 : 3.2}" fill="${out(p) ? "var(--wa)" : c}"><title>${fmtD(p.d)}: ${fm(p.v, d)}${o.u ? " " + o.u : ""}</title></circle>`).join("");
  const l = lastOf(pts);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${E(o.label || "gráfico")}">${yt}${gl}${band}${ln}${dots}${xt}<text x="${X(pts.length - 1)}" y="${Y(l.v) - 8}" text-anchor="end" style="fill:var(--tx);font-weight:700">${fm(l.v, d)}</text></svg>`;
}
const chartCard = (t, sub, svg) => `<div class="card"><div class="top"><b>${t}</b><span class="mu">${sub || ""}</span></div>${svg}</div>`;

/* ---------- telas ---------- */
const demoNote = f => f.demo ? '<div class="banner"><b>Fazenda de demonstração.</b> Todos os registros desta fazenda são fictícios (marcados DEMO), ficam separados dos seus dados e nunca entram no backup como dados reais.</div>' : "";
function farmHead(f, title, sub) {
  return `<div class="pagehead"><div style="min-width:0"><div class="crumb"><button onclick="go('home')">Fazendas</button>${title ? ` › <button onclick="go('farm','${f.id}')">${E(f.name)}</button>` : ""}</div><h1>${title || E(f.name)} ${f.demo ? '<span class="demo">DEMONSTRAÇÃO</span>' : ""}</h1><div class="mu">${sub != null ? sub : E(f.producer) + " · " + E(f.city)}</div></div></div>`;
}

function farmCard(f) {
  const ss = allStat(f), o = overall(ss), A = falerts(f), c = withFarm(f.id, () => lastOf(anSeries("ccs")));
  const crit = A.filter(a => a.l == "cr").length;
  return `<div class="card tap fcard" data-s="${E((f.name + " " + f.producer + " " + f.city).toLowerCase())}" onclick="go('farm','${f.id}')">
<div class="top"><b style="font-size:17px">${E(f.name)}</b><span class="acts">${f.demo ? '<span class="demo">DEMO</span>' : ""}${badge(o)}</span></div>
<div class="mu">${E(f.producer)} · ${E(f.city)}</div>
<div class="meta"><span class="mu">Última CCS <b style="color:var(--tx)">${c ? fm(c.v, 0) : "Sem dados"}</b></span><span class="mu">Alertas <b class="${crit ? "cr" : A.length ? "wa" : ""}">${A.length}</b></span><span class="mu">Lactação <b style="color:var(--tx)">${pos(f.milking) ? f.milking : "—"}</b></span></div>
<div class="dots" title="Status dos 9 setores">${ss.map((s, i) => `<span class="dot ${s.st}" title="${i + 1}. ${E(SECT[i][1])}: ${E(s.lab)}"></span>`).join("")}</div></div>`;
}
function hfilter(q) { q = q.toLowerCase(); document.querySelectorAll(".fcard").forEach(c => c.style.display = !q || c.dataset.s.includes(q) ? "" : "none"); }

function home() {
  const R = realFarms(), D = demoFarms();
  return installCard() + `<div class="pagehead"><div><h1>Fazendas</h1><div class="mu">${R.length ? R.length + " fazenda(s) cadastrada(s)" : "Nenhuma fazenda cadastrada"}</div></div><button class="btn w" onclick="newFarm()">+ Cadastrar fazenda</button></div>`
    + (farms.length > 4 ? `<input class="search" type="search" placeholder="Buscar fazenda, produtor ou cidade" oninput="hfilter(this.value)">` : "")
    + "<h2>Minhas fazendas</h2>"
    + (R.length ? `<div class="two">${R.map(farmCard).join("")}</div>` : `<div class="card empty"><div class="big">🏡</div><b>Cadastre sua primeira fazenda</b><p class="mu">Cada fazenda tem sua própria Central com os 9 setores. Os dados ficam separados por fazenda.</p><br><button class="btn w" onclick="newFarm()">+ Cadastrar fazenda</button></div>`)
    + `<h2>Fazendas de demonstração</h2><div class="banner">Dados fictícios para conhecer o app, marcados como DEMO. Ficam isolados dos seus dados reais e nunca entram no backup como dados reais.</div><div class="two">${D.map(farmCard).join("")}</div>`
    + `<div class="banner">Os dados ficam neste navegador e neste aparelho (sem sincronização). Faça backups em <b>Dados</b>. Esta versão não faz análise automática por IA.</div>`;
}

const QUICK = [["🥛", "Análise de leite", 4, "an"], ["⏱️", "Teste de ordenha", 5, "cro"], ["🧼", "Lavagem CIP", 6, "cy"], ["🛠️", "Manutenção", 7, "mt"], ["⚙️", "Medição de equipamento", 1, "med"], ["📏", "Auditoria ISO", 2, "form"], ["🔧", "Leite residual", 3, "form"]];
function farm() {
  const f = F(), ss = allStat(f), o = overall(ss);
  return `<div class="pagehead"><div style="min-width:0"><div class="crumb"><button onclick="go('home')">Fazendas</button></div><h1>${E(f.name)} ${f.demo ? '<span class="demo">DEMONSTRAÇÃO</span>' : ""}</h1><div class="mu">${E(f.producer)} · ${E(f.city)}</div></div><div class="acts">${badge(o)}<button class="btn s" onclick="go('sector','${f.id}',0)">Ficha${f.demo ? "" : " / editar"}</button></div></div>`
    + farmSwitch(f) + demoNote(f)
    + `<div class="quick noprint">${QUICK.map(q => `<button onclick="goTab(${q[2]},'${q[3]}')">＋ ${q[0]} ${q[1]}</button>`).join("")}<button onclick="VF=Object.assign(newVF(),{fid:'${f.id}'});VE=null;go('visit')">＋ 📝 Visita</button></div>`
    + `<h2>Indicadores</h2>${kpiGrid(fkpi(f).slice(0, 8))}<p class="mu"><button class="btn s" onclick="go('kpi','${f.id}')">📊 Ver gráficos e todos os indicadores</button></p>`
    + `<h2>Alertas</h2>${alertList(f, 5)}`
    + `<h2>Central da Fazenda</h2><div class="sgrid">${SECT.map((s, i) => `<button class="sec" onclick="go('sector','${f.id}',${i})"><span class="ic">${s[0]}</span><b>${i + 1}. ${s[1]}</b>${badge(ss[i])}<span class="mu">${E(ss[i].t)}</span></button>`).join("")}</div>`;
}
function farmSwitch(f) {
  if (farms.length < 2) return "";
  const opt = l => l.map(x => `<option value="${x.id}" ${x.id == f.id ? "selected" : ""}>${E(x.name)}</option>`).join("");
  return `<div class="hide-d noprint" style="margin:0 0 6px"><select aria-label="Trocar de fazenda" onchange="go(V.v=='kpi'?'kpi':'farm',this.value)">${realFarms().length ? `<optgroup label="Minhas fazendas">${opt(realFarms())}</optgroup>` : ""}<optgroup label="Demonstração">${opt(demoFarms())}</optgroup></select></div>`;
}

function kpiv() {
  const f = F(), g = gls(f);
  const ch = withFarm(f.id, () => {
    const ss = SS(), C = [];
    C.push(chartCard("CCS", "mil células/mL", tchart(anSeries("ccs"), { goal: g.ccs, color: "var(--cr)", u: "mil/mL", label: "CCS" })));
    C.push(chartCard("CBT", "mil UFC/mL", tchart(anSeries("cbt"), { goal: g.cbt, color: "var(--wa)", u: "mil UFC/mL", label: "CBT" })));
    C.push(chartCard("Gordura e proteína", "%", `<p class="mu">Gordura</p>${tchart(anSeries("gor"), { dec: 2, zero: false, label: "Gordura" })}<p class="mu">Proteína</p>${tchart(anSeries("pro"), { dec: 2, zero: false, color: "var(--in)", label: "Proteína" })}`));
    C.push(chartCard("Litros/hora por teste de ordenha", "L/h", tchart(ss.filter(s => s.dur && s.litros).map(s => ({ d: s.date, v: s.litros / s.dur * 60 })), { label: "Litros por hora" })));
    C.push(chartCard("Litros/vaca por teste de ordenha", "L", tchart(ss.filter(s => s.vacas && s.litros).map(s => ({ d: s.date, v: s.litros / s.vacas })), { dec: 1, label: "Litros por vaca" })));
    C.push(chartCard("Tetos com escore ≥3", "% dos quartos · avaliação manual", tchart(qhk(f.id).map(x => ({ d: x[0], v: x[1] })), { color: "var(--cr)", label: "Hiperqueratose" })));
    return C.join("");
  });
  return farmHead(f, "Indicadores") + farmSwitch(f) + demoNote(f) + kpiGrid(fkpi(f))
    + `<h2>Alertas</h2>${alertList(f)}<h2>Gráficos</h2><div class="two">${ch}</div><h2>Resumos dos setores</h2>${qsum() + csum() + msum() || '<p class="mu">Sem dados.</p>'}`
    + `<p class="mu">Valores calculados a partir dos registros desta fazenda. Metas são as definidas por você no cadastro; o app não aplica limites normativos.</p>`;
}

/* Complementos das telas dos setores 2, 3 e 9 (ainda sem módulo próprio): mostram o que já existe. */
const SEXTRA = {
  8: f => `<h2>Relatórios disponíveis</h2><div class="ctr">${[[4, "🥛 Qualidade do leite"], [5, "⏱️ Otimização da ordenha"], [6, "🧼 Limpeza CIP"], [7, "🛠️ Manutenção"], [2, "📏 ISO Check"], [3, "🔧 Testes técnicos"]].map(([s, l]) => { const st = sstat(f, s); return `<button class="sec" style="min-height:0" onclick="goTab(${s},'rl')"><b>${l}</b>${badge(st.st == "sd" ? st : { st: "in", lab: "Abrir relatório" })}</button>`; }).join("")}</div>`
};

/* ---------- navegação: menu lateral (computador), faixa de setores e barra inferior (celular) ---------- */
function sideNav() {
  const f = F(), on = v => V.v == v ? " on" : "", opt = l => l.map(x => `<option value="${x.id}" ${x.id == f.id ? "selected" : ""}>${E(x.name)}</option>`).join("");
  const ss = V.v == "home" || V.v == "backup" ? null : allStat(f);
  return `<div class="brand">🥛 MilkIQ <small>Leite IA</small></div>
<button class="si${on("home")}" onclick="go('home')"><span class="n">🏠</span>Fazendas</button>
<div class="sh">Fazenda</div><div class="sfarm"><select aria-label="Fazenda atual" onchange="go(V.v=='kpi'?'kpi':'farm',this.value)">${realFarms().length ? `<optgroup label="Minhas fazendas">${opt(realFarms())}</optgroup>` : ""}<optgroup label="Demonstração">${opt(demoFarms())}</optgroup></select></div>
<button class="si${on("farm")}" onclick="go('farm')"><span class="n">🧩</span>Central da fazenda</button>
<button class="si${on("kpi")}" onclick="go('kpi')"><span class="n">📊</span>Indicadores</button>
<div class="sh">Setores</div>${SECT.map((s, i) => `<button class="si${V.v == "sector" && V.s == i ? " on" : ""}" onclick="go('sector',V.f,${i})"><span class="n">${s[0]}</span>${i + 1}. ${s[1]}${ss ? `<span class="dot ${ss[i].st}" title="${E(ss[i].lab)}"></span>` : ""}</button>`).join("")}
<div class="sh">Geral</div><button class="si${on("visit")}" onclick="go('visit')"><span class="n">📝</span>Visitas</button><button class="si${on("backup")}" onclick="go('backup')"><span class="n">💾</span>Dados e backup</button>
<div class="sfoot">${netChip()}<br>Dados neste aparelho · ${MQ_ENV == "teste" ? "versão de testes · " : ""}app ${APP_BUILD}</div>`;
}
function sectorStrip() {
  const f = F(), ss = allStat(f);
  return `<div class="strip noprint" aria-label="Setores">${SECT.map((s, i) => `<button class="${V.s == i ? "on" : ""}" onclick="go('sector',V.f,${i})"><span class="dot ${ss[i].st}"></span>${s[0]} ${i + 1}</button>`).join("")}</div>`;
}
function bottomNav() {
  const t = V.v == "sector" ? "farm" : V.v, N = [["home", "🏠", "Fazendas"], ["farm", "🧩", "Central"], ["kpi", "📊", "Indicadores"], ["backup", "💾", "Dados"]];
  return N.map(n => `<button class="${t == n[0] ? "on" : ""}" onclick="go('${n[0]}')"><span>${n[1]}</span>${n[2]}</button>`).join("") + `<button class="fab" onclick="go('visit')"><span>＋</span>Visita</button>`;
}
function render() {
  if (!farms.some(x => x.id == V.f)) V.f = (realFarms()[0] || farms[0]).id;
  const m = { home, farm, kpi: kpiv, sector, visit, new: newf, backup: bkv, fdel: farmDelView };
  if (V.v == "backup" && !IDBS.est && typeof storageInfo == "function") storageInfo().then(() => { if (V.v == "backup") $("app").innerHTML = statusBar() + bkv(); });
  $("app").innerHTML = statusBar() + (V.v == "sector" ? sectorStrip() : "") + (m[V.v] || home)();
  $("nav").innerHTML = bottomNav();
  const sd = $("side"); if (sd) sd.innerHTML = sideNav();
  if (V.v == "sector" && V.s == 5) { calc(); tickT(); }
  drSoon(); uiSave();
}

/* Preferência do aparelho: última fazenda aberta (conveniência; não é dado da fazenda). */
function uiSave() { try { localStorage.setItem("mq_ui", JSON.stringify({ f: V.f })); } catch (e) { } }
function uiRestore() {
  let f = null; try { f = (JSON.parse(localStorage.getItem("mq_ui") || "null") || {}).f; } catch (e) { }
  if (f && farms.some(x => x.id == f)) V.f = f; else if (realFarms().length) V.f = realFarms()[0].id;
}
