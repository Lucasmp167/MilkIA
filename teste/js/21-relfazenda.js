/* ===== Relatório da fazenda: tudo o que foi feito, numa página, com comparações e gráficos =====
 * Compara o período escolhido (A = atual) com o período anterior de mesmo tamanho (B = anterior).
 * Cada seção só aparece com registros; números vêm só dos registros da fazenda (demo identificada).
 * Classificações seguem as regras do app: metas do usuário e referências verificadas.
 */
const RPER = [["30", "30 dias"], ["90", "3 meses"], ["180", "6 meses"], ["365", "12 meses"]];
const CA = "var(--mu)", CB = "var(--pr)"; // anterior × atual

function frel() {
  const f = F(), n = +(V.rp || 30), to = TD(), from = DD(to, -n), pfrom = DD(from, -n);
  const inA = d => d && d.slice(0, 10) > from && d.slice(0, 10) <= to, inB = d => d && d.slice(0, 10) > pfrom && d.slice(0, 10) <= from;
  const per = `${fmtD(DD(from, 1))} a ${fmtD(to)}`, pper = `${fmtD(DD(pfrom, 1))} a ${fmtD(from)}`;
  const body = withFarm(f.id, () => {
    const S = [], g = gls(f);
    const row = (l, a, b, d, u, lower) => { const dd = a != null && b != null ? a - b : null, good = dd == null || dd == 0 ? "" : (lower ? dd < 0 : dd > 0) ? "ok" : "wa"; return `<tr><td>${l}</td><td>${fm(b, d)}${b != null && u ? " " + u : ""}</td><td><b>${fm(a, d)}</b>${a != null && u ? " " + u : ""}</td><td class="${lower == null ? "" : good}">${dd == null ? "—" : (dd > 0 ? "+" : "") + fm(dd, d)}${b ? ` (${dd > 0 ? "+" : ""}${fm(dd / b * 100, 0)}%)` : ""}</td></tr>`; };
    const tbl = rows => `<div class="ov"><table><tr><th></th><th>Anterior<br><span class="mu">${pper}</span></th><th>Atual<br><span class="mu">${per}</span></th><th>Variação</th></tr>${rows.join("")}</table></div>`;
    const cmpBars = (labels, a, b, o = {}) => gbar(labels, [{ n: "Anterior", c: CA, v: b }, { n: "Atual", c: CB, v: a }], o);
    const avgOf = (l, k) => { const v = l.map(x => x[k]).filter(x => x != null && !isNaN(x)); return v.length ? mean(v) : null; };

    // 1. Qualidade do leite
    const an = QA(), aA = an.filter(x => inA(x.date)), aB = an.filter(x => inB(x.date));
    if (aA.length || aB.length) {
      const rows = PR.filter(p => aA.some(x => x[p[0]] != null) || aB.some(x => x[p[0]] != null)).map(p => row(p[1] + (g[p[0]] != null ? ` <span class="mu">(meta ${fm(g[p[0]], 0)})</span>` : ""), avgOf(aA, p[0]), avgOf(aB, p[0]), p[3], p[2], p[0] == "ccs" || p[0] == "cbt" ? true : null));
      const hk = qhk(f.id), hA = hk.filter(x => inA(x[0])), hB = hk.filter(x => inB(x[0]));
      S.push(["🥛 Qualidade do leite", `<p class="mu">${aA.length} análise(s) no período atual · ${aB.length} no anterior. Médias do período.</p>${tbl(rows)}
<div class="two"><div class="card">${chartTitle("CCS", "mil/mL")}${tchart(an.filter(x => inA(x.date) || inB(x.date)).map(x => ({ d: x.date, v: x.ccs })), { goal: g.ccs, color: "var(--cr)", u: "mil/mL", label: "CCS" })}</div><div class="card">${chartTitle("CBT", "mil UFC/mL")}${tchart(an.filter(x => inA(x.date) || inB(x.date)).map(x => ({ d: x.date, v: x.cbt })), { goal: g.cbt, color: "var(--wa)", u: "mil UFC/mL", label: "CBT" })}</div></div>
<div class="card">${chartTitle("Composição — anterior × atual", "%")}${cmpBars(["Gordura", "Proteína", "Lactose", "Sól. totais"], ["gor", "pro", "lac", "st"].map(k => avgOf(aA, k)), ["gor", "pro", "lac", "st"].map(k => avgOf(aB, k)), { dec: 2, u: "%" })}</div>
${hA.length || hB.length ? `<p>Tetos com escore ≥3 (avaliação manual): anterior ${hB.length ? fm(mean(hB.map(x => x[1])), 0) + "%" : "—"} → atual ${hA.length ? fm(mean(hA.map(x => x[1])), 0) + "%" : "—"}</p>` : ""}`]);
    }
    // 2. Ordenha e rotina
    const ss = SS(), sA = ss.filter(s => inA(s.date)), sB = ss.filter(s => inB(s.date));
    if (sA.length || sB.length) {
      const mA = met(sA), mB = met(sB), pA = phMeans(sA), pB = phMeans(sB), fk = FASES.map(p => p[0]).filter(k => pA[k] != null || pB[k] != null);
      const T3 = [1, 2, 3].filter(t => sA.some(s => s.turn == t)).map(t => ({ t, m: met(sA.filter(s => s.turn == t)) }));
      const R = rank2(sA, f).slice(0, 5);
      S.push(["⏱️ Ordenha e rotina", `<p class="mu">${sA.length} teste(s) e ${mA.nc} vacas cronometradas no período atual · ${sB.length} teste(s) no anterior.</p>${tbl([row("Vacas por hora", mA.vph, mB.vph, 0, "", false), row("Litros por vaca", mA.lv, mB.lv, 1, "L", false), row("Tempo por vaca", mA.tpv, mB.tpv, 0, "s", true), row("Preparo até a colocação", mA.pa, mB.pa, 0, "s", null), row("Sobreordenha", mA.so, mB.so, 0, "s", true), row("Rotina completa", mA.rot, mB.rot, 0, "%", false), row("Quedas + reacopl. /100 vacas", mA.oc, mB.oc, 1, "", true)])}
${fk.length ? `<div class="card">${chartTitle("Tempo por fase da rotina — anterior × atual", "s")}${cmpBars(fk.map(k => PHN[k]), fk.map(k => pA[k]), fk.map(k => pB[k]), { u: "s" })}</div>` : ""}
${T3.length > 1 ? `<div class="card">${chartTitle("Turnos no período atual", "")}${gbar(["Vacas/h", "Preparo (s)", "Sobreordenha (s)"], T3.map(x => ({ n: TURNO[x.t], c: TC[x.t], v: [x.m.vph, x.m.pa, x.m.so] })), {})}</div>` : ""}
${R.length ? `<p><b>Ranking de ordenhadores (período atual):</b> ${R.map((r, i) => `${i + 1}º ${E(r.n)} ${r.sc == null ? "" : fm(r.sc, 0) + " pts"}`).join(" · ")}</p>` : ""}`]);
    }
    // 3. Equipamentos e ISO Check
    const es = L("eq");
    if (es.length) {
      const parts = es.map(e => {
        const ds = L("dx").filter(d => d.eid == e.id), dA = ds.filter(d => inA(d.date)), dB = ds.filter(d => inB(d.date)), la = lastOf(dA), lb = lastOf(dB), iso = isoOf(e.id).filter(a => inA(a.date) || inB(a.date));
        if (!la && !lb && !iso.length) return "";
        const ev = la ? evalDx(la, e) : null, keys = MP.map(p => p[0]).filter(k => (la && dv(la)[k] != null) || (lb && dv(lb)[k] != null));
        const ia = lastOf(iso.filter(a => inA(a.date))), ib = lastOf(iso.filter(a => inB(a.date))), xa = ia ? evalIso(ia, e) : null, xb = ib ? evalIso(ib, e) : null;
        return `<div class="card"><b>${E(eqt(e))}</b>${keys.length ? tbl(keys.map(k => { const p = MP.find(x => x[0] == k); return row(p[1], la ? dv(la)[k] : null, lb ? dv(lb)[k] : null, p[3], p[2], null); })) : ""}
${ev ? `<p class="mu">Última medição ${fmtD(la.date)}: ${ev.probs.length ? ev.probs.map(p => E(p.t)).join("; ") : "sem problemas identificados pelas referências verificadas"}.</p>` : ""}
${ds.filter(d => inA(d.date) || inB(d.date)).length > 1 ? `${chartTitle("Vácuo de trabalho", "kPa")}${tchart(ds.filter(d => inA(d.date) || inB(d.date)).map(d => ({ d: d.date, v: dv(d).vac })), { dec: 1, zero: false, lo: (refFor("vac", e, null) || {}).min ? num(refFor("vac", e, null).min) : null, hi: (refFor("vac", e, null) || {}).max ? num(refFor("vac", e, null).max) : null, label: "Vácuo" })}` : ""}
${xa || xb ? `<p><b>ISO Check:</b> anterior ${xb ? `${fmtD(ib.date)} — ${xb.cf} conforme, ${xb.nf} fora, ${xb.nn} sem referência` : "—"} → atual ${xa ? `${fmtD(ia.date)} — ${xa.cf} conforme, ${xa.nf} fora, ${xa.nn} sem referência` : "—"}</p>` : ""}</div>`;
      }).filter(Boolean);
      if (parts.length) S.push(["⚙️ Equipamentos e ISO Check", parts.join("")]);
    }
    // 4. Testes técnicos
    const lr = L("tt").filter(t => t.tipo == "lr"), lA = lr.filter(t => inA(t.date)), lB = lr.filter(t => inB(t.date));
    if (lA.length || lB.length) { const ms = l => l.length ? mean(l.map(t => lrStats(t).mean).filter(x => x != null)) : null; S.push(["🔧 Leite residual", `${tbl([row("Leite residual médio por vaca", ms(lA), ms(lB), 0, "mL", true)])}${tchart(lr.filter(t => inA(t.date) || inB(t.date)).map(t => ({ d: t.date, v: lrStats(t).mean })), { u: "mL", label: "Leite residual" })}`]); }
    // 5. Limpeza CIP e água
    const cy = CYS(), P = PRODS(), cA = cy.filter(c => inA(c.date)), cB = cy.filter(c => inB(c.date)), fails = l => l.filter(c => cf(c, f, P).out.length).length, wA = WAS().filter(w => inA(w.date));
    if (cA.length || cB.length || wA.length) S.push(["🧼 Limpeza CIP e água", `${tbl([row("Lavagens registradas", cA.length, cB.length, 0, "", null), row("Lavagens com item fora da faixa", fails(cA), fails(cB), 0, "", true)])}${wA.length ? `<p class="mu">${wA.length} análise(s) de água no período atual.</p>` : ""}`]);
    // 6. Manutenção
    const sv = L("sv"), vA = sv.filter(s => inA(s.date)), vB = sv.filter(s => inB(s.date)), cost = l => l.reduce((a, s) => a + svCost(s), 0), late = allPl().filter(x => x.st.s == "atrasada").length;
    if (vA.length || vB.length || late) { const pt = {}; vA.forEach(s => s.parts.forEach(q => pt[q.n] = (pt[q.n] || 0) + (num(q.q) || 0))); S.push(["🛠️ Manutenção", `${tbl([row("Serviços", vA.length, vB.length, 0, "", null), row("Serviços corretivos", vA.filter(s => s.tipo == "Corretiva").length, vB.filter(s => s.tipo == "Corretiva").length, 0, "", true), row("Custo", cost(vA), cost(vB), 2, "R$", true)])}<p>Revisões atrasadas hoje: <b class="${late ? "cr" : "ok"}">${late}</b>${Object.keys(pt).length ? " · peças trocadas no período: " + Object.entries(pt).map(([k, v]) => E(k) + " (" + v + ")").join(", ") : ""}</p>`]); }
    // 7. Plano de ação e visitas
    const pa = L("pa"), vs = L("vs").filter(v => inA(v.date));
    if (pa.length || vs.length) S.push(["✅ Plano de ação e visitas", `<p>${vs.length} visita(s) no período · ${pa.filter(a => a.st != "Concluída").length} ação(ões) em aberto (${pa.filter(paLate).length} atrasada(s)) · ${pa.filter(a => a.st == "Concluída" && inA(a.done)).length} concluída(s) no período.</p>${pa.filter(a => a.st != "Concluída").length ? `<div class="ov"><table><tr><th>Ação</th><th>Prioridade</th><th>Prazo</th><th>Situação</th></tr>${pa.filter(a => a.st != "Concluída").map(a => `<tr><td>${E(a.desc)}</td><td>${E(a.pri || "Média")}</td><td>${a.prazo ? fmtD(a.prazo) : "—"}</td><td class="${paLate(a) ? "cr" : ""}">${E(a.st)}${paLate(a) ? " (atrasada)" : ""}</td></tr>`).join("")}</table></div>` : ""}`]);
    return S;
  });
  const ss = allStat(f);
  return `<div class="noprint">${farmHead(f, "🧾 Relatório da fazenda", E(f.producer) + " · " + E(f.city))}<div class="card"><b>Período</b><div class="tabs">${RPER.map(([k, l]) => `<button class="tb ${String(n) == k ? "on" : ""}" onclick="V.rp='${k}';render()">${l}</button>`).join("")}</div><p class="mu">Compara o período escolhido com o período anterior de mesmo tamanho.</p><button class="btn w" onclick="window.print()">🖨️ Imprimir / salvar em PDF</button></div></div>
<div class="card report"><h1>Relatório da fazenda — ${E(f.name)}</h1>${f.demo ? '<p><span class="demo" style="white-space:normal;display:inline-block">DADOS DE DEMONSTRAÇÃO — fazenda e registros fictícios</span></p>' : ""}<p><b>${E(f.producer)}</b> · ${E(f.city)}${pos(f.milking) ? ` · ${f.milking} vacas em lactação` : ""}${pos(f.liters) ? ` · ${fm(f.liters, 0)} L/dia` : ""}</p><p class="mu">Período atual: ${per} · comparado com ${pper} · emitido em ${new Date().toLocaleString("pt-BR")}</p>
${producerSummary(f)}
<h2>Situação dos setores</h2><div class="ctr">${SECT.map((s, i) => `<div class="kc"><span class="kl">${s[0]} ${s[1]}</span>${badge(ss[i])}<span class="ks" title="${E(ss[i].t)}">${E(ss[i].t)}</span></div>`).join("")}</div>
${body.length ? body.map(([h, b]) => `<h2>${h}</h2>${b}`).join("") : '<p class="mu">Nenhum registro nos dois períodos.</p>'}
<h2>Análise técnica</h2>${(() => { const X = assist(f); return X.length ? X.map(x => `<p><b>${E(x.pri)}</b> · ${E(x.fato)}${x.hip ? `<br><span class="mu">Hipótese: ${E(x.hip)}</span>` : ""}${x.rec ? `<br><span class="mu">Recomendação: ${E(x.rec)}</span>` : ""}</p>`).join("") : '<p class="mu">Nenhum ponto identificado.</p>'; })()}
<p class="mu">Valores = médias dos registros de cada período. Variação em verde = melhora, em amarelo = piora (só para indicadores em que o sentido é claro). Classificações usam apenas metas definidas pelo usuário e referências cadastradas e verificadas; a avaliação de tetos é manual; a análise técnica é feita por regras (sem IA generativa).</p>
<div class="grid" style="margin-top:28px"><div style="border-top:1px solid var(--tx);padding-top:4px;text-align:center">Técnico responsável</div><div style="border-top:1px solid var(--tx);padding-top:4px;text-align:center">${E(f.producer && f.producer != "—" ? f.producer : "Produtor")}</div></div></div>`;
}
const chartTitle = (t, u) => `<div class="top"><b>${t}</b><span class="mu">${u}</span></div>`;
