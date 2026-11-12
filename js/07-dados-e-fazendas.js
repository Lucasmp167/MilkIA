/* ===== Etapa 1: segurança dos dados e estabilidade ===== */
const DATA_VER=5,APP_BUILD="2.3-testes-2026-11-12",DEMO_IDS=["modelo","critica"];
const ARR=["sessions","an","ts","ev","cy","pq","wa","eq","cmp","pl","sv","dx","pc","dg","rf","vs","farms"],MAP=["gl","ob","cr","rp","rm"];
const LAB={sessions:"Testes de ordenha",an:"Análises de leite",ts:"Avaliações de tetos",ev:"Eventos",cy:"Lavagens CIP",pq:"Produtos químicos",wa:"Análises de água",eq:"Equipamentos",cmp:"Componentes",pl:"Itens de revisão",sv:"Serviços",dx:"Medições",pc:"Peças",dg:"Diagramas",rf:"Referências técnicas",vs:"Visitas",farms:"Fazendas",gl:"Metas de qualidade",ob:"Observações de qualidade",cr:"Referências de limpeza",rp:"Relatório de limpeza",rm:"Relatório de manutenção"};
const ID=/^[A-Za-z0-9_-]{1,64}$/,clean=s=>String(s==null?"":s).replace(/[<>]/g,"").slice(0,120);
let svT=null,dsT=null,drT=null,DRP=false,DRERR=null,DRBAD=false,DRLEN=0,MIGERR=null,RECOV=[],LASTDR={},DRS={ver:1,items:{}};
function ensureDB(d){ARR.forEach(k=>{if(!Array.isArray(d[k]))d[k]=[]});MAP.concat(["drafts"]).forEach(k=>{if(!d[k]||typeof d[k]!="object"||Array.isArray(d[k]))d[k]={}});if(!d.meta||typeof d.meta!="object"||Array.isArray(d.meta))d.meta={};return d}
const MIGR={1:d=>{d.meta.ver=2;d.meta.migrated=(d.meta.migrated||[]).concat([{from:1,to:2,at:new Date().toISOString()}]);return d},
 /* v3: a meta de CCS do cadastro da fazenda passa a ser a meta de qualidade (DB.gl), usada pelos painéis */
 2:d=>{(d.farms||[]).forEach(f=>{if(!f||!f.id||!(f.goalCcs>0))return;const g=d.gl[f.id]=d.gl[f.id]&&typeof d.gl[f.id]=="object"?d.gl[f.id]:{};if(g.ccs==null)g.ccs=f.goalCcs});d.meta.ver=3;d.meta.migrated=(d.meta.migrated||[]).concat([{from:2,to:3,at:new Date().toISOString()}]);return d},
 /* v4: coleção de auditorias ISO Check (DB.iso) */
 3:d=>{if(!Array.isArray(d.iso))d.iso=[];d.meta.ver=4;d.meta.migrated=(d.meta.migrated||[]).concat([{from:3,to:4,at:new Date().toISOString()}]);return d},
 /* v5: testes técnicos (DB.tt) */
 4:d=>{if(!Array.isArray(d.tt))d.tt=[];d.meta.ver=5;d.meta.migrated=(d.meta.migrated||[]).concat([{from:4,to:5,at:new Date().toISOString()}]);return d}};
