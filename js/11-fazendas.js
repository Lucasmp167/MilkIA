/* ===== Etapa 1: cadastro de fazendas (cadastrar, consultar, editar, excluir) =====
 * Substitui o formulário simples antigo (newf/addFarm, mesmos nomes). Os campos antigos do objeto
 * fazenda continuam existindo para manter o backup compatível. As metas de CCS/CBT ficam em DB.gl,
 * o mesmo lugar que o Setor 5 já usava, para não existirem duas metas diferentes.
 */
function newNF() { return { name: "", producer: "", phone: "", email: "", city: "", addr: "", cows: "", milking: "", liters: "", turns: "", hours: "", goal: "", goalCbt: "", obs: "" }; }
let NFE = null; // id da fazenda em edição (null = nova)
NF = newNF();

const txtc = (s, n) => String(s == null ? "" : s).replace(/[<>]/g, "").trim().slice(0, n || 120);
function farmToNF(f) {
  const g = DB.gl[f.id] || {}, s = v => v == null || v === 0 ? "" : String(v);
  return { name: f.name || "", producer: f.producer == "—" ? "" : f.producer || "", phone: f.phone || "", email: f.email || "", city: f.city == "—" ? "" : f.city || "", addr: f.addr || "",
    cows: s(f.cows), milking: s(f.milking), liters: s(f.liters), turns: s(f.turns), hours: f.hoursSet ? s(f.hours) : "", goal: g.ccs == null ? "" : String(g.ccs), goalCbt: g.cbt == null ? "" : String(g.cbt), obs: f.obs || "" };
}
function newFarm() { NF = newNF(); NFE = null; go("new"); }
function openEdit(id) { const f = DB.farms.find(x => x.id == id); if (!f) return note("Fazendas de demonstração não podem ser editadas."); NF = farmToNF(f); NFE = id; go("new"); }

