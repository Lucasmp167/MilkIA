#!/usr/bin/env node
/* MilkIQ — testes automatizados e verificações de integridade (Etapa 0).
 * Uso:  node tests/run.js            (todos)
 *       node tests/run.js backup     (só os testes cujo nome contém "backup")
 * Requer Playwright + Chromium (npm i -D playwright && npx playwright install chromium).
 */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http"), crypto = require("crypto");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const APP = process.env.MILKIQ_APP || "index.html";
const FIXTURE = path.join(ROOT, "milkiq-backup-20261111-2235.json");
const OUT = path.join(__dirname, "out");
const filter = process.argv[2] || "";

/* Código-fonte do app: o HTML + todos os arquivos CSS/JS locais que ele carrega. */
function appSource(app = APP) {
  const html = fs.readFileSync(path.join(ROOT, app), "utf8"), dir = path.dirname(path.join(ROOT, app));
  const files = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="(?!https?:)([^"]+)"/g)].map(m => m[1]);
  return html + files.map(f => "\n" + fs.readFileSync(path.join(dir, f), "utf8")).join("");
}

/* ---------- mini harness ---------- */
const T = [];
const test = (name, fn) => T.push({ name, fn });
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: esperado ${JSON.stringify(b)}, obtido ${JSON.stringify(a)}`); };

/* ---------- servidor estático local ---------- */
function serve() {
  const types = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".js": "text/javascript", ".css": "text/css", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };
  const srv = http.createServer((req, res) => {
    let p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (p.startsWith(ROOT) && fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html"); // como o GitHub Pages
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => srv.listen(0, "127.0.0.1", () => r(srv)));
}

let browser, base;
/* Abre o app numa sessão de navegador limpa (localStorage vazio) e coleta erros. */
async function open(opts = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: opts.viewport || { width: 390, height: 844 }, ...(opts.ctx || {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("dialog", d => d.dismiss());
  await page.goto(`${base}/${opts.app || APP}`);
  await page.waitForFunction(() => window.MQ_READY === true);
  return { ctx, page, errors, close: () => ctx.close() };
}
const txt = page => page.textContent("#app");
const noErrors = errors => ok(errors.length === 0, "erros no console:\n  " + errors.join("\n  "));

/* Percorre todas as telas, setores e abas das duas fazendas demo. */
async function visitAll(page) {
  const seen = [];
  for (const v of [["home"], ["farm", "modelo"], ["kpi"], ["visit"], ["new"], ["backup"], ["fdel"], ["farm", "critica"], ["kpi", "critica"]]) {
    await page.evaluate(a => go(...a), v); seen.push(v.join(":"));
  }
  for (const fid of ["modelo", "critica"]) for (let s = 0; s < 9; s++) {
    await page.evaluate(([f, s]) => go("sector", f, s), [fid, s]);
    const n = await page.$$eval(".tabs .tb", x => x.length);
    for (let i = 0; i < n; i++) {
      const t = await page.$$(".tabs .tb");
      if (t[i]) { await t[i].click(); seen.push(`${fid}:s${s + 1}:tab${i}`); }
    }
    if (!n) seen.push(`${fid}:s${s + 1}`);
  }
  return seen;
}

/* ===================== 1. Integridade dos arquivos ===================== */
test("integridade: cópia original preservada (SHA-256)", () => {
  const dir = path.join(ROOT, "legacy");
  const lines = fs.readFileSync(path.join(dir, "SHA256SUMS"), "utf8").trim().split("\n");
  ok(lines.length > 0, "SHA256SUMS vazio");
  for (const l of lines) {
    const [hex, name] = l.split(/\s+\*?/);
    const h = crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, name))).digest("hex");
    eq(h, hex, `hash de legacy/${name}`);
  }
});

test("integridade: backup de 11/11 intacto (checksum do próprio arquivo)", () => {
  const f = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  eq(f.format, "milkiq-backup", "formato");
  const h = crypto.createHash("sha256").update(JSON.stringify(f.body)).digest("hex");
  eq(h, f.checksum.hex, "checksum do corpo");
});

/* Inventário de funcionalidades: se algum destes nomes sumir do código, uma tela foi removida. */
const INVENTORY = {
  "Setor 6 – ordenha": ["ord", "vCro", "vCmp", "vRk", "vGr", "vHi", "vRl", "tstart", "tpause", "tfin", "tmark", "tsave", "ssave", "rank", "agg", "calc"],
  "Setor 5 – qualidade": ["qual", "qAn", "qEv", "qBa", "qTe", "qIn", "qRl", "asave", "evSave", "tsv", "qphoto", "gset"],
  "Setor 7 – CIP": ["cip", "vCy", "vPq", "vWa", "vGc", "vBc", "vRc", "cysave", "psave", "wsave"],
  "Setor 8 – manutenção": ["man", "vEq", "vMt", "vPc", "vDx", "vG8", "vR8", "cls", "probs"],
  "Fazendas/visitas": ["home", "farm", "kpiv", "sector", "visit", "saveVisit", "newf", "addFarm"],
  "Etapa 2 – Equipamentos": ["eqv", "eqList", "eqForm", "eqSave", "eqDetail", "eqResumo", "eqMed", "eqCmp", "eqHist", "eqReport", "eqCompare", "eqRefs", "eqSchema", "evalDx", "estat", "epend", "refFor", "judge", "addPt", "e2dgSave", "eqTimeline"],
  "Offline / PWA": ["idbMirror", "bootOffline", "restoreFromIdb", "askPersist", "swRegister", "swUpdate", "offlineCard", "installCard", "netNotice"],
  "Etapa 1 – Central": ["sstat", "falerts", "fkpi", "kpiGrid", "tchart", "farmCard", "ficha", "farmDelView", "farmDelete", "farmCounts", "openEdit", "sideNav", "sectorStrip", "bottomNav", "render", "withFarm", "goTab"],
  "Dados/backup": ["ldS", "svS", "migrate", "initData", "drSnap", "drRestore", "buildFile", "bkExport", "bkCopy", "bkAnalyze", "bkApply", "bkUndo", "bkv", "hashHex"],
};
test("integridade: inventário de funcionalidades presente no código", () => {
  const src = appSource();
  const miss = [];
  for (const [area, fns] of Object.entries(INVENTORY)) for (const f of fns)
    if (!new RegExp(`function ${f}\\(`).test(src)) miss.push(`${area}: ${f}`);
  ok(!miss.length, "funções ausentes: " + miss.join(", "));
});

test("integridade: app autocontido (sem scripts ou estilos externos)", () => {
  const src = appSource();
  const ext = src.match(/<(script|link)[^>]+(src|href)=["']https?:[^"']+/gi) || [];
  ok(!ext.length, "recursos externos: " + ext.join(", "));
});

test("integridade: arquivo único gerado (tools/bundle.js) abre todas as telas sem erro", async () => {
  if (APP !== "index.html") return; // só para o app atual
  const out = path.join(OUT, "milkiq-bundle.html");
  fs.writeFileSync(out, require("../tools/bundle.js").bundle(path.join(ROOT, "index.html")));
  const html = fs.readFileSync(out, "utf8");
  ok(!/<script src=|<link rel="stylesheet"/.test(html), "o arquivo único ainda referencia arquivos externos");
  const s = await open({ app: path.relative(ROOT, out) });
  try { await visitAll(s.page); noErrors(s.errors); } finally { await s.close(); }
});

/* ===================== 2. Telas e console ===================== */
for (const [label, viewport] of [["celular 390×844", { width: 390, height: 844 }], ["computador 1366×900", { width: 1366, height: 900 }]]) {
  test(`telas: todas as telas, setores e abas abrem sem erro (${label})`, async () => {
    const s = await open({ viewport });
    try {
      const seen = await visitAll(s.page);
      ok(seen.length >= 50, "poucas telas percorridas: " + seen.length);
      noErrors(s.errors);
    } finally { await s.close(); }
  });
}

test("telas: sem rolagem horizontal da página no celular", async () => {
  const s = await open();
  const bad = [];
  try {
    const views = [["home"], ["farm", "modelo"], ["kpi"], ["visit"], ["new"], ["backup"]];
    for (let i = 0; i < 9; i++) views.push(["sector", "critica", i]);
    for (const v of views) {
      await s.page.evaluate(a => go(...a), v);
      const w = await s.page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      if (w[0] > w[1] + 1) bad.push(`${v.join(":")} (${w[0]}px > ${w[1]}px)`);
    }
    ok(!bad.length, "páginas mais largas que a tela: " + bad.join("; "));
  } finally { await s.close(); }
});

test("telas: Central da Fazenda tem os 9 setores", async () => {
  const s = await open();
  try {
    await s.page.evaluate(() => go("farm", "modelo"));
    eq(await s.page.$$eval(".sec", x => x.length), 9, "cartões de setor");
    noErrors(s.errors);
  } finally { await s.close(); }
});

/* ===================== 3. Fluxos de dados reais ===================== */
test("fluxo: fazenda real + análise + teste de ordenha + visita persistem após recarregar", async () => {
  const s = await open(), p = s.page;
  try {
    await p.evaluate(() => { NF = Object.assign(newNF(), { name: "Fazenda Teste", producer: "Produtor T", city: "Cidade/UF", cows: "50", milking: "40", goal: "250" }); addFarm(); });
    const fid = await p.evaluate(() => V.f);
    ok(/^u\d+$/.test(fid), "fazenda real não foi criada: " + fid);
    // análise de leite (Setor 5)
    await p.evaluate(fid => { go("sector", fid, 4); V.q = "an"; AF = Object.assign(newAF(), { tk: "Tanque 1", ccs: "320", cbt: "45", gor: "3,8", st: "12,5" }); asave(); }, fid);
    ok(/Análise salva/.test(await txt(p)), "análise não confirmada na tela");
    // teste de ordenha cronometrado (Setor 6)
    await p.evaluate(fid => { go("sector", fid, 5); V.o = "cro"; render(); dset("milker", "Ordenhador X"); T.n = "101"; tstart(); }, fid);
    await p.waitForTimeout(250);
    await p.evaluate(() => { tmark("jatos"); tmark("pre"); tmark("sec"); tmark("col"); tmark("fim"); tmark("ret"); tfin(); tsave(); ssave(); });
    ok(/Teste salvo/.test(await txt(p)), "teste de ordenha não confirmado");
    // visita
    await p.evaluate(fid => { go("visit"); VF = Object.assign(newVF(), { fid, notas: "Visita de teste" }); saveVisit(); }, fid);
    const before = await p.evaluate(() => ({ an: DB.an.length, ss: DB.sessions.length, vs: DB.vs.length, farms: DB.farms.length }));
    eq(before, { an: 1, ss: 1, vs: 1, farms: 1 }, "registros após salvar");
    await p.evaluate(() => flushAll());
    await p.reload();
    await p.waitForFunction(() => window.MQ_READY === true);
    const after = await p.evaluate(fid => ({ an: DB.an.filter(x => x.fid == fid).length, ss: DB.sessions.filter(x => x.fid == fid).length, vs: DB.vs.filter(x => x.fid == fid).length, farm: farms.some(f => f.id == fid && !f.demo) }), fid);
    eq(after, { an: 1, ss: 1, vs: 1, farm: true }, "registros após recarregar");
    const a = await p.evaluate(() => DB.an[0]);
    eq([a.ccs, a.gor, a.esd, a.esdCalc], [320, 3.8, 8.7, true], "valores da análise (vírgula decimal e ESD calculado)");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("fluxo: rascunho do formulário é recuperado após recarregar", async () => {
  const s = await open(), p = s.page;
  try {
    await p.evaluate(() => { go("sector", "modelo", 4); V.q = "an"; render(); AF.lab = "Laboratório Rascunho"; drSnap(); drFlush(); });
    await p.reload();
    await p.waitForFunction(() => window.MQ_READY === true);
    eq(await p.evaluate(() => AF.lab), "Laboratório Rascunho", "rascunho restaurado");
    ok(/Rascunhos recuperados/.test(await txt(p)), "aviso de rascunho recuperado ausente");
    noErrors(s.errors);
  } finally { await s.close(); }
});

/* ===================== 3b. Etapa 1: fazendas, indicadores reais, status, layout ===================== */
const mkFarm = (p, o) => p.evaluate(o => { NF = Object.assign(newNF(), o); NFE = null; addFarm(); return V.f; }, o);
const addAn = (p, fid, o) => p.evaluate(([fid, o]) => { go("sector", fid, 4); AF = Object.assign(newAF(), o); asave(); }, [fid, o]);
const kpiOf = (p, fid) => p.evaluate(fid => Object.fromEntries(fkpi(farms.find(f => f.id == fid)).map(k => [k.lab, k.v])), fid);
const statOf = (p, fid) => p.evaluate(fid => allStat(farms.find(f => f.id == fid)).map(s => s.st), fid);
const reload = async p => { await p.evaluate(() => flushAll()); await p.reload(); await p.waitForFunction(() => window.MQ_READY === true); };

test("fazendas: cadastrar com todos os campos, consultar e editar (persistem após recarregar)", async () => {
  const s = await open(), p = s.page;
  try {
    const fid = await mkFarm(p, { name: "Sítio A", producer: "Ana", phone: "(42) 99999-0000", email: "ana@exemplo.com", city: "Castro, PR", addr: "Estrada X km 4", cows: "60", milking: "48", liters: "1300", turns: "2", hours: "5", goal: "300", goalCbt: "100", obs: "Linha baixa" });
    await reload(p);
    const f = await p.evaluate(fid => ({ f: DB.farms.find(x => x.id == fid), g: DB.gl[fid] }), fid);
    eq([f.f.name, f.f.phone, f.f.email, f.f.addr, f.f.cows, f.f.milking, f.f.liters, f.f.turns, f.f.hours, f.f.hoursSet, f.f.obs, f.g.ccs, f.g.cbt],
      ["Sítio A", "(42) 99999-0000", "ana@exemplo.com", "Estrada X km 4", 60, 48, 1300, 2, 5, true, "Linha baixa", 300, 100], "cadastro salvo");
    await p.evaluate(fid => go("sector", fid, 0), fid);
    const t = await txt(p);
    for (const x of ["Sítio A", "Ana", "Estrada X km 4", "1.300 L", "300 mil/mL", "Editar cadastro", "Excluir fazenda"]) ok(t.includes(x), "ficha sem: " + x);
    await p.evaluate(fid => { openEdit(fid); NF.name = "Sítio A Editado"; NF.goal = "250"; NF.cows = "70"; addFarm(); }, fid);
    await reload(p);
    eq(await p.evaluate(fid => [DB.farms.length, DB.farms[0].name, DB.farms[0].cows, DB.gl[fid].ccs, DB.farms[0].id == fid], fid), [1, "Sítio A Editado", 70, 250, true], "edição (sem duplicar)");
    // validações
    for (const [o, msg] of [[{ name: "" }, "Informe o nome"], [{ name: "X", cows: "10", milking: "20" }, "não pode ser maior"], [{ name: "X", email: "abc" }, "E-mail inválido"], [{ name: "X", cows: "-1" }, "inválidos"]]) {
      await mkFarm(p, o); ok((await txt(p)).includes(msg), "validação ausente: " + msg);
    }
    eq(await p.evaluate(() => DB.farms.length), 1, "fazendas inválidas não podem ser gravadas");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("fazendas: excluir exige o nome; apaga só a fazenda escolhida; desfazer restaura", async () => {
  const s = await open(), p = s.page;
  try {
    const a = await mkFarm(p, { name: "Fazenda A", goal: "200" }), b = await mkFarm(p, { name: "Fazenda B" });
    await addAn(p, a, { ccs: "111" }); await addAn(p, b, { ccs: "222" }); await addAn(p, "modelo", { ccs: "333" });
    await p.evaluate(a => { V.fd = a; V.fdName = "Fazenda Errada"; go("fdel"); farmDelete(); }, a);
    ok((await txt(p)).includes("não confere"), "nome errado deveria bloquear");
    eq(await p.evaluate(() => DB.farms.length), 2, "nada pode ser excluído com nome errado");
    await p.evaluate(a => { V.fd = a; V.fdName = "  fazenda a "; farmDelete(); }, a);
    const r = await p.evaluate(() => ({ farms: DB.farms.map(f => f.name), an: DB.an.map(x => x.ccs).sort(), gl: Object.keys(DB.gl), stored: JSON.parse(localStorage.getItem("mq_ord")).farms.length, demo: farms.filter(f => f.demo).length }));
    eq(r, { farms: ["Fazenda B"], an: [222, 333], gl: [b], stored: 1, demo: 2 }, "depois de excluir A");
    ok((await txt(p)).includes("excluída"), "confirmação de exclusão ausente");
    await p.evaluate(() => { go("backup"); bkUndo(); bkUndo(); });
    eq(await p.evaluate(() => [DB.farms.map(f => f.name).sort(), DB.an.length]), [["Fazenda A", "Fazenda B"], 3], "desfazer exclusão");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("fazendas: as de demonstração não podem ser editadas nem excluídas", async () => {
  const s = await open(), p = s.page;
  try {
    await p.evaluate(() => { openEdit("modelo"); V.fd = "modelo"; V.fdName = "Fazenda Modelo"; farmDelete(); go("sector", "modelo", 0); });
    const t = await txt(p);
    ok(t.includes("não podem ser editadas nem excluídas") && !t.includes("Editar cadastro"), "ficha demo deveria ser só leitura");
    eq(await p.evaluate(() => farms.filter(f => f.demo).map(f => f.id)), ["modelo", "critica"], "fazendas demo");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("indicadores: fazenda nova mostra “Sem dados” e nenhum número inventado", async () => {
  const s = await open(), p = s.page;
  try {
    const fid = await mkFarm(p, { name: "Fazenda Vazia" });
    const k = await kpiOf(p, fid);
    ok(Object.values(k).every(v => v == null), "KPI com valor sem registro: " + JSON.stringify(k));
    eq(await statOf(p, fid), ["wa", "sd", "sd", "sd", "sd", "sd", "sd", "sd", "sd"], "status dos setores");
    eq(await p.evaluate(fid => falerts(farms.find(f => f.id == fid)).length, fid), 0, "alertas");
    for (const v of ["farm", "kpi"]) {
      await p.evaluate(([v, fid]) => go(v, fid), [v, fid]);
      const n = await p.$$eval(".kv.sd", x => x.length);
      ok(n >= 8, `${v}: esperava os KPIs como “Sem dados”, achei ${n}`);
    }
    ok(!/function series\(|series\(\d/.test(appSource()), "o gerador de séries fictícias ainda existe no código");
    ok(!/alerts:\[\[/.test(appSource()) && !/st:\["(ok|wa|cr)"/.test(appSource()), "alertas ou status fixos ainda existem no código");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("indicadores: usam os dados reais (análise acima da meta vira alerta e “Atenção”)", async () => {
  const s = await open(), p = s.page;
  try {
    const fid = await mkFarm(p, { name: "Fazenda Real", cows: "50", milking: "40", liters: "1000", goal: "300" });
    eq((await statOf(p, fid))[4], "sd", "S5 sem análise");
    await addAn(p, fid, { date: "2026-10-01", ccs: "350", cbt: "40" });
    let k = await kpiOf(p, fid);
    eq([k.CCS, k.CBT, k["Litros/vaca"], k["Produção diária"], k["Vacas em lactação"]], ["350", "40", "25", "1.000", "40"], "KPIs");
    eq((await statOf(p, fid))[4], "wa", "S5 acima da meta");
    const al = await p.evaluate(fid => falerts(farms.find(f => f.id == fid)).map(a => a.t), fid);
    ok(al.some(t => /CCS 350 .*acima da meta de 300/.test(t)), "alerta de CCS ausente: " + al);
    await addAn(p, fid, { date: "2026-11-01", ccs: "250" });
    eq((await statOf(p, fid))[4], "ok", "S5 dentro da meta");
    eq(await p.evaluate(fid => falerts(farms.find(f => f.id == fid)).length, fid), 0, "alerta deveria sumir");
    // teste de ordenha alimenta litros/hora e o setor 6
    await p.evaluate(fid => { go("sector", fid, 5); V.o = "cro"; render(); dset("milker", "X"); dset("litros", "900"); dset("vacas", "40"); dset("dur", "90"); T.n = "1"; tstart(); T.acc = 30; tfin(); tsave(); ssave(); }, fid);
    k = await kpiOf(p, fid);
    eq([k["Litros/hora"], k["Litros/vaca"]], ["600", "22,5"], "KPIs do teste de ordenha");
    eq((await statOf(p, fid))[5], "in", "S6 com teste registrado");
    await p.evaluate(fid => go("kpi", fid), fid);
    eq(await p.$$eval("svg.chart", x => x.length), 4, "gráficos com dados (CCS, CBT, L/h, L/vaca)");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("isolamento: registros de uma fazenda não aparecem em outra nem nas demo", async () => {
  const s = await open(), p = s.page;
  try {
    const a = await mkFarm(p, { name: "A", goal: "100" }), b = await mkFarm(p, { name: "B" });
    await addAn(p, a, { ccs: "777" });
    eq((await kpiOf(p, b)).CCS, null, "CCS de A apareceu em B");
    eq((await kpiOf(p, a)).CCS, "777", "CCS de A");
    ok(!(await kpiOf(p, "modelo")).CCS.includes("777"), "CCS de A apareceu na demo");
    await p.evaluate(() => go("home"));
    const cards = await p.$$eval(".fcard", x => x.map(c => c.textContent));
    ok(cards.filter(t => t.includes("777")).length === 1, "a CCS 777 deveria aparecer só no cartão de A");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("status: fazendas demo calculadas a partir dos registros DEMO, identificadas como demonstração", async () => {
  const s = await open(), p = s.page;
  try {
    const m = await statOf(p, "modelo"), c = await statOf(p, "critica");
    eq([m[3], c[3]], ["sd", "sd"], "setor 4 sem módulo deve ser Sem dados");
    eq(c[7], "cr", "Fazenda Crítica com revisões atrasadas (registros DEMO)");
    await p.evaluate(() => go("farm", "critica"));
    const t = await txt(p);
    ok(t.includes("DEMONSTRAÇÃO") && t.includes("Fazenda de demonstração") && t.includes("fictícios"), "aviso de demonstração ausente");
    await p.evaluate(() => go("home"));
    ok(/Fazendas de demonstração/.test(await txt(p)), "seção de demonstração ausente na lista");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("tetos: avaliação manual identificada; nenhuma IA apresentada como diagnóstico", async () => {
  const s = await open(), p = s.page;
  try {
    await p.evaluate(() => { V.q = "te"; go("sector", "critica", 4); });
    const t = await txt(p);
    ok(t.includes("Avaliação manual") && t.includes("não faz análise automática de imagens (IA)") && t.includes("não são diagnósticos"), "aviso de avaliação manual ausente");
    ok(!/IA, com confirmação/.test(appSource()), "texto antigo sugerindo IA ainda existe");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("layout: menu lateral no computador; barra inferior e faixa de setores no celular", async () => {
  const vis = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display != "none" && e.getBoundingClientRect().width > 0; }, sel);
  const d = await open({ viewport: { width: 1366, height: 900 } });
  try {
    await d.page.evaluate(() => go("sector", "modelo", 4));
    eq([await vis(d.page, "#side"), await vis(d.page, "#nav"), await vis(d.page, ".strip")], [true, false, false], "computador (menu lateral, barra, faixa)");
    eq(await d.page.$$eval("#side .si", x => x.length), 14, "itens do menu lateral (3 + 9 setores + 2)");
    await d.page.click("#side >> text=6. Otimização da ordenha");
    eq(await d.page.evaluate(() => [V.v, V.s]), ["sector", 5], "navegar pelo menu lateral");
    noErrors(d.errors);
  } finally { await d.close(); }
  const m = await open();
  try {
    await m.page.evaluate(() => go("sector", "modelo", 4));
    eq([await vis(m.page, "#side"), await vis(m.page, "#nav"), await vis(m.page, ".strip")], [false, true, true], "celular (menu lateral, barra, faixa)");
    await m.page.click(".strip button:nth-child(8)");
    eq(await m.page.evaluate(() => V.s), 7, "navegar pela faixa de setores");
    noErrors(m.errors);
  } finally { await m.close(); }
});

test("migração v2 → v3: a meta de CCS do cadastro vira meta de qualidade; dados preservados", async () => {
  const s = await open(), p = s.page;
  try {
    await p.evaluate(() => {
      const v2 = { sessions: [], drafts: {}, an: [{ id: "a1", fid: "u1", demo: false, date: "2026-10-01", ccs: 250 }], ts: [], ev: [], cy: [], pq: [], wa: [], eq: [], cmp: [], pl: [], sv: [], dx: [], pc: [], dg: [], rf: [], vs: [],
        farms: [{ id: "u1", name: "Antiga", producer: "—", city: "—", demo: false, cows: 10, milking: 8, liters: 0, hours: 6, ccs: [], cbt: [], prod: [], goalCcs: 200, st: [], alerts: [], visits: [] }],
        gl: {}, ob: {}, cr: {}, rp: {}, rm: {}, meta: { ver: 2, migrated: [{ from: 1, to: 2, at: "2026-11-11T00:00:00Z" }] } };
      localStorage.setItem("mq_ord", JSON.stringify(v2));
    });
    await p.reload(); await p.waitForFunction(() => window.MQ_READY === true);
    const r = await p.evaluate(() => ({ ver: DB.meta.ver, gl: DB.gl.u1, an: DB.an.length, mig: DB.meta.migrated.map(m => m.from + ">" + m.to), st: allStat(farms.find(f => f.id == "u1"))[4].st, lh: fkpi(farms.find(f => f.id == "u1")).find(k => k.lab == "Litros/hora").v }));
    eq(r, { ver: 3, gl: { ccs: 200 }, an: 1, mig: ["1>2", "2>3"], st: "wa", lh: null }, "migração");
    noErrors(s.errors);
  } finally { await s.close(); }
});

/* ===================== 3c. Etapa 2: ordenhadeiras e equipamentos ===================== */
const mkEq = (p, fid, o) => p.evaluate(([fid, o]) => { go("sector", fid, 1); e2new(); Object.assign(FS.eq, o); eqSave(); return V.e2; }, [fid, o]);
const mkCmp = (p, eid, o) => p.evaluate(([eid, o]) => { V.me = eid; FS.cmp = Object.assign(NEW.cmp(), o); gs("cmp", chk8c); }, [eid, o]);
const mkDx = (p, eid, o) => p.evaluate(([eid, o]) => { V.me = eid; FE.dx = null; FS.dx = Object.assign(NEW.dx(), o); gs("dx", chkDx2); }, [eid, o]);
const mkRf = (p, o) => p.evaluate(o => { FE.rf = null; FS.rf = Object.assign(NEW.rf(), o); gs("rf", chkRf); }, o);
const evalOf = (p, eid) => p.evaluate(eid => { const e = L("eq").find(x => x.id == eid), d = lastOf(L("dx").filter(x => x.eid == eid)), r = evalDx(d, e); return { gen: Object.fromEntries(r.gen.filter(x => x.v != null).map(x => [x.p[0], x.st])), pts: r.pts.map(x => x.pt + ":" + x.st), probs: r.probs.map(x => x.g + "|" + x.t), causes: r.probs.map(x => x.c.length + x.a.length) }; }, eid);

test("equipamentos: várias ordenhadeiras (GEA e outra marca) com cadastro completo, compartilhadas com o Setor 8", async () => {
  const s = await open(), p = s.page;
  try {
    const fid = await mkFarm(p, { name: "Fazenda Eq" });
    const a = await mkEq(p, fid, { fab: "GEA", mod: "Modelo G", ser: "G1", ano: "2019", tipo: "Linha baixa", sala: "Espinha de peixe", nc: "12", lv: "45", pul: "Alternada", ptx: "60", prel: "65", ll: "76 mm inox", lvac: "50 mm PVC", h: "5000", o: "10000", car: "obs" });
    const b = await mkEq(p, fid, { fab: "DeLaval", mod: "Modelo D", ser: "D1", nc: "8" });
    await reload(p);
    const r = await p.evaluate(() => DB.eq.map(e => [e.fab, e.mod, e.sala, e.nc, e.lv, e.prel, e.ll, e.hist.length]));
    eq(r, [["GEA", "Modelo G", "Espinha de peixe", "12", "45", "65", "76 mm inox", 1], ["DeLaval", "Modelo D", "", "8", "", "", "", 1]], "equipamentos salvos");
    // mesmo cadastro no Setor 8; edição lá preserva os campos novos
    await p.evaluate(fid => { V.m8 = "eq"; go("sector", fid, 7); }, fid);
    const t8 = await txt(p); ok(t8.includes("Modelo G") && t8.includes("Modelo D"), "Setor 8 não mostra os equipamentos do Setor 2");
    await p.evaluate(a => { ged("eq", a); FS.eq.car = "editado no S8"; gs("eq", chk8); }, a);
    eq(await p.evaluate(a => { const e = DB.eq.find(x => x.id == a); return [e.car, e.sala, e.ll, DB.eq.length]; }, a), ["editado no S8", "Espinha de peixe", "76 mm inox", 2], "edição no Setor 8");
    // edição no Setor 2 registra histórico; validações
    await p.evaluate(a => { go("sector", V.f, 1); e2edit(a); FS.eq.nc = "14"; eqSave(); }, a);
    ok((await p.evaluate(a => DB.eq.find(x => x.id == a).hist.map(h => h.t).join("|"), a)).includes("Cadastro alterado: conjuntos"), "histórico da edição");
    for (const [o, msg] of [[{ fab: "", mod: "X", ser: "1" }, "marca e modelo"], [{ fab: "A", mod: "B", ser: "" }, "número de série"], [{ fab: "A", mod: "B", ser: "1", prel: "120" }, "entre 0 e 100"], [{ fab: "A", mod: "B", ser: "1", ano: "1800" }, "Ano"]]) {
      await mkEq(p, fid, o); ok((await txt(p)).includes(msg), "validação ausente: " + msg);
    }
    eq(await p.evaluate(() => DB.eq.length), 2, "equipamentos inválidos não podem ser gravados");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("diagnóstico: sem referência verificada tudo é “Não avaliado”; com referência, Conforme/Fora com causas e ações", async () => {
  const s = await open(), p = s.page;
  try {
    const fid = await mkFarm(p, { name: "Fazenda Dx" });
    const e = await mkEq(p, fid, { fab: "GEA", mod: "M1", ser: "1" });
    const pts = [{ pt: "Coletor / ponta de teto", par: "vac", v: "44" }, { pt: "Unidade final / receptor", par: "vac", v: "45" }];
    await mkDx(p, e, { date: "2026-11-01", vac: "49", res: "800", A: "150", B: "450", C: "150", D: "250", vaz: "Falha", pts });
    let r = await evalOf(p, e);
    eq(r.gen, { vac: "Não avaliado", res: "Não avaliado", rel: "Não avaliado" }, "sem referência");
    eq(r.pts, ["Coletor / ponta de teto:Não avaliado", "Unidade final / receptor:Não avaliado"], "pontos sem referência");
    eq(r.probs.length, 1, "só a inspeção (Falha em vazamentos) vira problema");
    await mkRf(p, { fab: "GEA", par: "vac", min: "44", max: "48", un: "kPa", fonte: "Fonte A", ver: false });
    eq((await evalOf(p, e)).gen.vac, "Não avaliado", "referência NÃO verificada não pode classificar");
    await p.evaluate(() => { const r = DB.rf[0]; ged("rf", r.id); FS.rf.ver = true; gs("rf", chkRf); });
    await mkRf(p, { fab: "GEA", par: "vac", pt: "Coletor / ponta de teto", min: "32", max: "42", un: "kPa", fonte: "Fonte B", ver: true, grav: "Alta" });
    await mkRf(p, { fab: "OutraMarca", par: "res", min: "1000", un: "L/min", fonte: "Fonte C", ver: true });
    r = await evalOf(p, e);
    eq([r.gen.vac, r.gen.res, r.gen.rel], ["Fora", "Não avaliado", "Não avaliado"], "geral (referência de outra marca não se aplica)");
    eq(r.pts, ["Coletor / ponta de teto:Fora", "Unidade final / receptor:Não avaliado"], "referência por ponto só vale para o ponto");
    ok(r.probs[0].startsWith("Alta|Vácuo de trabalho — Coletor") && r.probs.some(x => /acima do máximo da referência \(44 a 48 kPa; fonte: Fonte A\)/.test(x)), "problemas: " + r.probs.join(" / "));
    ok(r.causes.every(n => n >= 2), "cada problema deve trazer causas e ações");
    await p.evaluate(e => e2open(e, "med"), e);
    const t = await txt(p);
    for (const x of ["Causas possíveis", "Ações sugeridas", "sem referência verificada", "Fonte A"]) ok(t.includes(x), "tela de medições sem: " + x);
    eq(await p.evaluate(fid => sstat(farms.find(f => f.id == fid), 1).st, fid), "cr", "status do Setor 2 (problema de gravidade Alta)");
    ok(await p.evaluate(fid => falerts(farms.find(f => f.id == fid)).some(a => a.s == 1 && a.eid), fid), "alerta deve apontar para o equipamento no Setor 2");
    // medição por ponto pela tela: adicionar e remover
    await p.evaluate(() => { FS.dx = NEW.dx(); PT2 = { pt: "Regulador", par: "vac", v: "abc", obs: "" }; addPt(); });
    ok((await txt(p)).includes("valor numérico válido"), "valor inválido no ponto deveria ser recusado");
    await p.evaluate(() => { PT2.v = "47,5"; addPt(); });
    eq(await p.evaluate(() => FS.dx.pts), [{ pt: "Regulador", par: "vac", v: "47.5", obs: "" }], "ponto adicionado (vírgula decimal)");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("equipamentos: esquema visual e diagramas identificados como não oficiais; oficial exige fonte e documento", async () => {
  const s = await open(), p = s.page;
  try {
    const fid = await mkFarm(p, { name: "Fazenda Esq" });
    const e = await mkEq(p, fid, { fab: "GEA", mod: "M", ser: "1", nc: "6" });
    await mkCmp(p, e, { tipo: "Regulador de vácuo", nome: "Regulador A", qtd: "1", cod: "ABC", conf: false });
    await mkCmp(p, e, { tipo: "Pulsador", nome: "Pulsadores", qtd: "6" });
    await p.evaluate(e => e2open(e, "cmp"), e);
    const svg = await p.$eval("svg.schema", x => x.textContent);
    ok(/Regulador de vácuo\s*1 componente/.test(svg) && /Pulsadores\s*6 componente/.test(svg) && /Bomba de vácuo\s*não cadastrado/.test(svg), "esquema: " + svg.slice(0, 200));
    const t = await txt(p);
    ok(t.includes("não é desenho oficial GEA") && t.includes("NÃO confirmado"), "avisos de esquema/código");
    await p.evaluate(e => { FS.dg = Object.assign(NEW.dg(), { tit: "Vista explodida", fonte: "Manual", ofi: true }); PG = ["data:image/png;base64,iVBORw0KGgo="]; e2dgSave(e); }, e);
    ok((await txt(p)).includes("exige a identificação do documento"), "oficial sem documento deveria ser recusado");
    await p.evaluate(e => { FS.dg.doc = "Manual X rev. 3, p. 12"; e2dgSave(e); FS.dg = Object.assign(NEW.dg(), { tit: "Foto", fonte: "Foto do técnico" }); PG = ["data:image/png;base64,iVBORw0KGgo="]; e2dgSave(e); }, e);
    eq(await p.evaluate(() => DB.dg.map(d => [d.tit, d.ofi, d.eid != ""])), [["Vista explodida", true, true], ["Foto", false, true]], "diagramas");
    const t2 = await txt(p);
    ok(t2.includes("Documento oficial informado") && t2.includes("Não oficial"), "identificação oficial / não oficial");
    // excluir equipamento com registros vinculados é bloqueado
    await p.evaluate(e => { go("sector", V.f, 1); e2open(e, "res"); e2del(e); e2del(e); }, e);
    eq(await p.evaluate(() => DB.eq.length), 1, "equipamento com vínculos não pode ser excluído");
    const only = await mkEq(p, fid, { fab: "GEA", mod: "Só diagrama", ser: "9" });
    await p.evaluate(e => { e2open(e, "cmp"); FS.dg = Object.assign(NEW.dg(), { tit: "D", fonte: "F" }); PG = ["data:image/png;base64,iVBORw0KGgo="]; e2dgSave(e); e2open(e, "res"); e2del(e); e2del(e); }, only);
    eq(await p.evaluate(() => DB.eq.length), 2, "equipamento só com diagrama vinculado também não pode ser excluído");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("integração: revisões do Setor 8 viram pendências do equipamento; histórico individual separado por equipamento", async () => {
  const s = await open(), p = s.page;
  try {
    const fid = await mkFarm(p, { name: "Fazenda Int" });
    const a = await mkEq(p, fid, { fab: "GEA", mod: "A", ser: "1" }), b = await mkEq(p, fid, { fab: "GEA", mod: "B", ser: "2" });
    await p.evaluate(a => { e2open(a, "res"); FS.pl = Object.assign(NEW.pl(), { nome: "Troca de teteiras", iD: "30", ud: "2026-01-01" }); gs("pl", null); FS.sv = Object.assign(NEW.sv(), { date: "2026-10-10", tipo: "Corretiva", prob: "Vazamento", parts: [{ n: "Mangueira", q: "2", c: "10" }] }); gs("sv", chk8s); }, a);
    await mkDx(p, a, { date: "2026-10-20", vac: "47" });
    const pa = await p.evaluate(a => epend(L("eq").find(x => x.id == a)).map(x => x.t), a);
    ok(pa.some(t => t.startsWith("Revisão atrasada: Troca de teteiras")), "pendência de revisão: " + pa);
    const ta = await p.evaluate(a => eqTimeline(L("eq").find(x => x.id == a)).map(x => x.t), a), tb = await p.evaluate(b => eqTimeline(L("eq").find(x => x.id == b)).map(x => x.t), b);
    ok(ta.some(t => t.includes("Serviço (Corretiva): Vazamento") && t.includes("Mangueira ×2")) && ta.some(t => t.startsWith("Medição")), "histórico de A: " + ta);
    eq(tb, ["Equipamento cadastrado"], "histórico de B não pode ter registros de A");
    await p.evaluate(a => { e2open(a, "res"); }, a);
    ok((await txt(p)).includes("Revisão atrasada: Troca de teteiras"), "pendência na tela do equipamento");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("relatórios: diagnóstico individual sem dados demo em fazenda real; comparativo só com registros", async () => {
  const s = await open(), p = s.page;
  try {
    const fid = await mkFarm(p, { name: "Fazenda Rel" });
    const g = await mkEq(p, fid, { fab: "GEA", mod: "G", ser: "1" });
    await mkRf(p, { fab: "GEA", par: "vac", min: "44", max: "48", un: "kPa", fonte: "Manual G", ver: true });
    await mkDx(p, g, { date: "2026-11-01", vac: "46" });
    await p.evaluate(g => e2open(g, "rl"), g);
    let t = await txt(p);
    ok(t.includes("Diagnóstico técnico do equipamento") && t.includes("Conforme") && t.includes("Manual G") && !/DEMO|fictício/i.test(t), "relatório real com dado demo ou sem referência");
    // comparativo: só GEA → pede outra marca; depois com outra marca
    await p.evaluate(() => { V.e2 = null; V.e2v = "cmp"; render(); });
    ok((await txt(p)).includes("Nenhum equipamento de outra marca"), "mensagem sem outra marca");
    const o = await mkEq(p, fid, { fab: "Outra", mod: "O", ser: "2" });
    await p.evaluate(() => { V.e2 = null; V.e2edit = false; V.e2v = "cmp"; render(); });
    t = await txt(p);
    ok(t.includes("Outra O #2") && t.includes("GEA G #1") && /Vácuo de trabalho\s*Sem dados\s*46 kPa\s*Conforme · ref\. Manual G/.test(t), "comparativo: " + t.slice(0, 300));
    ok(!t.includes("Fazenda Crítica") && !/DEMO/.test(t), "comparativo real não pode usar equipamentos demo");
    // demo: relatório identificado
    await p.evaluate(() => { V.e2 = null; go("sector", "critica", 1); e2open(L("eq")[0].id, "rl"); });
    ok((await txt(p)).includes("DADOS DE DEMONSTRAÇÃO"), "relatório demo deve ser identificado");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("equipamentos: telas do Setor 2 no celular e no computador sem erro e sem rolagem lateral", async () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
    const s = await open({ viewport }), p = s.page;
    try {
      const bad = [];
      for (const fid of ["modelo", "critica"]) {
        for (const v of ["list", "cmp", "ref"]) { await p.evaluate(([fid, v]) => { V.e2 = null; V.e2v = v; go("sector", fid, 1); }, [fid, v]); }
        const ids = await p.evaluate(() => L("eq").map(e => e.id));
        for (const id of ids) for (const t of ["res", "med", "cmp", "his", "rl"]) {
          await p.evaluate(([id, t]) => e2open(id, t), [id, t]);
          const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
          if (w[0] > w[1] + 1) bad.push(`${fid}:${id}:${t}`);
        }
      }
      await p.evaluate(() => { go("sector", "modelo", 1); e2new(); });
      ok(!bad.length, `rolagem lateral (${viewport.width}px): ` + bad.join(", "));
      noErrors(s.errors);
    } finally { await s.close(); }
  }
});

test("backup: equipamentos, medições por ponto e diagramas sobrevivem a exportar → importar", async () => {
  const s = await open(), p = s.page;
  let exp;
  try {
    const fid = await mkFarm(p, { name: "Fazenda BkEq" });
    const e = await mkEq(p, fid, { fab: "GEA", mod: "M", ser: "1", sala: "Rotativa", lv: "44" });
    await mkDx(p, e, { date: "2026-11-01", vac: "46", pts: [{ pt: "Regulador", par: "vac", v: "45" }] });
    await mkRf(p, { fab: "GEA", par: "vac", pt: "Regulador", min: "40", max: "50", fonte: "F", doc: "D", ver: true });
    exp = await exportFile(p);
  } finally { await s.close(); }
  const s2 = await open(), p2 = s2.page;
  try {
    await p2.evaluate(() => go("backup"));
    await p2.setInputFiles('input[type=file][accept*=json]', exp.file);
    await p2.waitForFunction(() => BK.rep && BK.rep.ok);
    await p2.click("text=Importar (adicionar novos)");
    const r = await p2.evaluate(() => [DB.eq[0].sala, DB.eq[0].lv, DB.eq[0].hist.length, DB.dx[0].pts, DB.rf[0].pt, DB.rf[0].doc]);
    eq(r, ["Rotativa", "44", 1, [{ pt: "Regulador", par: "vac", v: "45" }], "Regulador", "D"], "dados após importar");
    noErrors(s2.errors);
  } finally { await s2.close(); }
});

/* ===================== 3d. Offline-first: site publicado, modo avião, banco do aparelho ===================== */
let SITE = null;
function buildSiteOnce() {
  if (SITE) return SITE;
  const { build } = require("../tools/build-site.js"), out = path.join(OUT, "site");
  fs.rmSync(out, { recursive: true, force: true });
  build({ out, env: "estavel" }); build({ out: path.join(out, "teste"), env: "teste" });
  return (SITE = path.relative(ROOT, out));
}
const offlineReady = p => p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller && window.MQ_READY === true, null, { timeout: 15000 });

test("offline: site publicado instala o app e funciona em modo avião (abrir, navegar, cadastrar, reabrir)", async () => {
  if (APP !== "index.html") return;
  const site = buildSiteOnce();
  const s = await open({ app: site + "/index.html" }), p = s.page;
  try {
    await offlineReady(p);
    const fid = await mkFarm(p, { name: "Fazenda Online", goal: "300" });
    await addAn(p, fid, { ccs: "250" });
    await s.ctx.setOffline(true);                                   // modo avião
    await p.reload(); await p.waitForFunction(() => window.MQ_READY === true);
    ok((await txt(p)).includes("Sem internet"), "aviso de sem internet ausente");
    eq(await p.evaluate(() => farms.filter(f => !f.demo).map(f => f.name)), ["Fazenda Online"], "dados após reabrir offline");
    // trabalhar offline: análise, teste de ordenha, CIP, visita, equipamento + medição
    await addAn(p, fid, { ccs: "350" });
    await p.evaluate(fid => { go("sector", fid, 5); V.o = "cro"; render(); dset("milker", "X"); T.n = "7"; tstart(); T.acc = 20; tfin(); tsave(); ssave(); go("visit"); VF = Object.assign(newVF(), { fid, notas: "offline" }); saveVisit(); }, fid);
    const e = await mkEq(p, fid, { fab: "GEA", mod: "Off", ser: "1" });
    await mkDx(p, e, { date: "2026-11-10", vac: "46", pts: [{ pt: "Regulador", par: "vac", v: "45" }] });
    for (const sct of [0, 1, 2, 3, 4, 5, 6, 7, 8]) await p.evaluate(([fid, sct]) => { V.e2 = null; go("sector", fid, sct); }, [fid, sct]);
    await p.evaluate(fid => { go("kpi", fid); go("backup"); }, fid);
    // fechar o app e abrir de novo, ainda offline
    await p.evaluate(() => flushAll()); await p.evaluate(() => idbFlush());
    await p.close();
    const p2 = await s.ctx.newPage(); const err2 = []; p2.on("pageerror", x => err2.push(x.message));
    await p2.goto(`${base}/${site}/index.html`); await p2.waitForFunction(() => window.MQ_READY === true);
    const r = await p2.evaluate(fid => ({ an: DB.an.filter(x => x.fid == fid).length, ss: DB.sessions.length, vs: DB.vs.length, eq: DB.eq.length, pts: DB.dx[0].pts.length, sw: !!navigator.serviceWorker.controller }), fid);
    eq(r, { an: 2, ss: 1, vs: 1, eq: 1, pts: 1, sw: true }, "dados após fechar e reabrir offline");
    // relatório offline (tela de impressão disponível)
    await p2.evaluate(fid => { V.q = "rl"; go("sector", fid, 4); }, fid);
    ok((await p2.textContent("#app")).includes("Imprimir / salvar em PDF"), "relatório offline");
    await s.ctx.setOffline(false);
    eq(err2, [], "erros na página reaberta");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("offline: versões estável e de testes usam dados separados", async () => {
  if (APP !== "index.html") return;
  const site = buildSiteOnce();
  const s = await open({ app: site + "/index.html" }), p = s.page;
  try {
    await mkFarm(p, { name: "Só na estável" });
    await p.goto(`${base}/${site}/teste/index.html`); await p.waitForFunction(() => window.MQ_READY === true);
    const t = await txt(p);
    ok(t.includes("Versão de testes"), "aviso de versão de testes ausente");
    eq(await p.evaluate(() => farms.filter(f => !f.demo).length), 0, "a versão de testes viu dados da estável");
    await mkFarm(p, { name: "Só no teste" });
    await p.goto(`${base}/${site}/index.html`); await p.waitForFunction(() => window.MQ_READY === true);
    eq(await p.evaluate(() => farms.filter(f => !f.demo).map(f => f.name)), ["Só na estável"], "a estável viu dados de testes");
    const man = JSON.parse(fs.readFileSync(path.join(ROOT, site, "manifest.webmanifest"), "utf8"));
    eq([man.display, man.start_url, man.icons.some(i => i.sizes == "192x192"), man.icons.some(i => i.sizes == "512x512"), man.icons.some(i => i.purpose == "maskable")], ["standalone", "./", true, true, true], "manifesto instalável");
    ok(fs.readFileSync(path.join(ROOT, site, "sw.js"), "utf8").includes('addEventListener("fetch"'), "service worker sem tratamento offline");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("armazenamento: localStorage cheio → continua gravando no banco do aparelho (IndexedDB) e recupera ao reabrir", async () => {
  const s = await open(), p = s.page;
  try {
    await p.evaluate(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k == "mq_ord") { const e = new Error("cheio"); e.name = "QuotaExceededError"; throw e; } return o.call(this, k, v); }; });
    await mkFarm(p, { name: "Fazenda Grande" });
    eq(await p.evaluate(() => [SV.ok, SV.mode, DB.farms.length]), [true, "idb", 1], "gravação com localStorage cheio");
    await p.evaluate(() => idbFlush());
    eq(await p.evaluate(() => IDBS.err), null, "erro no IndexedDB");
    await p.reload(); await p.waitForFunction(() => window.MQ_READY === true);
    eq(await p.evaluate(() => [farms.filter(f => !f.demo).map(f => f.name), SV.loadedFrom]), [["Fazenda Grande"], "idb"], "dados recuperados do IndexedDB");
    // localStorage apagado: recupera do IndexedDB
    await p.evaluate(() => localStorage.removeItem("mq_ord"));
    await p.reload(); await p.waitForFunction(() => window.MQ_READY === true);
    eq(await p.evaluate(() => farms.filter(f => !f.demo).map(f => f.name)), ["Fazenda Grande"], "dados recuperados com localStorage vazio");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("armazenamento: dados ilegíveis não são substituídos sozinhos; usuário pode restaurar a cópia do aparelho", async () => {
  const s = await open(), p = s.page;
  try {
    await mkFarm(p, { name: "Fazenda Segura" }); await p.evaluate(() => idbFlush());
    await p.evaluate(() => localStorage.setItem("mq_ord", "{quebrado"));
    await p.reload(); await p.waitForFunction(() => window.MQ_READY === true);
    const t = await txt(p);
    ok(t.includes("estão ilegíveis") && t.includes("Restaurar a cópia do banco do aparelho"), "opção de restauração ausente");
    eq(await p.evaluate(() => localStorage.getItem("mq_ord")), "{quebrado", "original ilegível foi sobrescrito sem pedir");
    await p.click("text=Restaurar a cópia do banco do aparelho");
    eq(await p.evaluate(() => [farms.filter(f => !f.demo).map(f => f.name), Object.keys(localStorage).some(k => k.startsWith("mq_corrupt_"))]), [["Fazenda Segura"], true], "restauração (com cópia do texto ilegível)");
    noErrors(s.errors);
  } finally { await s.close(); }
});

/* ===================== 4. Backup ===================== */
async function exportFile(p) {
  await p.evaluate(() => go("backup"));
  const dl = p.waitForEvent("download", { timeout: 5000 });
  await p.click("text=Gerar backup (.json)");
  const d = await dl;
  const file = path.join(OUT, d.suggestedFilename());
  await d.saveAs(file);
  return { name: d.suggestedFilename(), file, json: JSON.parse(fs.readFileSync(file, "utf8")) };
}
async function analyzeText(p, text) {
  return p.evaluate(async t => { const r = await bkAnalyze(t, "teste"); return { ok: r.ok, errors: r.errors, checks: r.checks, warns: r.warns }; }, text);
}

test("backup: o backup de 11/11 é aceito pela tela de importação", async () => {
  const s = await open(), p = s.page;
  try {
    await p.evaluate(() => go("backup"));
    await p.setInputFiles('input[type=file][accept*=json]', FIXTURE);
    await p.waitForFunction(() => BK.rep);
    const t = await txt(p);
    for (const c of ["Formato MilkIQ reconhecido", "Integridade confirmada (sha256)", "Estrutura e identificadores válidos"]) ok(t.includes(c), "faltou: " + c);
    if (APP === "index.html") ok(t.includes("Versão dos dados do arquivo: v2 (será atualizada para v3)"), "backup v2 deveria ser atualizado para v3");
    await p.click("text=Importar (adicionar novos)");
    ok(/Importação concluída e verificada/.test(await txt(p)), "importação não concluída");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("backup: exportar → importar em navegador limpo restaura os dados reais (ida e volta)", async () => {
  const s = await open(), p = s.page;
  let exp;
  try {
    await p.evaluate(() => {
      NF = Object.assign(newNF(), { name: "Fazenda Backup", cows: "10", milking: "8" }); addFarm();
      const fid = V.f; go("sector", fid, 4);
      AF = Object.assign(newAF(), { ccs: "200" }); asave();
      go("sector", "modelo", 4); AF = Object.assign(newAF(), { ccs: "999" }); asave(); // registro de teste em fazenda demo
    });
    exp = await exportFile(p);
    ok(/^milkiq-backup-\d{8}-\d{4}\.json$/.test(exp.name), "nome do arquivo: " + exp.name);
    const f = exp.json;
    eq([f.format, f.formatVer, f.checksum.algo], ["milkiq-backup", 1, "sha256"], "cabeçalho");
    eq(crypto.createHash("sha256").update(JSON.stringify(f.body)).digest("hex"), f.checksum.hex, "checksum");
    eq([f.counts.real.farms, f.counts.real.an, f.counts.sandbox.an], [1, 1, 1], "contagens real/teste");
    ok(f.body.real.an[0].ccs === 200 && f.body.sandbox.an[0].ccs === 999, "registro demo vazou para dados reais");
    const all = JSON.stringify(f.body.real);
    ok(!/"demo":true/.test(all), "registro demo:true dentro de dados reais");
    ok(!/"fid":"(modelo|critica)"/.test(all), "registro de fazenda demo dentro de dados reais");
    noErrors(s.errors);
  } finally { await s.close(); }
  const s2 = await open(), p2 = s2.page;
  try {
    await p2.evaluate(() => go("backup"));
    await p2.setInputFiles('input[type=file][accept*=json]', exp.file);
    await p2.waitForFunction(() => BK.rep && BK.rep.ok);
    await p2.click("text=Importar (adicionar novos)");
    const r = await p2.evaluate(() => ({ farms: DB.farms.map(f => f.name), an: DB.an.map(a => a.ccs), stored: JSON.parse(localStorage.getItem("mq_ord")).an.length }));
    eq(r, { farms: ["Fazenda Backup"], an: [200], stored: 1 }, "dados após importar (sem registros de teste)");
    await p2.reload();
    await p2.waitForFunction(() => window.MQ_READY === true);
    ok(await p2.evaluate(() => farms.some(f => f.name == "Fazenda Backup")), "fazenda importada sumiu ao recarregar");
    // desfazer importação
    await p2.evaluate(() => { go("backup"); bkUndo(); bkUndo(); });
    eq(await p2.evaluate(() => DB.farms.length), 0, "desfazer importação");
    noErrors(s2.errors);
  } finally { await s2.close(); }
});

test("backup: arquivos adulterados, truncados ou estranhos são recusados sem alterar nada", async () => {
  const s = await open(), p = s.page;
  try {
    const f = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
    const cases = {
      "conteúdo adulterado": (() => { const x = JSON.parse(JSON.stringify(f)); x.body.real.farms.push({ id: "uX", name: "Intrusa" }); return JSON.stringify(x); })(),
      "truncado": JSON.stringify(f).slice(0, 300),
      "outro formato": JSON.stringify({ format: "outro", body: {} }),
      "versão de dados futura": (() => { const x = JSON.parse(JSON.stringify(f)); x.body.dataVer = 99; x.checksum.hex = crypto.createHash("sha256").update(JSON.stringify(x.body)).digest("hex"); return JSON.stringify(x); })(),
    };
    const before = await p.evaluate(() => localStorage.getItem("mq_ord"));
    for (const [k, t] of Object.entries(cases)) {
      const r = await analyzeText(p, t);
      ok(!r.ok && r.errors.length, `"${k}" deveria ser recusado`);
    }
    eq(await p.evaluate(() => localStorage.getItem("mq_ord")), before, "armazenamento alterado por arquivo recusado");
    noErrors(s.errors);
  } finally { await s.close(); }
});

test("backup: dados ilegíveis no navegador são protegidos (nada é sobrescrito)", async () => {
  const s = await open(), p = s.page;
  try {
    await p.evaluate(() => localStorage.setItem("mq_ord", "{corrompido"));
    await p.reload();
    await p.waitForFunction(() => window.MQ_READY === true);
    ok(/estão ilegíveis/.test(await txt(p)), "aviso de dados ilegíveis ausente");
    await p.evaluate(() => { NF = Object.assign(newNF(), { name: "X" }); addFarm(); });
    eq(await p.evaluate(() => localStorage.getItem("mq_ord")), "{corrompido", "dados originais foram sobrescritos");
  } finally { await s.close(); }
});

/* ===================== execução ===================== */
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  base = `http://127.0.0.1:${srv.address().port}`;
  browser = await chromium.launch();
  let fail = 0;
  const run = T.filter(t => t.name.includes(filter));
  console.log(`MilkIQ — ${run.length} testes em ${APP}\n`);
  for (const t of run) {
    const t0 = Date.now();
    try { await t.fn(); console.log(`  ✔ ${t.name} (${Date.now() - t0} ms)`); }
    catch (e) { fail++; console.log(`  ✖ ${t.name}\n      ${String(e.message).split("\n").join("\n      ")}`); }
  }
  await browser.close(); srv.close();
  console.log(`\n${run.length - fail} passaram, ${fail} falharam.`);
  process.exit(fail ? 1 : 0);
})();
