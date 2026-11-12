/* ===== Etapa 2: Setor 2 — Ordenhadeiras e equipamentos =====
 * Central técnica dos equipamentos. NÃO tem cadastro próprio: usa as mesmas coleções do Setor 8
 * (DB.eq, cmp, pl, sv, dx, pc, dg, rf). Editar aqui ou lá altera o mesmo registro.
 *
 * Regras:
 *  - Nenhum limite técnico está no código. Uma medição só é "Conforme"/"Fora" quando existe
 *    referência cadastrada pelo usuário, com fonte e marcada como verificada (DB.rf).
 *  - Referência com "ponto" preenchido vale só para medições daquele ponto; sem ponto, vale para a
 *    medição geral do equipamento.
 *  - Causas e ações sugeridas são orientações gerais (qualitativas), sempre apresentadas como
 *    "possíveis" — nunca como diagnóstico fechado.
 *  - Esquema visual = ilustração genérica gerada pelo app. Diagrama oficial só se o usuário enviar
 *    o documento, marcar como oficial e informar fonte e identificação do documento.
 */

const isGEA = e => /^gea\b/i.test(String((e && e.fab) || "").trim());
const BRANDS = ["GEA", "DeLaval", "BouMatic", "Lely", "Outra marca"]; // só sugestões de digitação
const SALAS = ["", "Espinha de peixe", "Paralela (lado a lado)", "Rotativa", "Tandem / passagem", "Fosso / balde ao pé", "Robô (ordenha voluntária)", "Outra"];

/* Blocos do esquema genérico de uma ordenhadeira: tipos de componente e ponto de medição de cada bloco. */
const BLOCKS = [
  { k: "bv", n: "Bomba de vácuo", ct: ["Bomba de vácuo"], pt: "Bomba de vácuo", g: "v" },
  { k: "it", n: "Interceptor / tanque sanitário", ct: ["Interceptor", "Filtro"], pt: "Interceptor", g: "v" },
  { k: "rg", n: "Regulador de vácuo", ct: ["Regulador de vácuo"], pt: "Regulador", g: "v" },
  { k: "lp", n: "Linha de vácuo / pulsação", ct: ["Linha de vácuo/pulsação", "Mangueira"], pt: "Linha de pulsação", g: "v" },
  { k: "pu", n: "Pulsadores", ct: ["Pulsador", "Controlador/painel"], pt: "Pulsador", g: "v" },
  { k: "cj", n: "Conjuntos (coletor e teteiras)", ct: ["Coletor", "Teteira"], pt: "Coletor / ponta de teto", g: "l" },
  { k: "ll", n: "Linha de leite", ct: ["Linha de leite"], pt: "Linha de leite", g: "l" },
  { k: "uf", n: "Unidade final / receptor", ct: ["Unidade final"], pt: "Unidade final / receptor", g: "l" },
  { k: "bl", n: "Bomba de leite", ct: ["Bomba de leite"], pt: null, g: "l" },
  { k: "mx", n: "Medidores / retirada automática", ct: ["Medidor de leite", "Retirador automático (ACR)"], pt: null, g: "l" }];
const PTS = BLOCKS.filter(b => b.pt).map(b => b.pt).concat(["Outro ponto"]);
const blockOf = tipo => BLOCKS.find(b => b.ct.includes(tipo));

/* Causas possíveis e ações sugeridas (orientação geral, sem valores numéricos). */
const LOWCHK = { c: ["Valor abaixo da faixa cadastrada: confirmar o método e o instrumento de medição"], a: ["Repetir a medição e conferir o procedimento"] };
const CAUSE = {
  vac: { baixo: { c: ["Vazamentos de ar (mangueiras, conexões, juntas, válvulas)", "Regulador de vácuo desajustado, sujo ou com defeito", "Capacidade da bomba de vácuo reduzida (desgaste, correia, lubrificação)", "Filtros ou interceptor obstruídos", "Entrada de ar excessiva durante a ordenha (quedas e deslizamentos)"], a: ["Fazer teste de vazamentos e corrigir entradas de ar", "Limpar e ajustar o regulador conforme a especificação do fabricante", "Medir a capacidade da bomba; revisar correias, lubrificação e palhetas", "Limpar filtros e interceptor"] },
    alto: { c: ["Regulador ajustado acima do especificado ou travado", "Controle de vácuo (inversor/sensor) com configuração incorreta", "Vacuômetro descalibrado"], a: ["Ajustar o regulador ou o controle conforme a especificação do fabricante", "Conferir o sensor e calibrar o vacuômetro"] } },
  res: { baixo: { c: ["Vazamentos de ar", "Bomba de vácuo com capacidade reduzida", "Consumo de ar elevado de componentes (pulsadores, retiradores, válvulas)", "Tubulação de vácuo subdimensionada ou obstruída"], a: ["Medir vazamentos e a capacidade da bomba", "Revisar o consumo de ar dos componentes", "Verificar diâmetros e limpeza das tubulações"] },
    alto: { c: ["Valor acima da faixa cadastrada: confirmar o método de medição"], a: ["Repetir a medição e conferir o fluxômetro"] } },
  tax: { baixo: { c: ["Pulsador com desgaste ou defeito", "Controlador de pulsação com configuração incorreta", "Suprimento de vácuo/ar dos pulsadores insuficiente"], a: ["Testar cada pulsador individualmente", "Conferir a configuração do controlador", "Limpar filtros de ar dos pulsadores"] } },
  rel: { baixo: { c: ["Membranas ou peças do pulsador desgastadas", "Mangueiras de pulsação furadas, dobradas ou obstruídas", "Filtro de ar do pulsador sujo", "Configuração incorreta do controlador"], a: ["Revisar ou substituir peças dos pulsadores", "Inspecionar as mangueiras de pulsação", "Limpar filtros", "Conferir a configuração"] } },
  qd: { alto: { c: ["Conjuntos mal posicionados ou desalinhados", "Teteiras desgastadas ou inadequadas", "Entrada de ar no coletor", "Reserva de vácuo insuficiente"], a: ["Revisar o alinhamento e o suporte das mangueiras", "Verificar estado e vida útil das teteiras", "Treinar colocação e retirada dos conjuntos", "Medir a reserva efetiva"] }, baixo: LOWCHK },
  vz: { alto: { c: ["Mangueiras ressecadas ou rachadas", "Conexões e juntas com folga", "Válvulas e tampas mal vedadas"], a: ["Localizar e corrigir os vazamentos", "Substituir mangueiras e juntas danificadas"] }, baixo: LOWCHK },
  vd: { alto: { c: ["Reserva de vácuo insuficiente", "Linha de leite inundada ou com diâmetro/inclinação inadequados", "Entrada de ar nos conjuntos", "Regulador lento ou subdimensionado"], a: ["Medir a reserva efetiva", "Verificar inclinação e diâmetro da linha de leite", "Revisar regulador e conjuntos"] }, baixo: LOWCHK },
  insp: { vaz: { c: ["Mangueiras, juntas ou conexões danificadas"], a: ["Localizar e corrigir os pontos de entrada de ar"] }, mang: { c: ["Mangueiras ressecadas, rachadas, dobradas ou fora de posição"], a: ["Substituir e reposicionar as mangueiras"] },
    tet: { c: ["Teteiras gastas, ressecadas ou com tempo de uso vencido"], a: ["Substituir conforme o intervalo do fabricante"] }, col: { c: ["Coletor trincado, entrada de ar obstruída ou válvula com defeito"], a: ["Limpar ou substituir o coletor e suas peças"] } }
};
CAUSE.tax.alto = CAUSE.tax.baixo; CAUSE.rel.alto = CAUSE.rel.baixo;

