/* ===== Cronômetro por fase da rotina =====
 * Um cronômetro independente para cada fase (podem correr ao mesmo tempo: por exemplo, o
 * "preparo até a colocação" corre enquanto o pré-dipping e a secagem são cronometrados).
 * A vaca é salva com c.ph = { fase: segundos }. O cronômetro único com marcos (modo antigo)
 * continua disponível. Todas as análises (turnos, ranking, diagnóstico, relatórios) leem os dois
 * formatos por cd() (js/03).
 */
const FASES = [
  ["jatos", "Primeiros jatos", "retirada e observação dos primeiros jatos"],
  ["pre", "Pré-dipping (contato)", "da aplicação do pré-dipping até a secagem"],
  ["sec", "Secagem", "secagem dos tetos"],
  ["est", "Estimulação", "massagem/estímulo dos tetos"],
  ["pa", "Preparo até a colocação", "do primeiro toque no teto até o conjunto acoplado"],
  ["col", "Colocação do conjunto", "tempo para acoplar as quatro teteiras"],
  ["fl", "Fluxo de leite", "do conjunto acoplado até o fim do fluxo"],
  ["so", "Sobreordenha", "do fim do fluxo até a retirada"],
  ["ret", "Retirada", "retirada do conjunto"],
  ["pos", "Pós-dipping", "da retirada até a aplicação do pós-dipping"]];
const PHN = Object.fromEntries(FASES.map(p => [p[0], p[1]]));
const PT = { n: "", t: {} }; // t[k] = { acc, t0, run }
const phEl = k => { const x = PT.t[k]; return x ? x.acc + (x.run ? (Date.now() - x.t0) / 1000 : 0) : 0; };
function phTick() { FASES.forEach(([k]) => { const e = $("ph_" + k); if (e) e.textContent = mmss(phEl(k)); }); }
setInterval(phTick, 250);
function phToggle(k) {
  const x = PT.t[k] = PT.t[k] || { acc: 0, t0: 0, run: false };
  if (x.run) { x.acc = phEl(k); x.run = false; } else { x.t0 = Date.now(); x.run = true; }
  render();
}
function phReset(k) { delete PT.t[k]; render(); }
function phStopAll() { FASES.forEach(([k]) => { const x = PT.t[k]; if (x && x.run) { x.acc = phEl(k); x.run = false; } }); }
function phSaveCow() {
  if (!String(PT.n).trim()) return note("Informe o número ou brinco da vaca.");
  phStopAll();
  const ph = {}; FASES.forEach(([k]) => { const v = phEl(k); if (v > 0) ph[k] = Math.round(v * 10) / 10; });
  if (!Object.keys(ph).length) return note("Cronometre ao menos uma fase.");
  dr().cows.push({ n: String(PT.n).trim().replace(/[<>]/g, "").slice(0, 30), ph });
  PT.n = ""; PT.t = {};
  note(svS() ? "Vaca salva no rascunho do teste. Salve o teste no fim da ordenha." : "Vaca salva só na tela: armazenamento indisponível.", STORE_OK);
}
/* rascunho: guarda os tempos acumulados se o app for fechado no meio da vaca */
DRF.push({ k: "ph", l: "Cronômetro por fase (Setor 6)", s: 5, tv: "o", tab: "cro", get: () => ({ n: PT.n, t: Object.fromEntries(Object.keys(PT.t).map(k => [k, phEl(k)])) }), fresh: () => ({ n: "", t: {} }),
  set: v => { PT.n = String(v.n || ""); PT.t = {}; Object.entries(v.t || {}).forEach(([k, s]) => { if (PHN[k] && +s > 0) PT.t[k] = { acc: +s, t0: 0, run: false }; }); } });

function phPanel() {
  const run = FASES.filter(([k]) => PT.t[k] && PT.t[k].run).length;
  return `<div class="card"><div class="top"><b>Cronômetro por fase</b><span class="mu">${run ? run + " fase(s) correndo" : "toque numa fase para iniciar"}</span></div>
<label>Vaca (número / brinco)</label><input inputmode="numeric" value="${E(PT.n)}" oninput="PT.n=this.value">
<div class="phs">${FASES.map(([k, l, h]) => { const x = PT.t[k], on = x && x.run, t = phEl(k); return `<div class="ph ${on ? "on" : t ? "done" : ""}"><button class="phb" onclick="phToggle('${k}')" aria-label="${on ? "Parar" : "Iniciar"} ${E(l)}"><span class="phn">${l}</span><span class="pht" id="ph_${k}">${mmss(t)}</span><span class="phs2">${on ? "⏸ parar" : t ? "▶ continuar" : "▶ iniciar"}</span></button>${t && !on ? `<button class="phr" onclick="phReset('${k}')" aria-label="Zerar ${E(l)}">↺</button>` : ""}<span class="phh">${h}</span></div>`; }).join("")}</div>
<button class="btn" style="margin-top:10px" onclick="phSaveCow()">✔ Salvar vaca</button><p class="mu">Cada fase tem seu próprio cronômetro; várias podem correr juntas. Fases não cronometradas ficam em branco (não contam como zero).</p></div>`;
}
/* Registrar: escolhe o modo; o modo antigo (marcos) segue disponível */
{ const base = vCro; vCro = function () {
  const mode = V.cm || "fase", html = base(), cut = html.indexOf('<div class="card"><b>Cronômetro da vaca</b>'), end = html.indexOf("<h2>Vacas deste teste");
  const sw = `<div class="tabs noprint"><button class="tb ${mode == "fase" ? "on" : ""}" onclick="V.cm='fase';render()">Cronômetro por fase</button><button class="tb ${mode == "marcos" ? "on" : ""}" onclick="V.cm='marcos';render()">Cronômetro único com marcos</button></div>`;
  if (cut < 0 || end < 0) return html;
  return html.slice(0, cut) + sw + (mode == "fase" ? phPanel() : html.slice(cut, end)) + html.slice(end);
}; }
/* lista "Vacas deste teste": mostra as fases das vacas cronometradas por fase */
function phCowLine(c) { return c.ph ? FASES.filter(([k]) => c.ph[k] != null).map(([k, l]) => `${l} ${mmss(c.ph[k])}`).join(" · ") : ""; }

