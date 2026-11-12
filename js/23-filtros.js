/* ===== Filtros de período nos gráficos antigos e gráfico de linha melhorado =====
 * - line(): o gráfico de linha usado pelas telas antigas ganha eixo com valores, pontos, último valor
 *   e meta identificada (mesma assinatura: line(valores, cor, meta)).
 * - Filtro de período (e de linha/equipamento no CIP) nos gráficos de Qualidade (Evolução), Limpeza
 *   CIP, Água e Manutenção. O filtro restringe as listas só enquanto o gráfico é desenhado e as
 *   restaura em seguida (nada é alterado no banco).
 */
line = function (d, c, goal) {
  d = (d || []).filter(v => v != null && !isNaN(v));
  if (!d.length) return '<p class="mu">Sem dados ainda.</p>';
  const W = 340, H = 140, L0 = 40, R0 = 10, T0 = 12, B0 = 14, vs = d.concat(goal ? [goal] : []);
  let mx = Math.max(...vs), mn = Math.min(...vs); const pad = (mx - mn) * .12 || Math.abs(mx) * .1 || 1; mx += pad; mn -= pad;
  const X = i => L0 + (d.length == 1 ? (W - L0 - R0) / 2 : i * (W - L0 - R0) / (d.length - 1)), Y = v => T0 + (mx - v) / (mx - mn || 1) * (H - T0 - B0);
  const dec = Math.abs(mx) < 10 ? 2 : Math.abs(mx) < 100 ? 1 : 0;
  const ax = [mn + pad, (mn + mx) / 2, mx - pad].map(v => `<line class="ax" x1="${L0}" x2="${W - R0}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L0 - 5}" y="${Y(v) + 4}" text-anchor="end">${fm(v, dec)}</text>`).join("");
  const gl = goal ? `<line class="gl" x1="${L0}" x2="${W - R0}" y1="${Y(goal)}" y2="${Y(goal)}"/><text x="${W - R0}" y="${Y(goal) - 4}" text-anchor="end" style="fill:var(--wa)">meta ${fm(goal, dec)}</text>` : "";
  const pts = d.map((v, i) => X(i) + "," + Y(v)).join(" "), l = d.length - 1;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${ax}${gl}${d.length > 1 ? `<polyline fill="none" stroke="${c}" stroke-width="2.4" stroke-linejoin="round" points="${pts}"/>` : ""}${d.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="${d.length > 30 ? 1.8 : 3}" fill="${goal && v > goal ? "var(--wa)" : c}"><title>${fm(v, dec)}</title></circle>`).join("")}<text x="${X(l)}" y="${Y(d[l]) - 7}" text-anchor="end" style="fill:var(--tx);font-weight:700">${fm(d[l], dec)}</text></svg>`;
};

const FPER = [["90", "3 meses"], ["180", "6 meses"], ["365", "12 meses"], ["", "Tudo"]];
V.fp = V.fp || {};
function fpLim(k) { const p = V.fp[k] == null ? "365" : V.fp[k]; return p ? DD(TD(), -p) : ""; }
function perBar(k, extra) {
  const p = V.fp[k] == null ? "365" : V.fp[k];
  return `<div class="card noprint fbar"><div class="tabs" style="margin:0">${FPER.map(([v, l]) => `<button class="tb ${p == v ? "on" : ""}" onclick="V.fp['${k}']='${v}';render()">${l}</button>`).join("")}</div>${extra || ""}</div>`;
}
/* executa fn com as listas restritas ao período (e a um filtro extra), restaurando-as no fim */
function withPeriod(lim, cols, fn, keep) {
  const saved = [];
  cols.forEach(([o, k]) => { if (o && Array.isArray(o[k])) { saved.push([o, k, o[k]]); o[k] = o[k].filter(x => (!lim || !x.date || x.date >= lim) && (!keep || keep(x, k))); } });
  try { return fn(); } finally { saved.forEach(([o, k, v]) => { o[k] = v; }); }
}

/* Qualidade do leite → Evolução */
{ const base = qEv; qEv = function () { return perBar("q") + withPeriod(fpLim("q"), [[DB, "an"], [DQ, "an"]], base); }; }
/* Limpeza CIP → Gráficos (período + linha/equipamento) e Água */
{ const base = vGc; vGc = function () {
  const lines = [...new Set(CYS().map(c => c.eq).filter(Boolean))].sort(), le = V.feq && lines.includes(V.feq) ? V.feq : "";
  const sel = lines.length > 1 ? `<label>Linha / equipamento</label><select onchange="V.feq=this.value;render()"><option value="">Todas</option>${lines.map(l => `<option ${le == l ? "selected" : ""}>${E(l)}</option>`).join("")}</select>` : "";
  return perBar("cip", sel) + withPeriod(fpLim("cip"), [[DB, "cy"], [DC, "cy"]], base, x => !le || x.eq == le);
}; }
{ const base = vWa; vWa = function () {
  return perBar("wa") + withPeriod(fpLim("wa"), [[DB, "wa"], [DC, "wa"]], base);
}; }
/* Manutenção → Gráficos */
{ const base = vG8; vG8 = function () { return perBar("m8") + withPeriod(fpLim("m8"), [[DB, "sv"], [DM, "sv"], [DB, "dx"], [DM, "dx"]], base); }; }

/* gráfico de barras das telas antigas: valor em cima de cada barra e linha de base */
bars = function (d, c) {
  d = (d || []).map(v => v == null || isNaN(v) ? 0 : v); if (!d.length) return '<p class="mu">Sem dados ainda.</p>';
  const W = 340, H = 130, B = 10, T = 16, mx = Math.max(...d, 0) * 1.15 || 1, w = (W - 12) / d.length, dec = mx < 10 ? 1 : 0;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${d.map((v, i) => { const h = v / mx * (H - B - T); return `<rect x="${6 + i * w + 2}" y="${H - B - h}" width="${Math.max(w - 4, 1)}" height="${h}" rx="3" fill="${c}"><title>${fm(v, 2)}</title></rect>${d.length <= 16 ? `<text x="${6 + i * w + w / 2}" y="${H - B - h - 4}" text-anchor="middle" style="fill:var(--tx);font-weight:600">${fm(v, dec)}</text>` : ""}`; }).join("")}<line class="ax" x1="4" x2="${W - 4}" y1="${H - B}" y2="${H - B}"/></svg>`;
};