/* ---------- referências e avaliação ---------- */
function refFor(par, e, pt) {
  return L("rf").find(r => r.ver && r.par == par && nrm(r.fab) == nrm(e.fab) && (!r.mod || nrm(r.mod) == nrm(e.mod)) && (pt ? nrm(r.pt) == nrm(pt) : !r.pt)) || null;
}
function judge(v, r) {
  if (v == null) return { st: "—" };
  if (!r) return { st: "Não avaliado" };
  const lo = num(r.min), hi = num(r.max);
  if (lo != null && v < lo) return { st: "Fora", dir: "baixo", g: r.grav };
  if (hi != null && v > hi) return { st: "Fora", dir: "alto", g: r.grav };
  return { st: "Conforme" };
}
const PNAME = Object.fromEntries(MP.map(p => [p[0], p]));
const rng = r => r ? `${r.min || "—"} a ${r.max || "—"} ${r.un || ""}`.trim() : "";
/* Avaliação completa de uma medição: valores gerais, por ponto, inspeções e problemas com causas/ações. */
function evalDx(d, e) {
  const v = dv(d), gen = MP.map(p => { const r = refFor(p[0], e, null); return Object.assign({ p, v: v[p[0]], r }, judge(v[p[0]], r)); });
  const pts = arr1(d.pts).map(x => { const p = PNAME[x.par] || [x.par, x.par, "", 1], val = num(x.v), r = refFor(x.par, e, x.pt); return Object.assign({ pt: x.pt, p, v: Number.isNaN(val) ? null : val, r, obs: x.obs }, judge(Number.isNaN(val) ? null : val, r)); });
  const probs = [];
  gen.concat(pts).filter(x => x.st == "Fora").forEach(x => {
    const k = (CAUSE[x.p[0]] || {})[x.dir] || LOWCHK;
    probs.push({ g: x.g || "Média", t: `${x.p[1]}${x.pt ? " — " + x.pt : ""}: ${fm(x.v, x.p[3])} ${x.p[2]}, ${x.dir == "baixo" ? "abaixo do mínimo" : "acima do máximo"} da referência (${rng(x.r)}; fonte: ${x.r.fonte})`, c: k.c, a: k.a });
  });
  [["vaz", "Vazamentos"], ["mang", "Mangueiras"], ["tet", "Teteiras"], ["col", "Coletores"]].forEach(([k, l]) => {
    if (d[k] == "Falha" || d[k] == "Atenção") probs.push({ g: d[k] == "Falha" ? "Alta" : "Média", t: `${l}: ${d[k] == "Falha" ? "falha" : "atenção"} registrada na inspeção`, c: CAUSE.insp[k].c, a: CAUSE.insp[k].a });
  });
  probs.sort((a, b) => GR.indexOf(b.g) - GR.indexOf(a.g));
  return { gen, pts, probs };
}
const eqDx = e => L("dx").filter(x => x.eid == e.id);
/* Status de um equipamento a partir da última medição. */
function estat(e) {
  const d = lastOf(eqDx(e));
  if (!d) return { st: "in", lab: "Sem medição", t: "Nenhuma medição registrada" };
  const r = evalDx(d, e), cf = r.gen.concat(r.pts).filter(x => x.st == "Conforme").length, nv0 = r.gen.concat(r.pts).filter(x => x.st == "Não avaliado").length;
  if (r.probs.some(p => p.g == "Alta")) return { st: "cr", lab: "Crítico", t: `${r.probs.length} problema(s) em ${fmtD(d.date)}`, d };
  if (r.probs.length) return { st: "wa", lab: "Atenção", t: `${r.probs.length} problema(s) em ${fmtD(d.date)}`, d };
  if (cf) return { st: "ok", lab: "Conforme", t: `${cf} parâmetro(s) conforme em ${fmtD(d.date)}${nv0 ? `, ${nv0} sem referência` : ""}`, d };
  return { st: "na", lab: "Sem referência", t: `Medição de ${fmtD(d.date)} sem referência verificada`, d };
}
/* Pendências de um equipamento: revisões (Setor 8), problemas da última medição, cadastro incompleto. */
function epend(e) {
  const P = [], d = lastOf(eqDx(e));
  allPl().filter(x => x.e && x.e.id == e.id).forEach(x => {
    if (x.st.s == "atrasada") P.push({ l: "cr", t: `Revisão atrasada: ${x.p.nome} (${fm(Math.abs(x.st.w.left), 0)} ${x.st.w.lab})`, go: "mt" });
    else if (x.st.s == "próxima") P.push({ l: "wa", t: `Revisão próxima: ${x.p.nome} (faltam ${fm(x.st.w.left, 0)} ${x.st.w.lab})`, go: "mt" });
  });
  if (d) evalDx(d, e).probs.forEach(p => P.push({ l: p.g == "Alta" ? "cr" : "wa", t: p.t, go: "med" }));
  else P.push({ l: "in", t: "Nenhuma medição registrada", go: "med" });
  if (!L("pl").some(p => p.eid == e.id)) P.push({ l: "in", t: "Nenhum plano de revisão cadastrado (Setor 8)", go: "mt" });
  return P;
}

/* ---------- esquema visual genérico (SVG) ---------- */
function eqSchema(e) {
  const cm = L("cmp").filter(c => c.eid == e.id), d = lastOf(eqDx(e)), ev = d ? evalDx(d, e) : null;
  const W = 360, bw = 160, bh = 52, gap = 14, x0 = { v: 10, l: 190 }, y0 = 34, col = { v: [], l: [] };
  BLOCKS.forEach(b => col[b.g].push(b));
  const rows = Math.max(col.v.length, col.l.length), H = y0 + rows * (bh + gap) + 8;
  let out = `<text x="${x0.v}" y="20" style="fill:var(--tx);font-weight:700;font-size:12px">Sistema de vácuo</text><text x="${x0.l}" y="20" style="fill:var(--tx);font-weight:700;font-size:12px">Sistema de leite</text>`;
  ["v", "l"].forEach(g => col[g].forEach((b, i) => {
    const x = x0[g], y = y0 + i * (bh + gap), n = cm.filter(c => b.ct.includes(c.tipo)).reduce((a, c) => a + (num(c.qtd) || 1), 0);
    const pm = ev ? ev.pts.filter(p => p.pt == b.pt) : [], worst = pm.some(p => p.st == "Fora" && p.g == "Alta") ? "cr" : pm.some(p => p.st == "Fora") ? "wa" : pm.some(p => p.st == "Conforme") ? "ok" : pm.length ? "na" : null;
    const extra = b.k == "cj" && pos(num(e.nc)) ? ` · ${e.nc} conj.` : "";
    out += `<g class="blk" data-k="${b.k}"><rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="10" fill="var(--card2)" stroke="${n ? "var(--pr)" : "var(--bd)"}" stroke-width="${n ? 1.6 : 1}" ${n ? "" : 'stroke-dasharray="4 3"'}/>`
      + `<text x="${x + 10}" y="${y + 21}" style="fill:var(--tx);font-size:12px;font-weight:600">${E(b.n.length > 24 ? b.n.slice(0, 23) + "…" : b.n)}</text>`
      + `<text x="${x + 10}" y="${y + 39}" font-size="11">${n ? n + " componente(s)" : "não cadastrado"}${extra}</text>`
      + (worst ? `<circle cx="${x + bw - 12}" cy="${y + 12}" r="6" fill="var(--${worst})"><title>${pm.length} medição(ões) neste ponto</title></circle>` : "") + `</g>`;
    if (i < col[g].length - 1) out += `<path d="M${x + bw / 2} ${y + bh + 2} v${gap - 4}" stroke="var(--mu)" stroke-width="1.5" marker-end="url(#ar)"/>`;
  }));
  return `<svg class="chart schema" viewBox="0 0 ${W} ${H}" role="img" aria-label="Esquema genérico do equipamento"><defs><marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--mu)"/></marker></defs>${out}</svg>
<p class="mu">Esquema <b>genérico e ilustrativo</b> montado com os componentes cadastrados — <b>não é desenho oficial GEA</b> nem de outro fabricante. Contorno tracejado = bloco sem componente cadastrado. Círculo = situação das medições por ponto da última medição.</p>`;
}