function migrate(d){ensureDB(d);let v=d.meta.ver||1;if(typeof v!="number"||v>DATA_VER)throw Error("dados de versão mais nova ("+v+") que este app (v"+DATA_VER+")");while(v<DATA_VER){d=MIGR[v](d);v++}d.meta.ver=DATA_VER;return d}
const EQALL=()=>[...(DM.eq||[]),...DB.eq],fname=id=>(farms.find(f=>f.id==id)||{}).name||"—",hhmm=t=>new Date(t).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),stamp=()=>new Date().toISOString().slice(0,16).replace(/[-:T]/g,"").replace(/^(\d{8})(\d{4})$/,"$1-$2");
function cleanFarm(f){if(!f||typeof f!="object"||!ID.test(f.id||""))return null;const n=x=>{const v=Number(x);return isFinite(v)&&v>=0?v:0},arr=a=>Array.isArray(a)?a.slice(0,60).map(Number).filter(x=>isFinite(x)):[];const t=(x,k)=>String(x==null?"":x).replace(/[<>]/g,"").slice(0,k);return{id:f.id,name:clean(f.name)||"Fazenda",producer:clean(f.producer)||"—",city:clean(f.city)||"—",phone:t(f.phone,40),email:t(f.email,120),addr:t(f.addr,200),obs:t(f.obs,3000),turns:n(f.turns),hoursSet:!!f.hoursSet,created:typeof f.created=="string"?f.created.slice(0,40):undefined,updated:typeof f.updated=="string"?f.updated.slice(0,40):undefined,demo:false,cows:n(f.cows),milking:n(f.milking),liters:n(f.liters),hours:n(f.hours)||6,ccs:arr(f.ccs),cbt:arr(f.cbt),prod:arr(f.prod),goalCcs:n(f.goalCcs)||200,st:Array.isArray(f.st)?f.st.slice(0,9).map(x=>["ok","wa","cr","na"].includes(x)?x:"na"):[],alerts:[],visits:[]}}
/* inicialização, migração de versão e fazendas */
function initData(){try{localStorage.removeItem("mq_probe")}catch(e){}
 if(CORRUPT!==null){ensureDB(DB);return}
 try{const first=!DB.meta||!DB.meta.ver;ensureDB(DB);
  if(STORE_OK&&first){let leg=[];try{const s=localStorage.getItem("mq_user");if(s){const a=JSON.parse(s);if(Array.isArray(a))leg=a.map(cleanFarm).filter(Boolean)}}catch(e){}
   try{const raw=localStorage.getItem("mq_ord");if(raw&&raw.length<1.5e6){localStorage.setItem("mq_pre_v2",raw);DB.meta.preV2Copy=true}else if(raw)DB.meta.preV2Copy=false}catch(e){DB.meta.preV2Copy=false}
   leg.forEach(f=>{if(!DB.farms.some(x=>x.id==f.id))DB.farms.push(f)});migrate(DB);DB.meta.created=DB.meta.created||new Date().toISOString();DB.meta.legacyFarms=leg.length;svS()}
  else migrate(DB)}catch(e){MIGERR=String(e&&e.message||e);STORE_OK=false}
 if(DB.farms.length||STORE_OK)farms=farms.filter(f=>f.demo).concat(DB.farms)}
