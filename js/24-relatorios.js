/* ===== Relatórios por setor e relatório completo (PDF) =====
 * Reúne os relatórios que cada setor já gera e permite:
 *  - abrir/salvar em PDF o relatório de um setor;
 *  - gerar o "Relatório completo": relatório geral da fazenda + todos os setores, cada um começando
 *    numa página nova, num único PDF.
 * O PDF é feito pelo "Imprimir → Salvar como PDF" do aparelho (funciona sem internet).
 */
/* cada item: rótulo, setor, se há dados e como desenhar o relatório (na fazenda atual) */
const REPS = [
  { k: "q", n: "Qualidade do leite", s: 4, has: () => QA().length || QT().length, html: () => qRl() },
  { k: "o", n: "Ordenha e ordenhadores", s: 5, has: () => SS().length, html: () => vRl() },
  { k: "e", n: "Equipamentos (diagnóstico por equipamento)", s: 1, has: () => L("eq").length, html: f => L("eq").map(e => { V.me = e.id; return eqReport(f, e); }).join('<div class="pbreak"></div>') },
  { k: "i", n: "ISO Check (última auditoria de cada equipamento)", s: 2, has: () => L("iso").length, html: f => L("eq").map(e => lastOf(isoOf(e.id))).filter(Boolean).map(a => isoDetail(f, a)).join('<div class="pbreak"></div>') },
  { k: "t", n: "Testes técnicos (último de cada tipo)", s: 3, has: () => L("tt").length, html: f => ["lr", "campo", "ext"].map(t => lastOf(L("tt").filter(x => x.tipo == t))).filter(Boolean).map(t => ttDetail(f, t)).join('<div class="pbreak"></div>') },
  { k: "c", n: "Limpeza CIP e água", s: 6, has: () => CYS().length || WAS().length, html: () => vRc() },
  { k: "m", n: "Manutenção (por equipamento)", s: 7, has: () => L("eq").length, html: () => L("eq").map(e => { V.me = e.id; return vR8(); }).join('<div class="pbreak"></div>') }];

/* desenha relatórios de setores sem mexer no estado da tela (equipamento selecionado, nota...) */
function repHtml(f, list) {
  const keep = { me: V.me, note: V.note, i3: V.i3, t4: V.t4 }; V.note = null;
  try { return withFarm(f.id, () => list.map(r => `<section class="repsec"><div class="rephead"><span>${E(f.name)}</span><b>${E(r.n)}</b></div>${r.has() ? tidy(r.html(f)) : '<p class="mu">Sem registros neste setor.</p>'}</section>`).join('<div class="pbreak"></div>')); }
  finally { Object.assign(V, keep); }
}
function repOpen(k) { V.rk = k; go("rall", V.f); }
function repPrint(k) { V.rk = k; go("rall", V.f); setTimeout(() => window.print(), 300); }

/* tela: um relatório de setor (V.rk) ou o completo (V.rk = "all") */
function rall() {
  const f = F(), k = V.rk || "all", list = k == "all" ? REPS : REPS.filter(r => r.k == k);
  const title = k == "all" ? "Relatório completo" : "Relatório — " + (list[0] || {}).n;
  return `<div class="noprint">${farmHead(f, "🧾 " + E(title), E(f.producer) + " · " + E(f.city))}<div class="card"><div class="acts"><button class="btn w" onclick="window.print()">📄 Salvar PDF</button><button class="btn gh w" onclick="go('frel',V.f)">← Relatórios</button></div><p class="mu">No celular: toque em “Salvar PDF” e escolha <b>Salvar como PDF</b> (ou a impressora). Cada setor começa numa página nova.</p></div></div>`
    + (k == "all" ? `<section class="repsec">${frelBody(f)}</section><div class="pbreak"></div>` : "") + repHtml(f, list);
}
/* o relatório geral (comparativo) sem os controles de tela, para entrar no relatório completo */
function frelBody(f) { const h = frel(), i = h.indexOf('<div class="card report">'); return i < 0 ? h : h.slice(i); }

/* central de relatórios no topo da aba Relatório */
{ const base = frel; frel = function () {
  const f = F(), h = base(), cut = h.indexOf('<div class="card report">');
  if (cut < 0 || V.v != "frel") return h;
  const hub = `<div class="card noprint"><b>Relatórios em PDF</b><p class="mu">Gere o relatório de um setor ou o relatório completo (geral + todos os setores) num único PDF.</p>
<button class="btn" style="margin:6px 0 10px" onclick="repPrint('all')">📚 Relatório completo — todos os setores (PDF)</button>
<div class="replist">${withFarm(f.id, () => REPS.map(r => { const n = r.has(); return `<div class="repit"><span><b>${E(r.n)}</b><br><span class="mu">${n ? "com registros" : "sem registros"}</span></span><span class="acts"><button class="btn s" ${n ? "" : "disabled"} onclick="repOpen('${r.k}')">Ver</button><button class="btn s" ${n ? "" : "disabled"} onclick="repPrint('${r.k}')">PDF</button></span></div>`; }).join(""))}</div>
<p class="mu">Abaixo: relatório geral da fazenda, comparando o período atual com o anterior.</p></div>`;
  return h.slice(0, cut) + hub + h.slice(cut);
}; }

/* Ranking único: as telas e relatórios antigos (rank) passam a usar o ranking ponderado (rank2),
 * para o mesmo ordenhador não aparecer com duas pontuações diferentes. Campos antigos mantidos. */
rank = function (ss) {
  return rank2(ss, F()).map(r => ({ n: r.n, sc: r.sc, nc: r.m.nc, a: agg(r.l), rot: r.c.rot, hig: r.m.hig, ef: r.c.prod, lots: [...new Set(r.l.map(s => s.lot || "—"))], tn: [...new Set(r.l.map(s => s.turn))] }));
};