const FIELD = (k, lab, o = {}) => `<div${o.wide ? ' style="grid-column:1/-1"' : ""}><label for="nf_${k}">${lab}${o.req ? " *" : ""}</label>${o.area ? `<textarea id="nf_${k}" rows="3" oninput="NF.${k}=this.value">${E(NF[k])}</textarea>` : `<input id="nf_${k}" ${o.type ? `type="${o.type}"` : ""} ${o.im ? `inputmode="${o.im}"` : ""} placeholder="${o.ph || ""}" value="${E(NF[k])}" oninput="NF.${k}=this.value">`}</div>`;
function newf() {
  const ed = NFE && DB.farms.find(x => x.id == NFE), f = ed || null;
  return `<div class="pagehead"><div><div class="crumb"><button onclick="go('home')">Fazendas</button>${f ? ` › <button onclick="go('farm','${f.id}')">${E(f.name)}</button>` : ""}</div><h1>${f ? "Editar fazenda" : "Cadastrar fazenda"}</h1><div class="mu">Campos com * são obrigatórios. Os demais podem ser completados depois.</div></div></div>
<div class="two"><div class="card"><fieldset class="fs"><legend>Identificação</legend>${FIELD("name", "Nome da fazenda", { req: 1 })}${FIELD("producer", "Produtor / responsável")}<div class="grid">${FIELD("phone", "Telefone / WhatsApp", { type: "tel", im: "tel" })}${FIELD("email", "E-mail", { type: "email", im: "email" })}</div></fieldset>
<fieldset class="fs" style="margin-top:12px"><legend>Localização</legend>${FIELD("city", "Cidade / UF", { ph: "Ex.: Castro, PR" })}${FIELD("addr", "Endereço, comunidade ou coordenadas", { ph: "Ex.: Estrada X, km 4 ou -24.79, -50.01" })}</fieldset></div>
<div class="card"><fieldset class="fs"><legend>Rebanho e produção</legend><div class="grid">${FIELD("cows", "Vacas no rebanho", { im: "numeric" })}${FIELD("milking", "Vacas em lactação", { im: "numeric" })}${FIELD("liters", "Produção diária (L)", { im: "decimal" })}${FIELD("turns", "Ordenhas por dia", { im: "numeric" })}${FIELD("hours", "Horas de ordenha por dia", { im: "decimal", wide: 1 })}</div></fieldset>
<fieldset class="fs" style="margin-top:12px"><legend>Metas de qualidade</legend><div class="grid">${FIELD("goal", "CCS máxima (mil/mL)", { im: "decimal" })}${FIELD("goalCbt", "CBT máxima (mil UFC/mL)", { im: "decimal" })}</div><p class="mu">Metas definidas por você (as mesmas do Setor 5). Sem meta, a qualidade aparece como “Sem meta”: o app não aplica limites normativos.</p></fieldset>
${FIELD("obs", "Observações", { area: 1 })}</div></div>
<div class="acts"><button class="btn w" onclick="addFarm()">${f ? "Salvar alterações" : "Salvar fazenda"}</button><button class="btn gh w" onclick="NF=newNF();const id=NFE;NFE=null;id?go('sector',id,0):go('home')">Cancelar</button></div>`;
}
function addFarm() {
  const n = txtc(NF.name); if (!n) return note("Informe o nome da fazenda.");
  const nums = { cows: num(NF.cows), milking: num(NF.milking), liters: num(NF.liters), turns: num(NF.turns), hours: num(NF.hours), goal: num(NF.goal), goalCbt: num(NF.goalCbt) };
  const bad = Object.entries(nums).filter(([, v]) => Number.isNaN(v) || (v != null && v < 0)).map(([k]) => k);
  if (bad.length) return note("Valores numéricos inválidos: confira os campos de rebanho, produção e metas.");
  if (nums.milking != null && nums.cows != null && nums.milking > nums.cows) return note("Vacas em lactação não pode ser maior que o rebanho.");
  if (nums.turns != null && (nums.turns > 6 || nums.turns % 1)) return note("Ordenhas por dia: informe um número inteiro de 1 a 6.");
  if (nums.hours != null && nums.hours > 24) return note("Horas de ordenha por dia não pode passar de 24.");
  const em = txtc(NF.email); if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return note("E-mail inválido.");
  if (String(NF.obs || "").length > 3000) return note("Observações muito longas (máx. 3000 caracteres).");
  const old = NFE ? DB.farms.find(x => x.id == NFE) : null, id = old ? old.id : "u" + Date.now();
  if (old == null && NFE) return note("A fazenda em edição não existe mais.");
  const f = Object.assign({ ccs: [], cbt: [], prod: [], st: [], alerts: [], visits: [] }, old || {}, {
    id, name: n, producer: txtc(NF.producer) || "—", phone: txtc(NF.phone, 40), email: em, city: txtc(NF.city) || "—", addr: txtc(NF.addr, 200), demo: false,
    cows: nums.cows || 0, milking: nums.milking || 0, liters: nums.liters || 0, turns: nums.turns || 0, hours: nums.hours || 0, hoursSet: nums.hours != null && nums.hours > 0,
    goalCcs: nums.goal || 0, obs: String(NF.obs || "").replace(/[<>]/g, "").trim(), created: old && old.created || new Date().toISOString(), updated: new Date().toISOString()
  });
  // metas: grava em DB.gl junto com a fazenda (uma única gravação conferida); desfaz tudo se falhar
  const g0 = DB.gl[id]; DB.gl[id] = Object.assign({}, g0, { ccs: nums.goal, cbt: nums.goalCbt });
  if (!upsert("farms", f)) { if (g0 === undefined) delete DB.gl[id]; else DB.gl[id] = g0; return note(FAIL); }
  farms = farms.filter(x => x.demo).concat(DB.farms);
  NF = newNF(); NFE = null; go(old ? "sector" : "farm", id, 0);
  note(old ? "Alterações salvas e conferidas no armazenamento do navegador." : "Fazenda salva e conferida no armazenamento do navegador.", 1);
}

