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
  const types = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".js": "text/javascript", ".css": "text/css" };
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
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
  await page.waitForFunction(() => typeof render == "function" && document.querySelector("#app").children.length > 0);
  return { ctx, page, errors, close: () => ctx.close() };
}
const txt = page => page.textContent("#app");
const noErrors = errors => ok(errors.length === 0, "erros no console:\n  " + errors.join("\n  "));

/* Percorre todas as telas, setores e abas das duas fazendas demo. */
async function visitAll(page) {
  const seen = [];
  for (const v of [["home"], ["farm", "modelo"], ["kpi"], ["visit"], ["new"], ["backup"]]) {
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
    await p.waitForFunction(() => typeof render == "function");
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
    await p.waitForFunction(() => typeof render == "function");
    eq(await p.evaluate(() => AF.lab), "Laboratório Rascunho", "rascunho restaurado");
    ok(/Rascunhos recuperados/.test(await txt(p)), "aviso de rascunho recuperado ausente");
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
    await p2.waitForFunction(() => typeof render == "function");
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
    await p.waitForFunction(() => typeof render == "function");
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