/* gravação adiada (campos de texto) */
function svD(){SV.pend=true;clearTimeout(svT);svT=setTimeout(svFlush,500)}
function svFlush(){clearTimeout(svT);if(SV.pend){SV.pend=false;svS()}}
/* ===== rascunhos ===== */
const E8=["eq","cmp","pl","sv","dx","pc","dg","rf"],L8={eq:"Equipamento",cmp:"Componente",pl:"Item de revisão",sv:"Serviço de manutenção",dx:"Medição / diagnóstico",pc:"Peça do catálogo",dg:"Diagrama",rf:"Referência técnica"},T8={eq:"eq",cmp:"eq",pl:"mt",sv:"mt",dx:"dx",pc:"pc",dg:"pc",rf:"dx"};
const arr1=a=>Array.isArray(a)?a:[];
const DRF=[
{k:"an",l:"Análise de leite (Setor 5)",s:4,tv:"q",tab:"an",get:()=>({a:AF}),fresh:()=>({a:newAF()}),set:v=>{AF=Object.assign(newAF(),v.a)}},
{k:"te",l:"Avaliação de tetos (Setor 5)",s:4,tv:"q",tab:"te",get:()=>({t:TF,p:PH}),fresh:()=>({t:newTF(),p:[]}),set:v=>{TF=Object.assign(newTF(),v.t);PH=arr1(v.p)}},
{k:"ev",l:"Evento (Setor 5)",s:4,tv:"q",tab:"ba",get:()=>({e:EF}),fresh:()=>({e:{date:TD(),type:"Limpeza",desc:""}}),set:v=>{EF=Object.assign({date:TD(),type:"Limpeza",desc:""},v.e)}},
{k:"cy",l:"Lavagem CIP (Setor 7)",s:6,tv:"c",tab:"cy",get:()=>({c:CF,id:CE}),fresh:()=>({c:newCF(),id:null}),set:v=>{CF=Object.assign(newCF(),v.c);CE=DB.cy.some(x=>x.id==v.id)?v.id:null}},
{k:"pq",l:"Produto químico (Setor 7)",s:6,tv:"c",tab:"pq",get:()=>({p:PF,id:PE}),fresh:()=>({p:newPF(),id:null}),set:v=>{PF=Object.assign(newPF(),v.p);PE=DB.pq.some(x=>x.id==v.id)?v.id:null}},
{k:"wa",l:"Análise de água (Setor 7)",s:6,tv:"c",tab:"wa",get:()=>({w:WF,id:WE}),fresh:()=>({w:newWF(),id:null}),set:v=>{WF=Object.assign(newWF(),v.w);WE=DB.wa.some(x=>x.id==v.id)?v.id:null}},
{k:"tm",l:"Cronômetro da vaca (Setor 6)",s:5,tv:"o",tab:"cro",get:()=>({n:T.n,acc:el(),m:T.m,done:T.done,was:T.run}),fresh:()=>({n:"",acc:0,m:{},done:false,was:false}),set:v=>{T.run=false;T.acc=+v.acc||0;T.m=v.m&&typeof v.m=="object"?v.m:{};T.done=!!v.done;T.n=String(v.n||"")}},
{k:"vs",l:"Visita",view:"visit",get:()=>({v:VF,id:VE}),fresh:()=>({v:newVF(),id:null}),set:v=>{VF=Object.assign(newVF(),v.v);VE=DB.vs.some(x=>x.id==v.id)?v.id:null}},
{k:"nf",l:"Cadastro de fazenda",view:"new",get:()=>({n:NF,id:NFE}),fresh:()=>({n:newNF(),id:null}),set:v=>{NF=Object.assign(newNF(),v.n);NFE=DB.farms.some(x=>x.id==v.id)?v.id:null}}];
E8.forEach(k=>DRF.push({k:"s8"+k,l:L8[k]+" (Setor 8)",s:7,tv:"m8",tab:T8[k],
 get:()=>{const o={f:FS[k],id:FE[k]};if(k=="sv"){o.np=NP;o.pb=PB;o.pa=PA}if(k=="pc")o.pp=PP;if(k=="dg")o.pg=PG;return o},
 fresh:()=>{const o={f:NEW[k](),id:null};if(k=="sv"){o.np={n:"",q:"",c:""};o.pb=[];o.pa=[]}if(k=="pc")o.pp=[];if(k=="dg")o.pg=[];return o},
 set:v=>{FS[k]=Object.assign(NEW[k](),v.f);FE[k]=DB[k].some(x=>x.id==v.id)?v.id:null;if(k=="sv"){NP=Object.assign({n:"",q:"",c:""},v.np);PB=arr1(v.pb);PA=arr1(v.pa)}if(k=="pc")PP=arr1(v.pp);if(k=="dg")PG=arr1(v.pg)}}));
const nz=s=>s.replace(/"date":"\d{4}-\d{2}-\d{2}"/g,'"date":""');
function drSnap(){let ch=false;for(const r of DRF){let js,fr;try{js=nz(JSON.stringify(r.get()));fr=nz(JSON.stringify(r.fresh()))}catch(e){continue}
  if(js==fr){if(DRS.items[r.k]){delete DRS.items[r.k];ch=true}delete LASTDR[r.k];RECOV=RECOV.filter(x=>x.k!=r.k);continue}
  if(LASTDR[r.k]===js)continue;LASTDR[r.k]=js;DRS.items[r.k]={ts:Date.now(),fid:V.f,d:r.get()};ch=true}
 if(ch){DRP=true;clearTimeout(drT);drT=setTimeout(drFlush,600)}}