/* médias por fase (vacas por fase e, quando possível, derivadas dos marcos) */
function phMeans(ss) {
  const o = {}; FASES.forEach(([k]) => o[k] = []);
  ss.forEach(s => s.cows.forEach(c => { if (c.ph) FASES.forEach(([k]) => { if (c.ph[k] != null) o[k].push(+c.ph[k]); }); else { const x = cd(c); [["pa", x.pa], ["pre", x.ct], ["fl", x.fl], ["so", x.so], ["pos", x.rp]].forEach(([k, v]) => { if (v != null) o[k].push(v); }); } }));
  return Object.fromEntries(FASES.map(([k]) => [k, o[k].length ? mean(o[k]) : null]));
}
/* gráfico de barras agrupadas: categorias × séries (ex.: fases × turnos, indicadores × períodos) */
function gbar(cats, series, o = {}) {
  const all = series.flatMap(s => s.v).filter(v => v != null && !isNaN(v)); if (!all.length) return '<p class="mu">Sem dados.</p>';
  const n = series.length, tilt = cats.length > 5, W = Math.max(420, cats.length * (n * 18 + 26) + 50), H = tilt ? 230 : 200, L0 = 40, B = tilt ? 78 : 30, T = 16, mx = Math.max(...all) * 1.15 || 1, gw = (W - L0 - 8) / cats.length, bw = Math.min(26, (gw - 10) / n);
  const Y = v => H - B - v / mx * (H - B - T);
  const ax = [0, mx / 2, mx].map(v => `<line class="ax" x1="${L0}" x2="${W - 6}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L0 - 5}" y="${Y(v) + 4}" text-anchor="end">${fm(v, o.dec || 0)}</text>`).join("");
  const bars = cats.map((c, i) => { const x0 = L0 + i * gw + (gw - n * bw) / 2; return series.map((s, j) => { const v = s.v[i]; if (v == null || isNaN(v)) return ""; return `<rect x="${x0 + j * bw}" y="${Y(v)}" width="${bw - 2}" height="${H - B - Y(v)}" rx="3" fill="${s.c}"><title>${E(c)} · ${E(s.n)}: ${fm(v, o.dec || 0)} ${E(o.u || "")}</title></rect>`; }).join("") + (tilt ? `<text transform="translate(${L0 + i * gw + gw / 2},${H - B + 12}) rotate(-35)" text-anchor="end">${E(c.length > 22 ? c.slice(0, 21) + "…" : c)}</text>` : `<text x="${L0 + i * gw + gw / 2}" y="${H - B + 16}" text-anchor="middle">${E(c.length > 14 ? c.slice(0, 13) + "…" : c)}</text>`); }).join("");
  return `<div class="ov"><svg class="chart" viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${Math.round(W * 1.35)}px;min-width:${Math.min(W, 560)}px" role="img" aria-label="${E(o.label || "")}">${ax}${bars}</svg></div><p class="mu">${series.map(s => `<span style="color:${s.c}">■</span> ${E(s.n)}`).join(" &nbsp; ")}${o.u ? " · " + E(o.u) : ""}</p>`;
}
/* painel de turnos: tempo por fase em cada turno */
{ const base = vTurnos; vTurnos = function () {
  const html = base(), ss = ssF(); if (!ss.length) return html;
  const ks = FASES.map(p => p[0]), T3 = [1, 2, 3].map(t => ({ t, m: phMeans(ss.filter(s => s.turn == t)) })).filter(x => ss.some(s => s.turn == x.t));
  const used = ks.filter(k => T3.some(x => x.m[k] != null)); if (!used.length) return html;
  const card = `<div class="card"><b>Tempo médio por fase da rotina × turno</b> <span class="mu">segundos</span>${gbar(used.map(k => PHN[k]), T3.map(x => ({ n: TURNO[x.t], c: TC[x.t], v: used.map(k => x.m[k]) })), { u: "s", label: "Fases por turno" })}</div>`;
  const i = html.indexOf('<div class="two">'); return i < 0 ? html + card : html.slice(0, i) + card + html.slice(i);
}; }

/* demo: vacas cronometradas por fase (fictícias), coerentes com cada fazenda e turno */
(() => {
  let r = 23; const q = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  DEMO.forEach(s => {
    const crit = s.fid == "critica", k = crit ? [0, 1, 1.1, 1.3][s.turn] : [0, 1, 1.04, 1.08][s.turn];
    for (let i = 0; i < 3; i++) {
      const v = (a, b) => Math.round((a + q() * (b - a)) * k);
      const ph = crit ? { jatos: v(3, 7), sec: v(4, 8), est: v(5, 10), pa: v(25, 55), col: v(10, 18), fl: v(330, 420), so: v(70, 140), ret: v(6, 10), pos: v(15, 40) } : { jatos: v(8, 12), pre: v(30, 40), sec: v(8, 12), est: v(10, 15), pa: v(70, 95), col: v(8, 12), fl: v(280, 330), so: v(5, 25), ret: v(4, 7), pos: v(5, 12) };
      if (crit && q() > .5) ph.pre = v(8, 15);
      s.cows.push({ n: "F" + (i + 1), ph });
    }
  });
})();