/* ---------- navegação interna do setor ---------- */
const E2T = [["res", "Resumo"], ["med", "Medições"], ["cmp", "Componentes"], ["his", "Histórico"], ["rl", "Relatório"]];
function e2open(id, tab) { V.e2 = id; V.me = id; V.e2t = tab || V.e2t || "res"; V.e2edit = false; if (FE.dx) { FE.dx = null; FS.dx = NEW.dx(); } V.note = null; render(); scrollTo(0, 0); }
function e2back() { V.e2 = null; V.e2edit = false; V.note = null; render(); scrollTo(0, 0); }
const e2note = () => V.note ? `<div class="alert ${V.note.ok ? "ok" : "cr"}" style="border-color:currentColor"><span style="color:var(--tx)">${V.note.t}</span></div>` : "";

function eqv() {
  const f = F(), es = L("eq"), e = V.e2 && es.find(x => x.id == V.e2);
  if (V.e2edit) return farmHead(f, "⚙️ Ordenhadeiras e equipamentos", E(f.name)) + e2note() + eqForm();
  if (e) { V.me = e.id; return eqDetail(f, e); }
  const t = V.e2v || "list", TB = [["list", "Equipamentos"], ["cmp", "Comparativo"], ["ref", "Referências"]];
  return farmHead(f, "⚙️ Ordenhadeiras e equipamentos", E(f.name)) + demoNote(f)
    + `<div class="tabs noprint">${TB.map(b => `<button class="tb ${t == b[0] ? "on" : ""}" onclick="V.e2v='${b[0]}';V.note=null;render()">${b[1]}</button>`).join("")}</div>` + e2note()
    + ({ list: eqList, cmp: eqCompare, ref: eqRefs }[t] || eqList)(f, es);
}
function eqList(f, es) {
  const card = e => { const s = estat(e), p = epend(e).filter(x => x.l != "in"); return `<div class="card tap" onclick="e2open('${e.id}','res')"><div class="top"><b>${E(eqt(e))}</b><span class="acts">${e.demo ? '<span class="demo">DEMO</span>' : ""}${isGEA(e) ? '<span class="badge in">GEA</span>' : ""}${badge(s)}</span></div><p class="mu">${E(e.tipo || "—")}${e.sala ? " · " + E(e.sala) : ""} · ${e.nc || "—"} conjuntos${e.ano ? " · " + E(e.ano) : ""}</p><p class="mu">${E(s.t)}${p.length ? ` · <b class="${p.some(x => x.l == "cr") ? "cr" : "wa"}">${p.length} pendência(s)</b>` : ""}</p></div>`; };
  return (f.demo ? "" : `<button class="btn w" onclick="e2new()">+ Nova ordenhadeira / equipamento</button>`)
    + `<h2>Equipamentos (${es.length})</h2>` + (es.length ? `<div class="two">${es.map(card).join("")}</div>` : '<div class="card empty"><div class="big">⚙️</div><b>Nenhum equipamento cadastrado</b><p class="mu">Cadastre cada ordenhadeira da fazenda. O mesmo cadastro é usado na manutenção (Setor 8).</p></div>')
    + '<p class="mu">Cadastro compartilhado com o Setor 8 (manutenção e peças): o que você altera aqui aparece lá, e vice-versa.</p>';
}

/* ---------- cadastro / edição do equipamento (mesmo formulário FS.eq do Setor 8) ---------- */
function e2new() { FS.eq = NEW.eq(); FE.eq = null; V.e2edit = true; V.note = null; render(); scrollTo(0, 0); }
function e2edit(id) { const x = DB.eq.find(y => y.id == id); if (!x) return note("Equipamentos de demonstração não podem ser editados."); FS.eq = Object.assign(NEW.eq(), cp(x)); FE.eq = id; V.e2edit = true; V.note = null; render(); scrollTo(0, 0); }
function eqForm() {
  const S = "eq", mods = [...new Set(farms.filter(f => !F().demo ? !f.demo : f.demo).flatMap(f => withFarm(f.id, () => L("eq").map(x => x.mod))).filter(Boolean))];
  const inp = (k, l, o = {}) => `<div${o.wide ? ' style="grid-column:1/-1"' : ""}><label>${l}</label><input ${o.list ? `list="${o.list}"` : ""} ${o.n ? 'inputmode="decimal"' : ""} placeholder="${o.ph || ""}" value="${E(FS.eq[k])}" oninput="FS.eq.${k}=this.value"></div>`;
  return `<div class="pagehead"><div><div class="crumb"><button onclick="V.e2edit=false;render()">Equipamentos</button></div><h1>${FE.eq ? "Editar equipamento" : "Nova ordenhadeira / equipamento"}</h1><div class="mu">Campos com * são obrigatórios.</div></div></div>
<datalist id="dl-brands">${BRANDS.map(b => `<option value="${b}">`).join("")}</datalist><datalist id="dl-mods">${mods.map(m => `<option value="${E(m)}">`).join("")}</datalist>
<div class="two"><div class="card"><fieldset class="fs"><legend>Identificação</legend><div class="grid">${inp("fab", "Marca *", { list: "dl-brands" })}${inp("mod", "Modelo *", { list: "dl-mods" })}${inp("ser", "Nº de série *", { ph: "use s/n se não houver" })}${inp("ano", "Ano de instalação", { n: 1 })}${fld(S, "tipo", "Tipo de instalação", "sel", EQT)}${fld(S, "sala", "Tipo de sala", "sel", SALAS)}</div></fieldset>
<fieldset class="fs" style="margin-top:12px"><legend>Uso</legend><div class="grid">${inp("nc", "Nº de conjuntos", { n: 1 })}${inp("h", "Horas de funcionamento", { n: 1 })}${inp("o", "Ordenhas acumuladas", { n: 1, wide: 1 })}</div></fieldset></div>
<div class="card"><fieldset class="fs"><legend>Configuração encontrada / ajustada</legend><p class="mu">Valores configurados na máquina (não são referência técnica).</p><div class="grid">${inp("lv", "Vácuo de trabalho ajustado (kPa)", { n: 1 })}${fld(S, "pul", "Pulsação", "sel", ["", "Alternada", "Simultânea", "Outra"])}${inp("ptx", "Taxa de pulsação ajustada (ciclos/min)", { n: 1 })}${inp("prel", "Relação de pulsação ajustada (%)", { n: 1 })}${inp("ll", "Linha de leite", { ph: "diâmetro, material, formato", wide: 1 })}${inp("lvac", "Linha de vácuo / pulsação", { ph: "diâmetro, material", wide: 1 })}</div></fieldset>
${inp("car", "Características e observações")}</div></div>
<p class="mu">Bombas, pulsadores, unidades finais, reguladores e demais componentes são cadastrados na aba Componentes do equipamento.</p>
<div class="acts"><button class="btn w" onclick="eqSave()">${FE.eq ? "Salvar alterações" : "Salvar equipamento"}</button><button class="btn gh w" onclick="V.e2edit=false;FE.eq=null;FS.eq=NEW.eq();render()">Cancelar</button></div>`;
}
const EQLAB = { fab: "marca", mod: "modelo", ser: "série", ano: "ano", tipo: "tipo de instalação", sala: "sala", nc: "conjuntos", h: "horas", o: "ordenhas", lv: "vácuo ajustado", pul: "pulsação", ptx: "taxa ajustada", prel: "relação ajustada", ll: "linha de leite", lvac: "linha de vácuo", car: "observações" };
function eqSave() {
  const o = cp(FS.eq); Object.keys(o).forEach(k => { if (typeof o[k] == "string") o[k] = o[k].replace(/[<>]/g, "").trim(); });
  if (!o.fab || !o.mod) return note("Informe marca e modelo.");
  if (!o.ser) return note("Informe o número de série (use “s/n” se não houver).");
  const er = nneg(o, ["nc", "h", "o", "lv", "ptx", "prel", "ano"]); if (er) return note(er.replace("Valor inválido: ", "Valor inválido em ").replace(/ (\w+)$/, (m, k) => " " + (EQLAB[k] || k)));
  const ano = num(o.ano); if (ano != null && (ano < 1950 || ano > new Date().getFullYear() + 1 || ano % 1)) return note("Ano de instalação inválido.");
  if (num(o.prel) != null && num(o.prel) > 100) return note("Relação de pulsação deve estar entre 0 e 100 %.");
  if (num(o.nc) != null && num(o.nc) % 1) return note("Número de conjuntos deve ser inteiro.");
  const old = FE.eq ? DB.eq.find(x => x.id == FE.eq) : null;
  if (old) { // contadores não podem diminuir (mesma regra do Setor 8)
    if ((num(o.h) != null && num(o.h) < (nv(old, "h") || 0)) || (num(o.o) != null && num(o.o) < (nv(old, "o") || 0))) return note("Horas e ordenhas acumuladas não podem diminuir.");
  }
  o.id = old ? old.id : "eq" + Date.now(); o.fid = old ? old.fid : V.f; o.demo = false;
  const ch = old ? Object.keys(EQLAB).filter(k => String(old[k] == null ? "" : old[k]) !== String(o[k] == null ? "" : o[k])).map(k => EQLAB[k]) : null;
  if (old && !ch.length) { V.e2edit = false; FE.eq = null; FS.eq = NEW.eq(); return note("Nenhuma alteração.", 1); }
  o.hist = arr1(old && old.hist).concat([{ at: new Date().toISOString(), t: old ? "Cadastro alterado: " + ch.join(", ") : "Equipamento cadastrado" }]).slice(-100);
  if (!upsert("eq", o)) return note(FAIL);
  FS.eq = NEW.eq(); FE.eq = null; V.e2edit = false; V.e2 = o.id; V.me = o.id; V.e2t = "res";
  note(old ? "Alterações salvas e conferidas." : "Equipamento salvo e conferido. Cadastre agora os componentes.", 1);
}