function drSoon(){clearTimeout(dsT);dsT=setTimeout(drSnap,400)}
function drFlush(){clearTimeout(drT);if(!DRP)return;DRP=false;if(!STORE_OK&&CORRUPT===null){DRERR="fail";return}
 try{let s=JSON.stringify(DRS),np=false;try{localStorage.setItem("mq_draft",s)}catch(e){const c=JSON.parse(s);Object.values(c.items).forEach(it=>{["p","pb","pa","pp","pg"].forEach(q=>{if(it.d&&Array.isArray(it.d[q])&&it.d[q].length){it.d[q]=[];it.nophotos=true;np=true}})});s=JSON.stringify(c);localStorage.setItem("mq_draft",s)}
  if(localStorage.getItem("mq_draft")!==s)throw Error("verificação");DRLEN=s.length;DRERR=np?"photos":null}catch(e){DRERR="fail"}}
function drRestore(){try{const raw=localStorage.getItem("mq_draft");if(!raw)return;DRLEN=raw.length;let o;try{o=JSON.parse(raw);if(!o||o.ver!==1||!o.items||typeof o.items!="object")throw Error("fmt")}catch(e){DRBAD=true;try{localStorage.setItem("mq_draft_bad",raw)}catch(x){}return}
 DRS=o;for(const r of DRF){const it=o.items[r.k];if(!it||!it.d||typeof it.d!="object")continue;try{r.set(it.d);LASTDR[r.k]=nz(JSON.stringify(r.get()));RECOV.push({k:r.k,l:r.l,fid:it.fid,ts:it.ts,np:it.nophotos})}catch(e){}}}catch(e){}}
function drOpen(k){const r=DRF.find(x=>x.k==k),it=DRS.items[k];if(!r)return;if(r.view){go(r.view);return}const fid=farms.some(f=>f.id==(it&&it.fid))?it.fid:V.f;V[r.tv]=r.tab;go("sector",fid,r.s)}
function drDiscard(k){const r=DRF.find(x=>x.k==k);if(!r)return;r.set(r.fresh());LASTDR[k]=nz(JSON.stringify(r.get()));delete DRS.items[k];DRP=true;RECOV=RECOV.filter(x=>x.k!=k);drFlush();render()}
function flushAll(){svFlush();drSnap();drFlush()}
/* ===== visitas ===== */
const VT=["Rotina de ordenha","ISO Check","Qualidade do leite","Manutenção","Limpeza CIP","Outra"];
function newVF(){return{fid:"",tipo:VT[0],date:TD(),notas:""}}
let VF=newVF(),VE=null,NF=null; /* NF/newNF: js/11-fazendas.js */
function visit(){const f=F(),fid=VF.fid||f.id,vs=DB.vs.filter(v=>v.fid==fid).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
return head("Nova visita","Registro rápido")+`<div class="card"><b>${VE?"Editar visita":"Nova visita"}</b><label>Fazenda</label><select onchange="VF.fid=this.value;render()">${farms.map(x=>`<option value="${x.id}" ${x.id==fid?"selected":""}>${E(x.name)}</option>`).join("")}</select><label>Tipo</label><select onchange="VF.tipo=this.value">${VT.map(t=>`<option ${VF.tipo==t?"selected":""}>${t}</option>`).join("")}</select><label>Data</label><input type="date" value="${E(VF.date)}" oninput="VF.date=this.value"><label>Observações</label><textarea rows="3" oninput="VF.notas=this.value">${E(VF.notas)}</textarea><br><br><button class="btn" onclick="saveVisit()">${VE?"Salvar alterações":"Salvar visita"}</button>${VE?'<br><br><button class="btn s" onclick="VE=null;VF=newVF();render()">Cancelar edição</button>':""}</div><h2>Visitas — ${E(fname(fid))} (${vs.length})</h2>`+(vs.length?vs.map(v=>`<div class="card"><div class="top"><b>${E(v.date)} · ${E(v.tipo)}</b><span><button class="btn s" onclick="vedit('${v.id}')">Editar</button> <button class="btn s" onclick="qdel('vs','${v.id}')">${V.del==v.id?"Confirmar":"Excluir"}</button></span></div><p class="mu">${E(v.notas)||"Sem observações"}</p></div>`).join(""):'<p class="mu">Nenhuma visita registrada nesta fazenda.</p>')}
function vedit(id){const v=DB.vs.find(x=>x.id==id);if(!v)return;VF=cp(v);VE=id;render();scrollTo(0,0)}
function saveVisit(){const v=cp(VF);if(!v.fid)v.fid=V.f;if(!farms.some(f=>f.id==v.fid))return note("Fazenda inválida.");if(!v.date)return note("Informe a data da visita.");if(String(v.notas).length>5000)return note("Observações muito longas (máx. 5000 caracteres).");
 const old=VE?DB.vs.find(x=>x.id==VE):null;v.id=VE||"v"+Date.now();v.demo=false;v.created=old&&old.created||Date.now();
 if(upsert("vs",v)){VF=newVF();VE=null;V.f=v.fid;note("Visita salva e conferida no armazenamento do navegador.",1)}else note(FAIL)}