/* Contagem dos registros de uma fazenda, por tipo (só dados reais gravados). */
function farmCounts(id) {
  const eids = new Set(DB.eq.filter(e => e.fid == id).map(e => e.id)), out = [];
  ARR.forEach(k => { if (k == "farms") return; const n = DB[k].filter(r => r.fid == id).length; if (n) out.push({ k, lab: LAB[k], n }); });
  MAP.forEach(k => { const n = Object.keys(DB[k] || {}).filter(key => k == "rm" ? eids.has(key) : key == id).length; if (n) out.push({ k, lab: LAB[k], n }); });
  if (DB.drafts[id]) out.push({ k: "drafts", lab: "Rascunho de teste de ordenha", n: 1 });
  return out;
}

/* Setor 1: ficha da fazenda (consulta) com acesso a editar e excluir. */
function ficha() {
  const f = F(), g = gls(f), st = sstat(f, 0), c = f.demo ? [] : farmCounts(f.id), D = (k, v) => `<dt>${k}</dt><dd>${v == null || v === "" || v === "—" ? '<span class="mu">Sem dados</span>' : v}</dd>`;
  return farmHead(f, "🏡 Cadastro da fazenda", `${badge(st)} <span class="mu">${E(st.t)}</span>`) + demoNote(f)
    + `<div class="two"><div class="card"><b>Identificação e localização</b><dl class="dl" style="margin-top:8px">${D("Fazenda", E(f.name))}${D("Produtor", E(f.producer))}${D("Telefone", f.phone ? `<a href="tel:${E(f.phone)}">${E(f.phone)}</a>` : "")}${D("E-mail", f.email ? `<a href="mailto:${E(f.email)}">${E(f.email)}</a>` : "")}${D("Cidade / UF", E(f.city))}${D("Endereço", E(f.addr || ""))}</dl></div>
<div class="card"><b>Rebanho, produção e metas</b><dl class="dl" style="margin-top:8px">${D("Vacas no rebanho", pos(f.cows) ? fm(f.cows, 0) : "")}${D("Em lactação", pos(f.milking) ? fm(f.milking, 0) : "")}${D("Produção diária", pos(f.liters) ? fm(f.liters, 0) + " L" : "")}${D("Ordenhas por dia", pos(f.turns) ? f.turns : "")}${D("Horas de ordenha", f.hoursSet ? fm(f.hours, 1) + " h/dia" : "")}${D("Meta CCS", g.ccs != null ? fm(g.ccs, 0) + " mil/mL" : "")}${D("Meta CBT", g.cbt != null ? fm(g.cbt, 0) + " mil UFC/mL" : "")}</dl></div></div>`
    + (f.obs ? `<div class="card"><b>Observações</b><p style="white-space:pre-wrap">${E(f.obs)}</p></div>` : "")
    + (f.demo ? '<div class="card mu">As fazendas de demonstração não podem ser editadas nem excluídas.</div>'
      : `<div class="card"><b>Registros desta fazenda</b><p class="mu">${c.length ? c.map(x => `${E(x.lab)}: ${x.n}`).join(" · ") : "Nenhum registro ainda."}</p><p class="mu">Cadastrada em ${f.created ? new Date(f.created).toLocaleDateString("pt-BR") : "—"}${f.updated ? " · alterada em " + new Date(f.updated).toLocaleString("pt-BR") : ""}</p></div>
<div class="acts noprint"><button class="btn w" onclick="openEdit('${f.id}')">✏️ Editar cadastro</button><button class="btn gh w" onclick="V.fd='${f.id}';V.fdName='';V.fdArmed=false;go('fdel')">🗑️ Excluir fazenda…</button></div>`);
}