/* ---------- detalhe do equipamento ---------- */
function eqDetail(f, e) {
  const t = V.e2t || "res", s = estat(e);
  return `<div class="pagehead"><div style="min-width:0"><div class="crumb"><button onclick="go('home')">Fazendas</button> › <button onclick="go('farm','${f.id}')">${E(f.name)}</button> › <button onclick="e2back()">Equipamentos</button></div><h1>${E(eqt(e))} ${e.demo ? '<span class="demo">DEMO</span>' : ""}</h1><div class="mu">${E(e.tipo || "—")}${e.sala ? " · " + E(e.sala) : ""} · ${e.nc || "—"} conjuntos</div></div><div class="acts">${badge(s)}</div></div>`
    + demoNote(f) + `<div class="tabs noprint">${E2T.map(b => `<button class="tb ${t == b[0] ? "on" : ""}" onclick="V.e2t='${b[0]}';V.note=null;render()">${b[1]}</button>`).join("")}</div>` + e2note()
    + ({ res: eqResumo, med: eqMed, cmp: eqCmp, his: eqHist, rl: eqReport }[t] || eqResumo)(f, e);
}
const DD2 = (k, v) => `<dt>${k}</dt><dd>${v == null || v === "" ? '<span class="mu">Sem dados</span>' : v}</dd>`;
function eqFicha(e) {
  return `<dl class="dl">${DD2("Marca / modelo", E(e.fab) + " " + E(e.mod))}${DD2("Nº de série", E(e.ser))}${DD2("Ano de instalação", E(e.ano || ""))}${DD2("Tipo de instalação", E(e.tipo || ""))}${DD2("Tipo de sala", E(e.sala || ""))}${DD2("Conjuntos", E(e.nc || ""))}${DD2("Horas / ordenhas", (e.h || e.o) ? `${fm(nv(e, "h"), 0)} h · ${fm(nv(e, "o"), 0)} ordenhas` : "")}${DD2("Vácuo ajustado", e.lv ? E(e.lv) + " kPa" : "")}${DD2("Pulsação", [e.pul, e.ptx ? e.ptx + " ciclos/min" : "", e.prel ? e.prel + " %" : ""].filter(Boolean).map(E).join(" · "))}${DD2("Linha de leite", E(e.ll || ""))}${DD2("Linha de vácuo", E(e.lvac || ""))}${DD2("Observações", E(e.car || ""))}</dl>`;
}
function eqResumo(f, e) {
  const P = epend(e), pl = allPl().filter(x => x.e && x.e.id == e.id), lsv = lastOf(L("sv").filter(x => x.eid == e.id));
  return `<div class="two"><div><div class="card"><div class="top"><b>Ficha técnica</b>${e.demo ? "" : `<span class="acts noprint"><button class="btn s" onclick="e2edit('${e.id}')">Editar</button><button class="btn s" onclick="e2del('${e.id}')">${V.del == e.id ? "Confirmar exclusão" : "Excluir"}</button></span>`}</div><div style="margin-top:8px">${eqFicha(e)}</div>${e.demo ? "" : `<div class="grid noprint" style="margin-top:8px"><input id="ch${e.id}" inputmode="decimal" placeholder="horas atuais"><input id="co${e.id}" inputmode="decimal" placeholder="ordenhas atuais"></div><button class="btn s noprint" style="margin-top:6px" onclick="cnt('${e.id}')">Atualizar contadores</button>`}</div>
<div class="card"><b>Pendências (${P.filter(p => p.l != "in").length})</b><div class="alist">${P.map(p => `<div class="alert ${p.l}" style="border-color:currentColor" onclick="${p.go == "mt" ? `V.me='${e.id}';goTab(7,'mt')` : `V.e2t='med';render()`}"><span style="color:var(--tx)">${E(p.t)}</span><span class="go">${p.go == "mt" ? "Setor 8 ›" : "Medições ›"}</span></div>`).join("") || '<p class="mu">Nenhuma pendência.</p>'}</div></div>
<div class="card"><b>Manutenção (Setor 8)</b><p class="mu">${pl.length} item(ns) de revisão · ${pl.filter(x => x.st.s == "atrasada").length} atrasado(s) · ${pl.filter(x => x.st.s == "próxima").length} próximo(s)${lsv ? ` · último serviço ${fmtD(lsv.date)} (${E(lsv.tipo)})` : " · nenhum serviço registrado"}</p><div class="acts noprint"><button class="btn s" onclick="V.me='${e.id}';goTab(7,'mt')">Registrar serviço / revisão</button><button class="btn s" onclick="V.e2t='med';render()">Nova medição</button></div></div></div>
<div class="card"><b>Estrutura do equipamento</b>${eqSchema(e)}<button class="btn s noprint" onclick="V.e2t='cmp';render()">Cadastrar componentes</button></div></div>`;
}
function e2del(id) {
  if (V.del != id) { V.del = id; return render(); }
  const n = ["cmp", "pl", "sv", "dx", "dg"].reduce((a, k) => a + DB[k].filter(x => x.eid == id).length, 0);
  edel(id); if (!DB.eq.some(x => x.id == id)) { V.e2 = null; note("Equipamento excluído.", 1); } else if (n) note(`Este equipamento tem ${n} registro(s) vinculados (componentes, revisões, serviços, medições ou diagramas). Exclua-os antes; o histórico não é apagado automaticamente.`);
}

