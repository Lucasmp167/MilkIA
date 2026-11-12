/* ===== Importação de laudos de qualidade do leite (CSV ou texto copiado de planilha) =====
 * Funciona offline. Reconhece as colunas pelo nome do cabeçalho, aceita vírgula decimal e datas
 * dd/mm/aaaa, aaaa-mm-dd e dd/mm/aa. Mostra uma prévia (válida, duplicada, inválida) e só grava
 * quando o técnico confirma. XLSX não é lido diretamente: salve a planilha como CSV ou copie as células.
 */
const IMPC = [["date", /^(data|dt|coleta|data da coleta|data coleta|date)$|^data/], ["tk", /tanque|^tq|amostra/], ["ccs", /^ccs|celulas somaticas|contagem de celulas|^cs$/], ["cbt", /^cbt|^ctb|contagem bacteriana|bacteria|ufc/],
  ["gor", /gordura|^gord|^fat/], ["pro", /proteina|^prot/], ["lac", /lactose|^lact/], ["esd", /^esd|desengordurado|nao gordurosos/], ["st", /solidos totais|^st$|extrato seco total|^est$/], ["cri", /criosc|congelamento/], ["ure", /ureia|^mun|^nul/]];
const nrm2 = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[()\[\]]/g, " ").replace(/\s+/g, " ").trim();
let IMP = { txt: "", conv: true, lab: "", tk: "", rep: null, name: "" };

function csvRows(t) {
  const lines = String(t).replace(/\r/g, "").split("\n").filter(l => l.trim());
  if (!lines.length) return [];
  const h = lines[0], d = ["\t", ";", ","].sort((a, b) => h.split(b).length - h.split(a).length)[0];
  return lines.map(l => { const out = []; let cur = "", q = false; for (const ch of l) { if (ch == '"') q = !q; else if (ch == d && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map(x => x.trim()); });
}
function impDate(s) {
  s = String(s || "").trim(); let m, y, mo, d;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) [y, mo, d] = [m[1], m[2], m[3]];
  else if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/.exec(s))) [y, mo, d] = [m[3].length == 2 ? "20" + m[3] : m[3], m[2], m[1]];
  else return null;
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`, t = new Date(iso + "T12:00:00Z");
  return isNaN(t) || t.toISOString().slice(0, 10) != iso ? null : iso; // recusa 31/02, 32/13...
}
const impNum = s => { s = String(s == null ? "" : s).trim(); if (!s || s == "-") return null; if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, ""); const n = Number(s.replace(",", ".")); return isFinite(n) ? n : NaN; };
function impAnalyze() {
  const R = csvRows(IMP.txt); if (R.length < 2) return (IMP.rep = { err: "Nenhuma linha de dados encontrada. A primeira linha deve ser o cabeçalho." });
  const head = R[0].map(nrm2), map = {};
  IMPC.forEach(([k, re]) => { const i = head.findIndex((h, j) => re.test(h) && !Object.values(map).includes(j)); if (i >= 0) map[k] = i; });
  if (map.date == null) return (IMP.rep = { err: "Coluna de data não encontrada no cabeçalho (ex.: “Data” ou “Data da coleta”)." });
  if (!PR.some(p => map[p[0]] != null)) return (IMP.rep = { err: "Nenhuma coluna de resultado reconhecida (CCS, CBT, gordura, proteína, lactose, sólidos, ESD, crioscopia, ureia)." });
  const cur = QA(), rows = R.slice(1).map((r, i) => {
    const o = { line: i + 2, date: impDate(r[map.date]), tk: (map.tk != null ? r[map.tk] : "") || IMP.tk || "", conv: [] }, bad = [];
    if (!o.date) bad.push("data inválida");
    PR.forEach(([k, l]) => { if (map[k] == null) return; let v = impNum(r[map[k]]); if (Number.isNaN(v)) { bad.push(l + " inválido"); v = null; }
      if (v != null && IMP.conv && (k == "ccs" || k == "cbt") && v > 10000) { v = Math.round(v / 1000); o.conv.push(k.toUpperCase()); }
      if (v != null && v < 0) bad.push(l + " negativo"); o[k] = v; });
    if (!PR.some(([k]) => o[k] != null)) bad.push("sem resultados");
    o.dup = !bad.length && cur.some(a => a.date == o.date && (a.tk || "") == o.tk && PR.every(([k]) => o[k] == null || a[k] == o[k]));
    o.bad = bad; return o;
  });
  IMP.rep = { map, head: R[0], rows, ok: rows.filter(r => !r.bad.length && !r.dup).length };
}
function impFile(inp) { const f = inp.files && inp.files[0]; if (!f) return; if (/\.xlsx?$/i.test(f.name)) return note("Arquivo do Excel: salve como CSV (Arquivo → Salvar como → CSV) ou copie as células e cole no campo de texto."); const r = new FileReader(); r.onload = () => { IMP.txt = String(r.result); IMP.name = f.name; impAnalyze(); render(); }; r.readAsText(f); }
function impApply() {
  const R = IMP.rep; if (!R || !R.rows) return; const ok = R.rows.filter(r => !r.bad.length && !r.dup); if (!ok.length) return note("Nenhuma linha nova e válida para importar.");
  const t = Date.now(), add = ok.map((r, i) => { const o = { id: "a" + t + "_" + i, fid: V.f, demo: false, date: r.date, tk: String(r.tk).replace(/[<>]/g, "").slice(0, 60), lot: "", lab: String(IMP.lab || "").replace(/[<>]/g, "").slice(0, 80), turno: "", imp: (IMP.name || "texto colado").slice(0, 80) }; PR.forEach(([k]) => o[k] = r[k] == null ? null : r[k]); if (o.esd == null && o.st != null && o.gor != null) { o.esd = +(o.st - o.gor).toFixed(2); o.esdCalc = true; } return o; });
  DB.an.push(...add); if (!svS()) { DB.an.splice(DB.an.length - add.length, add.length); return note(FAIL + " Nada foi importado."); }
  IMP = { txt: "", conv: IMP.conv, lab: IMP.lab, tk: "", rep: null, name: "" }; V.imp = 0; note(`${add.length} análise(s) importada(s) e conferidas.`, 1);
}
function impCard() {
  const f = F(); if (f.demo) return "";
  if (!V.imp) return `<button class="btn s noprint" style="margin:6px 0" onclick="V.imp=1;render()">📥 Importar laudo (CSV ou planilha copiada)</button>`;
  const R = IMP.rep, lab = PR.map(p => p[0]);
  return `<div class="card"><div class="top"><b>📥 Importar laudo</b><button class="btn s" onclick="V.imp=0;IMP.rep=null;render()">Fechar</button></div><p class="mu">Escolha um arquivo CSV ou cole as células copiadas da planilha (com o cabeçalho na primeira linha). Nada é gravado antes de você confirmar.</p>