/* Exclusão: mostra o que será apagado, pede o nome da fazenda, guarda cópia para desfazer. */
function farmDelView() {
  const f = DB.farms.find(x => x.id == V.fd);
  if (!f) return farmHead(F(), "Excluir fazenda") + '<div class="card mu">Fazenda não encontrada (as de demonstração não podem ser excluídas).</div>';
  const c = farmCounts(f.id), tot = c.reduce((a, x) => a + x.n, 0);
  return farmHead(f, "Excluir fazenda") + `<div class="alert cr" style="border-color:currentColor"><span style="color:var(--tx)"><b>Atenção:</b> a fazenda <b>${E(f.name)}</b> e todos os seus registros serão apagados deste navegador.</span></div>
<div class="card"><b>Será apagado</b><ul><li>Cadastro da fazenda</li>${c.map(x => `<li>${E(x.lab)}: ${x.n}</li>`).join("")}</ul><p class="mu">${tot} registro(s) além do cadastro. Outras fazendas não são afetadas.</p></div>
<div class="card"><b>1. Faça um backup antes (recomendado)</b><p class="mu">O arquivo permite recuperar tudo depois, inclusive em outro aparelho.</p><button class="btn s" onclick="bkExport()">Gerar backup (.json)</button></div>
<div class="card"><b>2. Confirme digitando o nome da fazenda</b><label for="fdn">Nome: ${E(f.name)}</label><input id="fdn" autocomplete="off" value="${E(V.fdName || "")}" oninput="V.fdName=this.value">
${V.fdNoSnapAsk ? `<label><input type="checkbox" style="width:auto" ${V.fdNoSnap ? "checked" : ""} onchange="V.fdNoSnap=this.checked"> Sem espaço para a cópia interna de segurança. Já fiz um backup e aceito excluir sem poder desfazer pelo app.</label>` : ""}
<br><div class="acts"><button class="btn dg w" onclick="farmDelete()">Excluir definitivamente</button><button class="btn gh w" onclick="go('sector','${f.id}',0)">Cancelar</button></div><p class="mu">Uma cópia interna do estado atual é guardada: dá para desfazer em Dados → “Desfazer última importação ou exclusão”.</p></div>`;
}
function farmDelete() {
  const f = DB.farms.find(x => x.id == V.fd); if (!f) return note("Fazenda não encontrada.");
  if (String(V.fdName || "").trim().toLowerCase() !== f.name.trim().toLowerCase()) return note("O nome digitado não confere. Nada foi excluído.");
  if (!STORE_OK || CORRUPT !== null) return note("Armazenamento indisponível: nada foi excluído.");
  const snap = snapWrite("exclusão da fazenda " + f.name);
  if (!snap && !V.fdNoSnap) { V.fdNoSnapAsk = true; return note("Sem espaço para a cópia interna de segurança. Gere um backup e marque a opção para prosseguir."); }
  const id = f.id, eids = new Set(DB.eq.filter(e => e.fid == id).map(e => e.id)), c = cp(DB); ensureDB(c);
  let removed = 0;
  ARR.forEach(k => { const n = c[k].length; c[k] = k == "farms" ? c[k].filter(x => x.id != id) : c[k].filter(x => x.fid != id); removed += n - c[k].length; });
  MAP.forEach(k => Object.keys(c[k]).forEach(key => { if (k == "rm" ? eids.has(key) : key == id) { delete c[k][key]; removed++; } }));
  delete c.drafts[id];
  c.meta.ops = arr1(c.meta.ops).concat([{ at: new Date().toISOString(), op: "excluir-fazenda", farm: f.name, id, removed }]).slice(-20);
  try { const s = JSON.stringify(c); localStorage.setItem("mq_ord", s); if (localStorage.getItem("mq_ord") !== s) throw Error("verificação"); }
  catch (e) { return note(FAIL + " Nada foi excluído."); }
  DB = c; farms = farms.filter(x => x.demo).concat(DB.farms); SV.ok = true; SV.err = null; SV.ts = Date.now(); SV.len = JSON.stringify(DB).length;
  Object.keys(DRS.items).forEach(k => { if (DRS.items[k] && DRS.items[k].fid == id) delete DRS.items[k]; }); RECOV = RECOV.filter(r => r.fid != id); DRP = true; drFlush();
  V.fd = null; V.fdName = ""; V.fdNoSnap = false; V.fdNoSnapAsk = false; V.f = (realFarms()[0] || farms[0]).id;
  go("home"); note(`Fazenda “${f.name}” excluída (${removed - 1} registro(s) apagados).${snap ? " Para desfazer: Dados → Desfazer última importação ou exclusão." : ""}`, 1);
}