/* ---------- medições (mesmo formulário FS.dx do Setor 8, com medições por ponto) ---------- */
let PT2 = { pt: PTS[0], par: "vac", v: "", obs: "" };
function addPt() {
  const v = num(PT2.v); if (v == null || Number.isNaN(v) || v < 0) return note("Medição por ponto: informe um valor numérico válido.");
  FS.dx.pts = arr1(FS.dx.pts).concat([{ pt: PT2.pt, par: PT2.par, v: String(v), obs: String(PT2.obs || "").replace(/[<>]/g, "").slice(0, 200) }]);
  PT2 = Object.assign({}, PT2, { v: "", obs: "" }); V.note = null; render();
}
function rmPt(i) { FS.dx.pts.splice(i, 1); render(); }
const chkDx2 = o => !o.date ? "Informe a data." : nneg(o, ["vac", "res", "tax", "A", "B", "C", "D", "qd", "vz", "vd"]) || (["A", "B", "C", "D"].some(k => num(o[k]) != null) && ["A", "B", "C", "D"].some(k => num(o[k]) == null) ? "Informe as 4 fases (A, B, C, D) ou nenhuma." : null)
  || (!["vac", "res", "tax", "A", "qd", "vz", "vd"].some(k => num(o[k]) != null) && !arr1(o.pts).length && ["vaz", "mang", "tet", "col"].every(k => o[k] == "OK") ? "Registre ao menos uma medição ou inspeção." : null);
function evalTable(rows, withPt) {
  if (!rows.length) return '<p class="mu">Sem valores.</p>';
  return `<div class="ov"><table><tr>${withPt ? "<th>Ponto</th>" : ""}<th>Parâmetro</th><th>Valor</th><th>Referência</th><th>Situação</th></tr>${rows.filter(x => x.v != null).map(x => `<tr>${withPt ? `<td>${E(x.pt)}</td>` : ""}<td>${x.p[1]}</td><td>${fm(x.v, x.p[3])} ${x.p[2]}</td><td>${x.r ? `${E(rng(x.r))}<br><span class="mu">${E(x.r.fonte)}${x.r.doc ? " · " + E(x.r.doc) : ""}</span>` : '<span class="mu">sem referência verificada</span>'}</td><td class="${x.st == "Fora" ? (x.g == "Alta" ? "cr" : "wa") : x.st == "Conforme" ? "ok" : "na"}">${x.st}${x.g ? " (" + x.g + ")" : ""}</td></tr>`).join("")}</table></div>`;
}
function probList(P) {
  if (!P.length) return '<p class="mu">Nenhum problema identificado pelas referências verificadas e inspeções registradas.</p>';
  return P.map(p => `<div class="alert ${p.g == "Alta" ? "cr" : "wa"}" style="border-color:currentColor"><span style="color:var(--tx)"><b>${p.g}</b> · ${E(p.t)}<br><span class="mu"><b>Causas possíveis:</b> ${p.c.map(E).join("; ")}.</span><br><span class="mu"><b>Ações sugeridas:</b> ${p.a.map(E).join("; ")}.</span></span></div>`).join("")
    + '<p class="mu">Causas e ações são orientações gerais para investigação; confirme em campo e siga o manual do fabricante.</p>';
}
function eqMed(f, e) {
  const S = "dx", ds = eqDx(e), a = lastOf(ds), ev = a ? evalDx(a, e) : null, P = V.e2p || "vac", pr = PNAME[P], gp = V.e2pt || "", r = refFor(P, e, gp || null);
  const ser = ds.map(d => ({ d: d.date, v: gp ? ((arr1(d.pts).filter(x => x.pt == gp && x.par == P).map(x => num(x.v)).filter(x => x != null)[0]) ?? null) : dv(d)[P] })).filter(x => x.v != null);
  const form = e.demo ? '<div class="card mu">Fazenda de demonstração: novas medições não podem ser registradas aqui.</div>' : `<div class="card"><b>${FE.dx ? "Editar medição" : "Nova medição"}</b>
<div class="grid">${fld(S, "date", "Data", "d")}${fld(S, "vac", "Vácuo de trabalho (kPa)", "n")}${fld(S, "res", "Reserva efetiva (L/min)", "n")}${fld(S, "tax", "Taxa de pulsação (ciclos/min)", "n")}${fld(S, "qd", "Quedas de vácuo (n)", "n")}${fld(S, "vd", "Queda de vácuo (kPa)", "n")}${fld(S, "vz", "Vazamento de ar (L/min)", "n")}</div>
<p class="mu" style="margin-top:10px">Fases da pulsação (ms) — a relação é calculada: (A+B)/(A+B+C+D)</p><div class="grid">${fld(S, "A", "Fase A", "n")}${fld(S, "B", "Fase B", "n")}${fld(S, "C", "Fase C", "n")}${fld(S, "D", "Fase D", "n")}</div>
<p class="mu" style="margin-top:10px">Inspeção visual</p><div class="grid">${fld(S, "vaz", "Vazamentos", "sel", ["OK", "Atenção", "Falha"])}${fld(S, "mang", "Mangueiras", "sel", ["OK", "Atenção", "Falha"])}${fld(S, "tet", "Teteiras", "sel", ["OK", "Atenção", "Falha"])}${fld(S, "col", "Coletores", "sel", ["OK", "Atenção", "Falha"])}</div>
<h2>Medições por ponto da instalação</h2>${arr1(FS.dx.pts).map((x, i) => `<p class="mu">${E(x.pt)} · ${(PNAME[x.par] || [0, x.par])[1]}: <b style="color:var(--tx)">${E(x.v)} ${(PNAME[x.par] || [0, 0, ""])[2]}</b>${x.obs ? " · " + E(x.obs) : ""} <button class="btn s" onclick="rmPt(${i})">×</button></p>`).join("")}
<div class="grid"><div><label>Ponto</label><select onchange="PT2.pt=this.value">${PTS.map(p => `<option ${PT2.pt == p ? "selected" : ""}>${p}</option>`).join("")}</select></div><div><label>Parâmetro</label><select onchange="PT2.par=this.value">${MP.filter(p => p[0] != "rel").map(p => `<option value="${p[0]}" ${PT2.par == p[0] ? "selected" : ""}>${p[1]} (${p[2]})</option>`).join("")}</select></div><div><label>Valor</label><input inputmode="decimal" value="${E(PT2.v)}" oninput="PT2.v=this.value"></div><div><label>Obs. do ponto</label><input value="${E(PT2.obs)}" oninput="PT2.obs=this.value"></div></div><button class="btn s" style="margin-top:8px" onclick="addPt()">+ Adicionar medição do ponto</button>
${fld(S, "obs", "Observações gerais")}<br><div class="acts"><button class="btn w" onclick="V.me='${e.id}';gs('dx',chkDx2)">${FE.dx ? "Salvar alterações" : "Salvar medição"}</button>${FE.dx ? `<button class="btn gh w" onclick="FE.dx=null;FS.dx=NEW.dx();render()">Cancelar edição</button>` : ""}</div></div>`;
  return `<div class="two"><div>${form}</div><div>`
    + (ev ? `<div class="card"><b>Última medição — ${fmtD(a.date)}</b>${evalTable(ev.gen)}${ev.pts.length ? `<p class="mu" style="margin-top:8px">Por ponto</p>${evalTable(ev.pts, 1)}` : ""}${a.obs ? `<p class="mu">Obs.: ${E(a.obs)}</p>` : ""}</div><h2>Problemas, causas e ações</h2>${probList(ev.probs)}` : '<div class="card mu">Nenhuma medição registrada para este equipamento.</div>')
    + `<div class="card"><b>Evolução</b><div class="tabs">${MP.map(x => `<button class="tb ${P == x[0] ? "on" : ""}" onclick="V.e2p='${x[0]}';render()">${x[1]}</button>`).join("")}</div><label>Ponto</label><select onchange="V.e2pt=this.value;render()"><option value="">Medição geral</option>${PTS.map(p => `<option ${gp == p ? "selected" : ""}>${p}</option>`).join("")}</select>${tchart(ser, { dec: pr[3], u: pr[2], zero: false, lo: r ? num(r.min) : null, hi: r ? num(r.max) : null, label: pr[1] })}<p class="mu">${pr[1]} (${pr[2]}) · ${ser.length} medição(ões)${r ? ` · faixa da referência verificada: ${E(rng(r))} (${E(r.fonte)})` : " · sem referência verificada"}</p></div>`
    + `<h2>Histórico de medições (${ds.length})</h2>${[...ds].reverse().map(d => { const x = evalDx(d, e); return `<div class="card"><div class="top"><b>${fmtD(d.date)}</b>${xbtn("dx", d, 1)}</div><p class="mu">${MP.map(p => { const v = dv(d)[p[0]]; return v == null ? "" : p[1] + " " + fm(v, p[3]); }).filter(Boolean).join(" · ") || "sem valores gerais"}${arr1(d.pts).length ? ` · ${d.pts.length} medição(ões) por ponto` : ""}</p><p class="mu">${x.probs.length ? `<span class="${x.probs.some(p => p.g == "Alta") ? "cr" : "wa"}">${x.probs.length} problema(s)</span>` : "sem problemas identificados"}</p></div>`; }).join("")}</div></div>`;
}