<input type="file" accept=".csv,.txt,text/csv,.xls,.xlsx" onchange="impFile(this)"><label>Ou cole aqui</label><textarea rows="4" placeholder="Data;Tanque;CCS;CBT;Gordura;Proteína" oninput="IMP.txt=this.value">${E(IMP.txt)}</textarea>
<div class="grid"><div><label>Laboratório</label><input value="${E(IMP.lab)}" oninput="IMP.lab=this.value"></div><div><label>Tanque (se não houver coluna)</label><input value="${E(IMP.tk)}" oninput="IMP.tk=this.value"></div></div>
<label><input type="checkbox" style="width:auto" ${IMP.conv ? "checked" : ""} onchange="IMP.conv=this.checked;if(IMP.txt)impAnalyze();render()"> Converter CCS e CBT acima de 10.000 (células/mL e UFC/mL) para mil/mL</label><br><button class="btn w" onclick="impAnalyze();render()">Ver prévia</button>
${R ? (R.err ? `<p class="cr">✖ ${E(R.err)}</p>` : `<p class="mu">Colunas reconhecidas: ${Object.entries(R.map).map(([k, i]) => `<b>${k == "date" ? "Data" : k == "tk" ? "Tanque" : PR.find(p => p[0] == k)[1]}</b> ← “${E(R.head[i])}”`).join(", ")}.</p>
<div class="ov"><table><tr><th>Linha</th><th>Data</th><th>Tanque</th>${PR.filter(p => R.map[p[0]] != null).map(p => `<th>${p[1]}</th>`).join("")}<th>Situação</th></tr>${R.rows.slice(0, 60).map(r => `<tr><td>${r.line}</td><td>${r.date ? fmtD(r.date) : "—"}</td><td>${E(r.tk || "—")}</td>${PR.filter(p => R.map[p[0]] != null).map(p => `<td>${fm(r[p[0]], p[3])}</td>`).join("")}<td class="${r.bad.length ? "cr" : r.dup ? "na" : "ok"}">${r.bad.length ? E(r.bad.join(", ")) : r.dup ? "já existe" : "nova" + (r.conv.length ? ` (${r.conv.join(", ")} convertida)` : "")}</td></tr>`).join("")}</table></div>${R.rows.length > 60 ? `<p class="mu">+ ${R.rows.length - 60} linha(s).</p>` : ""}
<p><b>${R.ok}</b> análise(s) nova(s) para importar · ${R.rows.filter(r => r.dup).length} já existente(s) · ${R.rows.filter(r => r.bad.length).length} com erro (não importadas).</p><button class="btn w" ${R.ok ? "" : "disabled"} onclick="impApply()">Importar ${R.ok} análise(s)</button>`) : ""}</div>`;
}
{ const base = qAn; qAn = function () { return impCard() + base(); }; }

/* demo: o consumo fictício nunca deixa o estoque negativo (a Crítica fica abaixo do mínimo, não negativa) */
(() => { ["modelo", "critica"].forEach(fid => withFarm(fid, () => DC.pq.filter(p => p.fid == fid).forEach(p => { const s = stock(p); if (s < 0) p.est0 = String(+((num(p.est0) || 0) - s + (fid == "critica" ? (num(p.estmin) || 2) * .5 : (num(p.estmin) || 2) * 3)).toFixed(1)); }))); })();