/* ===== cadastro de fazendas: ver js/11-fazendas.js ===== */
/* ===== barra de estado e avisos ===== */
function statusBar(){let h=envNotice()+updateNotice()+netNotice();const A=(c,t)=>`<div class="alert ${c}" style="border-color:currentColor"><span style="color:var(--tx)">${t}</span></div>`;
 if(CORRUPT!==null)h+=A("cr","<b>Os dados salvos neste navegador estão ilegíveis.</b> Para proteger o original, nada será gravado agora.<br><button class=\"btn s\" onclick=\"bkRaw()\">Exportar texto original</button> <button class=\"btn s\" onclick=\"bkFresh()\">Começar do zero (mantém uma cópia)</button>"+(IDB_COPY?"<br><button class=\"btn s\" onclick=\"restoreFromIdb()\">Restaurar a cópia do banco do aparelho"+(IDBS.copyTs?" ("+new Date(IDBS.copyTs).toLocaleString("pt-BR")+")":"")+"</button>":""));
 else if(MIGERR)h+=A("cr","Os dados são de uma versão incompatível: "+E(MIGERR)+". Nada será gravado.");
 else if(!STORE_OK)h+=A("cr","<b>Armazenamento indisponível neste navegador/ambiente.</b> Nada que você registrar será mantido após atualizar a página.");
 if(STORE_OK&&SV.ok===false)h+=A("cr","⚠ A última gravação <b>falhou</b> ("+E(SV.err)+"). Alterações recentes podem estar só na tela. Exporte um backup e libere espaço.");
 if(DRERR=="fail")h+=A("cr","⚠ Não foi possível guardar os rascunhos (espaço cheio ou armazenamento bloqueado).");
 if(DRERR=="photos")h+=A("wa","Rascunho guardado sem as fotos (espaço insuficiente). Salve o registro para não perdê-las.");
 if(DRBAD)h+=A("wa","Rascunhos antigos ilegíveis foram ignorados (cópia mantida).");
 if(STORE_OK&&(SV.len+DRLEN)>4e6&&!IDBS.ok)h+=A("wa","Armazenamento perto do limite estimado (~"+fm((SV.len+DRLEN)/1e6,1)+" de ~5 milhões de caracteres). Faça backup e evite muitas fotos.");
 if(RECOV.length)h+=`<div class="card"><b>📝 Rascunhos recuperados</b><p class="mu">Estes formulários tinham dados não salvos antes de fechar ou atualizar a página.</p>${RECOV.map(r=>`<div class="top"><span>${E(r.l)} · ${E(fname(r.fid))} · ${hhmm(r.ts)}${r.np?" (sem fotos)":""}</span><span><button class="btn s" onclick="drOpen('${r.k}')">Abrir</button> <button class="btn s" onclick="drDiscard('${r.k}')">Descartar</button></span></div>`).join("")}<button class="btn s" onclick="RECOV=[];render()">Ocultar aviso</button></div>`;
 if(V.v=="home"&&STORE_OK&&ARR.some(k=>DB[k].length)){const lb=DB.meta&&DB.meta.lastExport,d=lb?Math.floor((Date.now()-new Date(lb))/864e5):null;if(d==null||d>=7)h+=A("wa","💾 "+(d==null?"Você ainda não gerou nenhum backup.":"Último backup há "+d+" dias.")+" <button class=\"btn s\" onclick=\"go('backup')\">Fazer backup</button>")}
 if(V.v!="sector"&&V.note)h+=A(V.note.ok?"ok":"cr",V.note.t);
 return h}