/* ---------- componentes e diagramas ---------- */
function eqCmp(f, e) {
  const S = "cmp", D = "dg", cm = L("cmp").filter(c => c.eid == e.id), dgs = L("dg").filter(d => d.eid == e.id || (!d.eid && d.mod && nrm(d.mod) == nrm(e.mod))), pc = L("pc");
  const grp = BLOCKS.map(b => ({ b, l: cm.filter(c => b.ct.includes(c.tipo)) })).concat([{ b: { n: "Outros" }, l: cm.filter(c => !blockOf(c.tipo)) }]).filter(g => g.l.length);
  const form = e.demo ? "" : `<div class="card"><b>${FE.cmp ? "Editar componente" : "Novo componente"}</b><div class="grid">${fld(S, "tipo", "Tipo", "sel", CT)}${fld(S, "nome", "Nome / descrição")}${fld(S, "marca", "Marca")}${fld(S, "mod", "Modelo")}${fld(S, "ser", "Nº de série")}${fld(S, "qtd", "Quantidade", "n")}${fld(S, "pos", "Posição / local na instalação")}${fld(S, "inst", "Data de instalação", "d")}</div>${fld(S, "esp", "Dados técnicos declarados (com a fonte)")}<div class="grid">${fld(S, "cod", "Código da peça (se confirmado)")}${fld(S, "fonte", "Fonte do código")}</div>${fld(S, "conf", "Código confirmado em catálogo ou nota fiscal", "chk")}<br><div class="acts"><button class="btn w" onclick="V.me='${e.id}';gs('cmp',chk8c,o=>{o.hist=arr1(o.hist).concat([{at:new Date().toISOString(),t:FE.cmp?'Componente alterado':'Componente cadastrado'}])})">${FE.cmp ? "Salvar alterações" : "Salvar componente"}</button>${FE.cmp ? `<button class="btn gh w" onclick="FE.cmp=null;FS.cmp=NEW.cmp();render()">Cancelar</button>` : ""}</div><p class="mu">O app não preenche códigos de peças. Sem confirmação, o código aparece como “não confirmado”.</p></div>`;
  const dform = e.demo ? "" : `<div class="card"><b>Novo diagrama deste equipamento</b><div class="grid">${fld(D, "tit", "Título")}${fld(D, "fonte", "Fonte (ex.: manual do fabricante, foto do técnico)")}${fld(D, "doc", "Identificação do documento (nº, revisão, página)")}</div>${fld(D, "ofi", "É documento oficial do fabricante (exige fonte e identificação)", "chk")}${phs("PG")}<br><button class="btn" onclick="e2dgSave('${e.id}')">Salvar diagrama</button><p class="mu">Toque na imagem salva para marcar peças do catálogo. Diagramas sem a marcação “oficial” aparecem como não oficiais.</p></div>`;
  return `<div class="two"><div>${form}<h2>Componentes (${cm.length})</h2>${grp.length ? grp.map(g => `<p class="mu" style="margin-top:12px"><b>${E(g.b.n)}</b></p>` + g.l.map(c => `<div class="card"><div class="top"><b>${E(c.tipo)}: ${E(c.nome)}</b>${xbtn("cmp", c, 1)}</div><p class="mu">${[c.marca, c.mod, c.ser ? "#" + c.ser : ""].filter(Boolean).map(E).join(" ")} · qtd ${E(c.qtd || "—")}${c.pos ? " · " + E(c.pos) : ""}${c.inst ? " · instalado em " + fmtD(c.inst) : ""}</p><p class="mu">${c.cod ? E(c.cod) + (c.conf ? " ✔ confirmado (" + E(c.fonte) + ")" : " ⚠ NÃO confirmado") : "código não informado"}${c.esp ? " · " + E(c.esp) : ""}</p></div>`).join("")).join("") : '<div class="card mu">Nenhum componente cadastrado.</div>'}</div>
<div><div class="card"><b>Estrutura</b>${eqSchema(e)}</div><h2>Diagramas (${dgs.length})</h2>${dgs.map(d => `<div class="card"><div class="top"><b>${E(d.tit)}</b>${xbtn("dg", d, 0)}</div><p class="mu">${d.ofi ? `<span class="badge ok">Documento oficial informado</span> ${E(d.doc || "")} · ` : '<span class="badge sd">Não oficial</span> '}Fonte: ${E(d.fonte)}</p>${d.demo ? "" : `<select id="pinp${d.id}"><option value="">Peça a marcar…</option>${pc.map(p => `<option value="${p.id}">${E(p.nome)}${p.cod ? " · " + E(p.cod) : ""}</option>`).join("")}</select>`}<div style="position:relative" ${d.demo ? "" : `onclick="pinadd(event,'${d.id}')"`}>${d.img ? `<img src="${d.img}" alt="${E(d.tit)}" style="width:100%;border-radius:8px;display:block">` : ""}${arr1(d.pins).map(p => `<span style="position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);background:var(--cr);color:#fff;border-radius:99px;min-width:22px;height:22px;text-align:center;font-size:12px;line-height:22px">${p.n}</span>`).join("")}</div>${arr1(d.pins).map((p, i) => { const q = pc.find(x => x.id == p.pid) || {}; return `<p class="mu">${p.n}. ${E(q.nome || "peça não vinculada")}${q.cod ? ` · ${E(q.cod)} ${q.conf ? "✔" : "⚠ não confirmado"}` : ""} ${d.demo ? "" : `<button class="btn s" onclick="pinrm('${d.id}',${i})">×</button>`}</p>`; }).join("")}</div>`).join("") || '<div class="card mu">Nenhum diagrama. O app não traz diagramas oficiais: envie o documento do fabricante ou uma foto sua.</div>'}${dform}
<button class="btn s noprint" onclick="goTab(7,'pc')">Catálogo de peças (Setor 8)</button></div></div>`;
}

function e2dgSave(id) {
  const e = DB.eq.find(x => x.id == id); if (!e) return;
  FS.dg.eid = id; FS.dg.mod = FS.dg.mod || e.mod;
  gs("dg", o => !o.tit.trim() || !o.fonte.trim() ? "Informe título e fonte." : o.ofi && !String(o.doc || "").trim() ? "Diagrama oficial exige a identificação do documento." : !PG.length ? "Envie a imagem do diagrama." : null, o => { o.img = PG[0]; }, () => { PG = []; });
}

/* ---------- histórico individual ---------- */
function eqTimeline(e) {
  const T = [];
  arr1(e.hist).forEach(h => T.push({ d: h.at.slice(0, 10), i: "📝", t: h.t }));
  L("cmp").filter(c => c.eid == e.id).forEach(c => { if (c.inst) T.push({ d: c.inst, i: "🔩", t: `Componente instalado: ${c.tipo} — ${c.nome}` }); arr1(c.hist).forEach(h => T.push({ d: h.at.slice(0, 10), i: "🔩", t: `${h.t}: ${c.tipo} — ${c.nome}` })); });
  L("sv").filter(s => s.eid == e.id).forEach(s => T.push({ d: s.date, i: "🔧", t: `Serviço (${s.tipo})${s.prob ? ": " + s.prob : ""}${s.parts.length ? " · peças: " + s.parts.map(p => p.n + " ×" + p.q).join(", ") : ""} · R$ ${fm(svCost(s), 2)}` }));
  eqDx(e).forEach(d => { const x = evalDx(d, e); T.push({ d: d.date, i: "📏", t: `Medição${arr1(d.pts).length ? " (" + d.pts.length + " por ponto)" : ""}: ${x.probs.length ? x.probs.length + " problema(s)" : "sem problemas identificados"}` }); });
  return T.sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : 0);
}
function eqHist(f, e) {
  const T = eqTimeline(e);
  return `<div class="card"><b>Histórico de ${E(eqt(e))} (${T.length})</b>${T.length ? `<div style="margin-top:8px">${T.map(x => `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd)"><span>${x.i}</span><span style="min-width:0"><span class="mu">${fmtD(x.d)}</span><br>${E(x.t)}</span></div>`).join("")}</div>` : '<p class="mu">Sem registros.</p>'}</div>`;
}

/* ---------- relatório individual ---------- */
function eqReport(f, e) {
  const R = DB.rm[e.id] || {}, ds = eqDx(e), a = lastOf(ds), ev = a ? evalDx(a, e) : null, cm = L("cmp").filter(c => c.eid == e.id), P = epend(e).filter(p => p.go == "mt"), sv = L("sv").filter(s => s.eid == e.id), pt = {};
  sv.forEach(s => s.parts.forEach(q => pt[q.n] = (pt[q.n] || 0) + (num(q.q) || 0)));
  const used = ev ? [...new Set(ev.gen.concat(ev.pts).filter(x => x.r).map(x => x.r))] : [];
  const ch = k => { const s = ds.map(d => ({ d: d.date, v: dv(d)[k] })).filter(x => x.v != null), r = refFor(k, e, null); return s.length ? `<p class="mu">${PNAME[k][1]} (${PNAME[k][2]})</p>${tchart(s, { dec: PNAME[k][3], zero: false, lo: r ? num(r.min) : null, hi: r ? num(r.max) : null, label: PNAME[k][1] })}` : ""; };
  return `<div class="card"><h1>Diagnóstico técnico do equipamento</h1>${e.demo ? '<p><span class="demo" style="white-space:normal;display:inline-block">DADOS DE DEMONSTRAÇÃO — valores e referências fictícios, não é um diagnóstico</span></p>' : ""}
<p><b>${E(f.name)}</b> · ${E(f.producer)} · ${E(f.city)}</p><p class="mu">Gerado em ${new Date().toLocaleString("pt-BR")}</p>
<h2>1. Equipamento</h2>${eqFicha(e)}
<h2>2. Componentes</h2>${cm.length ? `<div class="ov"><table><tr><th>Tipo</th><th>Descrição</th><th>Qtd</th><th>Código</th></tr>${cm.map(c => `<tr><td>${E(c.tipo)}</td><td>${E(c.nome)} ${E(c.marca || "")} ${E(c.mod || "")}</td><td>${E(c.qtd || "—")}</td><td>${c.cod ? E(c.cod) + (c.conf ? " (confirmado: " + E(c.fonte) + ")" : " (não confirmado)") : "—"}</td></tr>`).join("")}</table></div>` : '<p class="mu">Nenhum componente cadastrado.</p>'}
<h2>3. Estrutura</h2>${eqSchema(e)}
<h2>4. Medições${a ? " — " + fmtD(a.date) : ""}</h2>${ev ? evalTable(ev.gen) + (ev.pts.length ? `<p class="mu">Por ponto da instalação</p>${evalTable(ev.pts, 1)}` : "") : '<p class="mu">Nenhuma medição registrada.</p>'}
<h2>5. Problemas identificados, causas possíveis e ações</h2>${ev ? probList(ev.probs) : '<p class="mu">Sem medição para avaliar.</p>'}
<h2>6. Evolução</h2>${["vac", "res", "rel", "vd"].map(ch).join("") || '<p class="mu">Sem medições suficientes.</p>'}
<h2>7. Manutenção</h2>${P.length ? `<ul>${P.map(p => `<li>${E(p.t)}</li>`).join("")}</ul>` : '<p class="mu">Sem pendências de revisão.</p>'}<p class="mu">${sv.length} serviço(s) · custo total R$ ${fm(sv.reduce((x, s) => x + svCost(s), 0), 2)}${Object.keys(pt).length ? " · peças substituídas: " + Object.entries(pt).map(([k, v]) => E(k) + " (" + v + ")").join(", ") : ""}</p>
<h2>8. Referências utilizadas</h2>${used.length ? `<ul>${used.map(r => `<li>${PNAME[r.par] ? PNAME[r.par][1] : E(r.par)}${r.pt ? " — " + E(r.pt) : ""}: ${E(rng(r))} · ${E(r.fab)} ${E(r.mod || "(todos os modelos)")} · fonte: ${E(r.fonte)}${r.doc ? " · " + E(r.doc) : ""} · verificada</li>`).join("")}</ul>` : '<p class="mu">Nenhuma referência verificada aplicada: os parâmetros aparecem como “Não avaliado”.</p>'}
<p class="mu">Nenhum limite técnico foi aplicado sem referência cadastrada e verificada pelo técnico. O esquema é genérico e não substitui documentação oficial do fabricante.</p>
<h2>9. Observações e responsável técnico</h2><textarea class="noprint" rows="3" oninput="rmset('${e.id}','obs',this.value)">${E(R.obs || "")}</textarea><p style="white-space:pre-wrap">${E(R.obs || "")}</p><input class="noprint" placeholder="Nome do técnico" value="${E(R.tec || "")}" oninput="rmset('${e.id}','tec',this.value)"><p>${E(R.tec || "")}</p>${R.sig ? `<img src="${R.sig}" alt="Assinatura" style="max-width:100%;height:80px">` : ""}
${e.demo ? "" : `<div class="noprint"><canvas id="sg" width="300" height="100" style="border:1px solid var(--bd);border-radius:8px;touch-action:none;width:100%;background:#fff" onpointerdown="sgd(event)" onpointermove="sgm(event)" onpointerup="sgu()" onpointerleave="sgu()"></canvas><div class="grid"><button class="btn s" style="width:100%" onclick="$('sg').getContext('2d').clearRect(0,0,300,100)">Limpar</button><button class="btn s" style="width:100%" onclick="sgs8('${e.id}')">Salvar assinatura</button></div><p class="mu">Observações, técnico e assinatura são os mesmos do relatório de manutenção deste equipamento (Setor 8).</p></div>`}</div>
<button class="btn noprint" onclick="window.print()">Imprimir / salvar em PDF</button>`;
}

/* ---------- comparativo outra marca × GEA (só dados registrados) ---------- */
function eqPool() { // equipamentos que podem ser comparados: mesma natureza (reais com reais, demo com demo)
  const demo = F().demo; return farms.filter(f => f.demo == demo && (!demo || f.id == V.f)).flatMap(f => withFarm(f.id, () => L("eq").map(e => ({ e, f }))));
}
function eqMetrics(x) {
  return withFarm(x.f.id, () => {
    const e = x.e, d = lastOf(eqDx(e)), ev = d ? evalDx(d, e) : null, sv = L("sv").filter(s => s.eid == e.id), h = nv(e, "h");
    const cost = sv.reduce((a, s) => a + svCost(s), 0), fails = sv.reduce((a, s) => a + Object.values(s.ck || {}).filter(v => v == "Falha").length, 0);
    return { e, f: x.f, d, ev, nsv: sv.length, nco: sv.filter(s => s.tipo == "Corretiva").length, fails, cost, c1k: h > 0 && sv.length ? cost / h * 1000 : null, late: allPl().filter(p => p.e && p.e.id == e.id && p.st.s == "atrasada").length, ndx: eqDx(e).length };
  });
}
function eqCompare(f) {
  const pool = eqPool(), other = pool.filter(x => !isGEA(x.e)), gea = pool.filter(x => isGEA(x.e));
  if (!pool.length) return '<div class="card mu">Sem equipamentos para comparar.</div>';
  if (!other.length) return '<div class="card mu">Nenhum equipamento de outra marca cadastrado. O comparativo mostra um equipamento de outra marca ao lado de um GEA, usando apenas os registros e as referências verificadas.</div>';
  if (!gea.length) return '<div class="card mu">Nenhum equipamento GEA cadastrado' + (f.demo ? "" : " nas suas fazendas") + ' para comparar. O app não usa especificações GEA que não tenham sido cadastradas por você.</div>';
  const ka = V.cpa && pool.some(x => x.e.id == V.cpa) ? V.cpa : other[0].e.id, kb = V.cpb && pool.some(x => x.e.id == V.cpb) ? V.cpb : gea[0].e.id;
  const A = eqMetrics(pool.find(x => x.e.id == ka)), B = eqMetrics(pool.find(x => x.e.id == kb));
  const op = (l, s) => l.map(x => `<option value="${x.e.id}" ${x.e.id == s ? "selected" : ""}>${E(eqt(x.e))}${x.f.id != V.f ? " · " + E(x.f.name) : ""}</option>`).join("");
  const row = (l, a, b) => `<tr><td>${l}</td><td>${a == null || a === "" ? '<span class="mu">Sem dados</span>' : a}</td><td>${b == null || b === "" ? '<span class="mu">Sem dados</span>' : b}</td></tr>`;
  const meas = (M, k) => { if (!M.ev) return null; const g = M.ev.gen.find(x => x.p[0] == k); if (!g || g.v == null) return null; return `${fm(g.v, g.p[3])} ${g.p[2]}<br><span class="${g.st == "Fora" ? "wa" : g.st == "Conforme" ? "ok" : "mu"}">${g.st}${g.r ? " · ref. " + E(g.r.fonte) : ""}</span>`; };
  return `<div class="card"><b>Comparativo técnico</b><div class="grid"><div><label>Equipamento (outra marca)</label><select onchange="V.cpa=this.value;render()">${op(other, ka)}</select></div><div><label>Equipamento GEA</label><select onchange="V.cpb=this.value;render()">${op(gea, kb)}</select></div></div></div>
<div class="card ov"><table><tr><th></th><th>${E(eqt(A.e))}</th><th>${E(eqt(B.e))}</th></tr>
${row("Fazenda", E(A.f.name), E(B.f.name))}${row("Tipo de instalação / sala", E([A.e.tipo, A.e.sala].filter(Boolean).join(" · ")), E([B.e.tipo, B.e.sala].filter(Boolean).join(" · ")))}${row("Conjuntos", E(A.e.nc || ""), E(B.e.nc || ""))}${row("Ano de instalação", E(A.e.ano || ""), E(B.e.ano || ""))}${row("Horas / ordenhas", A.e.h ? fm(nv(A.e, "h"), 0) + " h · " + fm(nv(A.e, "o"), 0) : "", B.e.h ? fm(nv(B.e, "h"), 0) + " h · " + fm(nv(B.e, "o"), 0) : "")}
${row("Última medição", A.d ? fmtD(A.d.date) : "", B.d ? fmtD(B.d.date) : "")}${MP.map(p => row(p[1], meas(A, p[0]), meas(B, p[0]))).join("")}
${row("Problemas na última medição", A.ev ? String(A.ev.probs.length) : "", B.ev ? String(B.ev.probs.length) : "")}${row("Medições registradas", String(A.ndx), String(B.ndx))}${row("Serviços (corretivos)", `${A.nsv} (${A.nco})`, `${B.nsv} (${B.nco})`)}${row("Itens em falha nos checklists", String(A.fails), String(B.fails))}${row("Custo de manutenção", A.nsv ? "R$ " + fm(A.cost, 2) : "", B.nsv ? "R$ " + fm(B.cost, 2) : "")}${row("Custo por 1.000 h", A.c1k != null ? "R$ " + fm(A.c1k, 2) : "", B.c1k != null ? "R$ " + fm(B.c1k, 2) : "")}${row("Revisões atrasadas", String(A.late), String(B.late))}
</table></div><p class="mu">Comparação descritiva feita apenas com os registros cadastrados. Cada medição é avaliada pela referência verificada da <b>própria marca/modelo</b>; sem referência, aparece “Não avaliado”. Idade, uso, manutenção e rebanho diferentes influenciam os números: não é um teste de desempenho entre fabricantes.</p>${f.demo ? '<p class="mu"><span class="demo">DEMO</span> Dados fictícios.</p>' : ""}`;
}

/* ---------- referências técnicas (mesma coleção DB.rf do Setor 8; base da biblioteca da Etapa 3) ---------- */
const chkRf = o => !o.fab.trim() || !o.fonte.trim() ? "Informe fabricante e fonte." : num(o.min) == null && num(o.max) == null ? "Informe mínimo e/ou máximo." : nneg(o, ["min", "max"]) || (num(o.min) != null && num(o.max) != null && num(o.min) > num(o.max) ? "Mínimo maior que máximo." : null);
function eqRefs(f) {
  const R = "rf", rf = L("rf");
  return (f.demo ? "" : `<div class="card"><b>${FE.rf ? "Editar referência" : "Nova referência técnica"}</b><div class="grid">${fld(R, "fab", "Fabricante")}${fld(R, "mod", "Modelo (vazio = todos)")}<div><label>Parâmetro</label><select onchange="FS.rf.par=this.value">${MP.map(p => `<option value="${p[0]}" ${FS.rf.par == p[0] ? "selected" : ""}>${p[1]} (${p[2]})</option>`).join("")}</select></div><div><label>Ponto da instalação</label><select onchange="FS.rf.pt=this.value"><option value="">Medição geral</option>${PTS.map(p => `<option ${FS.rf.pt == p ? "selected" : ""}>${p}</option>`).join("")}</select></div>${fld(R, "min", "Mínimo", "n")}${fld(R, "max", "Máximo", "n")}${fld(R, "un", "Unidade")}${fld(R, "grav", "Gravidade se fora", "sel", GR)}</div>${fld(R, "fonte", "Fonte (obrigatória: norma, manual, boletim)")}${fld(R, "doc", "Identificação (edição, item, página)")}${fld(R, "ver", "Conferi o valor na fonte original (referência verificada)", "chk")}<br><button class="btn" onclick="gs('rf',chkRf)">${FE.rf ? "Salvar alterações" : "Salvar referência"}</button><p class="mu">O app não traz valores normativos. Só referências verificadas classificam medições; as demais ficam guardadas mas não são usadas.</p></div>`)
    + `<h2>Referências (${rf.length})</h2>` + (rf.map(r => `<div class="card"><div class="top"><b>${E(r.fab)} ${E(r.mod) || "(todos)"} · ${PNAME[r.par] ? PNAME[r.par][1] : E(r.par)}${r.pt ? " · " + E(r.pt) : ""}</b>${xbtn("rf", r, 1)}</div><p class="mu">${E(rng(r))} · <span class="${r.ver ? "ok" : "wa"}">${r.ver ? "verificada" : "NÃO verificada (não usada)"}</span> · gravidade ${E(r.grav)}</p><p class="mu">Fonte: ${E(r.fonte)}${r.doc ? " · " + E(r.doc) : ""}</p></div>`).join("") || '<div class="card mu">Nenhuma referência cadastrada: todas as medições aparecem como “Não avaliado”.</div>');
}
