const SECT=[
["🏡","Cadastro da fazenda","Produtor, rebanho, produção, localização e metas",["Dados do produtor e localização","Rebanho e produção diária","Metas (CCS, CBT, litros/vaca)"]],
["⚙️","Ordenhadeiras e equipamentos","Cadastro técnico, modelos GEA, componentes e peças",["Cadastro técnico por máquina","Componentes e peças","Histórico de intervenções"]],
["📏","ISO Check","Auditorias ISO 5707/6690, vácuo, pulsação",["Medições de vácuo e pulsação","Comparação entre datas","Classificação técnica"]],
["🔧","Testes técnicos","Diagnóstico mecânico, campo, leite residual, PT6",["Testes de campo","Leite residual","Comparação de relatórios PT6"]],
["🥛","Qualidade do leite","CCS, CBT, gordura, proteína, lactose, crioscopia, ureia",["Análises laboratoriais","Tendência CCS/CBT","Avaliação de tetos (IA, com confirmação do técnico)"]],
["⏱️","Otimização da ordenha","Cronômetros, preparo, acoplamento, sobreordenha, ranking",["Cronômetros por vaca","Comparação entre turnos","Ranking de ordenhadores (com ressalvas)"]],
["🧼","Limpeza CIP e químicos","Temperaturas, tempo, concentração, consumo, estoque, água",["Registros de CIP","Consumo e estoque de químicos","Análises de água"]],
["🛠️","Manutenção preventiva","Revisões, peças, histórico e alertas",["Cronograma de revisões","Peças trocadas","Alertas de vencimento"]],
["📄","Documentos e relatórios","PDFs técnicos, gráficos, fotos, assinaturas, planos de ação",["Relatórios em PDF","Fotos e assinaturas","Planos de ação"]]];
const ST={ok:"Bom",wa:"Atenção",cr:"Crítico",na:"Não avaliado"};
function series(base,amp,n,seed){const a=[];for(let i=0;i<n;i++)a.push(Math.round(base+amp*Math.sin(i*1.7+seed)+amp*.5*Math.cos(i*.9+seed*2)));return a}
let farms=[
{id:"modelo",name:"Fazenda Modelo",producer:"Produtor Fictício A",city:"Castro, PR",demo:true,cows:180,milking:160,liters:4800,hours:7.5,
 ccs:series(150,35,14,1),cbt:series(12,4,14,2),prod:series(4800,150,14,3),goalCcs:200,
 st:["ok","ok","wa","ok","ok","ok","ok","ok","ok"],
 alerts:[["wa","Revisão de pulsadores vence em 12 dias (demo)"],["ok","CCS dentro da meta nos últimos 14 dias (demo)"]],visits:[]},
{id:"critica",name:"Fazenda Crítica",producer:"Produtor Fictício B",city:"Carambeí, PR",demo:true,cows:90,milking:75,liters:1500,hours:6,
 ccs:series(780,120,14,4),cbt:series(220,60,14,5),prod:series(1500,120,14,6),goalCcs:300,
 st:["wa","cr","na","cr","cr","cr","cr","cr","wa"],
 alerts:[["cr","CCS acima da meta há 14 dias (demo)"],["cr","CIP com temperatura final abaixo do registrado como alvo (demo)"],["cr","Sobreordenha frequente no turno da tarde (demo)"],["wa","Manutenção preventiva atrasada (demo)"]],visits:[]}];
let V={v:"home",f:farms[0].id,s:0};
const $=id=>document.getElementById(id),F=()=>farms.find(x=>x.id==V.f)||farms[0];
const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):null;
function line(d,c,goal){if(!d.length)return'<p class="mu">Sem dados ainda.</p>';const W=320,H=120,mx=Math.max(...d,goal||0)*1.1,mn=Math.min(...d,goal||1e9)*.9;
const X=i=>10+i*(W-20)/(d.length-1||1),Y=v=>H-10-(v-mn)/(mx-mn||1)*(H-20);
return`<svg viewBox="0 0 ${W} ${H}"><polyline fill="none" stroke="${c}" stroke-width="2.5" points="${d.map((v,i)=>X(i)+","+Y(v)).join(" ")}"/>${goal?`<line x1="10" x2="${W-10}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="currentColor" stroke-dasharray="4" opacity=".5"/><text x="12" y="${Y(goal)-4}" font-size="9" fill="currentColor" opacity=".7">meta ${goal}</text>`:""}</svg>`}
function bars(d,c){if(!d.length)return'<p class="mu">Sem dados ainda.</p>';const W=320,H=110,mx=Math.max(...d)*1.1,w=(W-20)/d.length;return`<svg viewBox="0 0 ${W} ${H}">${d.map((v,i)=>`<rect x="${10+i*w+2}" y="${H-8-v/mx*(H-16)}" width="${w-4}" height="${v/mx*(H-16)}" rx="3" fill="${c}"/>`).join("")}</svg>`}
function head(t,sub){return`<div class="top"><div><h1>${t}</h1><div class="mu">${sub||""}</div></div></div>`}
const BANNER='<div class="banner">Prévia interativa com dados fictícios de demonstração. Ainda sem banco de dados, IA ou sincronização reais.</div>';
function kpis(f){const c=avg(f.ccs),b=avg(f.cbt),p=avg(f.prod),lv=p?(p/f.milking).toFixed(1):"—",lh=p&&f.hours?Math.round(p/(f.hours*60)*60):"—";
return`<div class="kpi"><div><span class="mu">Litros/vaca</span><b>${lv}</b></div><div><span class="mu">Litros/hora</span><b>${lh}</b></div><div><span class="mu">Produção/dia</span><b>${p||"—"}</b></div><div><span class="mu">CCS (mil/mL)</span><b class="${c==null?"":c>f.goalCcs?"cr":"ok"}">${c??"—"}</b></div><div><span class="mu">CBT (mil UFC/mL)</span><b>${b??"—"}</b></div><div><span class="mu">Vacas em lactação</span><b>${f.milking}</b></div></div>`}
function home(){return head("🥛 MilkIQ · Leite IA","Suas fazendas")+BANNER+farms.map(f=>`<div class="card tap" onclick="go('farm','${f.id}')"><div class="top"><b style="font-size:17px">${f.name}</b>${f.demo?'<span class="demo">DEMONSTRAÇÃO</span>':""}</div><div class="mu">${f.producer} · ${f.city}</div><div class="mu">${f.cows} vacas · ${f.milking} em lactação</div><div style="margin-top:6px">${f.st.some(s=>s=="cr")?'<span class="badge cr">Requer atenção</span>':'<span class="badge ok">Em dia</span>'}</div></div>`).join("")+'<button class="btn" onclick="go(\'new\')">+ Cadastrar fazenda</button>'}
function farm(){const f=F();return`<div class="top"><button class="btn s" onclick="go('home')">← Fazendas</button>${f.demo?'<span class="demo">DEMONSTRAÇÃO</span>':""}</div>`+head(f.name,f.producer+" · "+f.city)+qsum()+csum()+msum()+"<h2>Alertas</h2>"+(f.alerts.length?f.alerts.map(a=>`<div class="alert ${a[0]}" style="border-color:currentColor"><span style="color:var(--tx)">${a[1]}</span></div>`).join(""):'<p class="mu">Nenhum alerta.</p>')+"<h2>Central da Fazenda</h2><div class=\"grid\">"+SECT.map((s,i)=>`<div class="sec" onclick="go('sector','${f.id}',${i})"><span class="ic">${s[0]}</span><b>${i+1}. ${s[1]}</b><span class="badge ${stx(f,i)}" style="width:fit-content">${ST[stx(f,i)]}</span></div>`).join("")+"</div>"}
function kpiv(){const f=F();return head("Indicadores",f.name)+kpis(f)+qsum()+csum()+msum()+`<div class="card"><b>CCS – 14 dias</b>${line(f.ccs,"var(--cr)",f.goalCcs)}</div><div class="card"><b>CBT – 14 dias</b>${line(f.cbt,"var(--wa)")}</div><div class="card"><b>Produção diária (L)</b>${bars(f.prod,"var(--pr)")}</div>`+(f.demo?'<p class="mu">Valores fictícios gerados para demonstração.</p>':"")}
function sector(o){if(V.s==5&&!o)return ord();if(V.s==4)return qual();if(V.s==6)return cip();if(V.s==7)return man();const f=F(),s=SECT[V.s],st=f.st[V.s]||"na";let x=`<button class="btn s" onclick="go('farm','${f.id}')">← ${f.name}</button>`+head(s[0]+" "+s[1],s[2])+`<div class="card"><span class="badge ${st}">${ST[st]}</span><p class="mu" style="margin-top:8px">Este módulo está planejado para a próxima etapa. Itens previstos:</p><ul>${s[3].map(i=>`<li>${i}</li>`).join("")}</ul></div>`;
if(V.s==2)x+='<div class="banner">Sem referência técnica verificada cadastrada: toda medição será classificada como “Não avaliado” até você informar limites oficiais.</div>';
if(V.s==5)x+=`<div class="card"><b>Calculadoras (funcionam de verdade)</b>
<label>Litros produzidos</label><input id="c1" type="number" value="${f.prod.length?f.prod[0]:0}" oninput="calc()"><label>Vacas ordenhadas</label><input id="c2" type="number" value="${f.milking}" oninput="calc()"><label>Duração da ordenha (min)</label><input id="c3" type="number" value="${f.hours*60}" oninput="calc()">
<p>Litros/vaca: <span class="res" id="r1"></span></p><p>Litros/hora: <span class="res" id="r2"></span></p>
<label>Pulsação: fases A, B, C, D (ms)</label><div class="grid"><input id="pa" type="number" value="300" oninput="calc()"><input id="pb" type="number" value="150" oninput="calc()"><input id="pc" type="number" value="450" oninput="calc()"><input id="pd" type="number" value="100" oninput="calc()"></div><p>Relação de pulsação: <span class="res" id="r3"></span> <span class="mu">(valor de referência: não avaliado)</span></p></div>`;
return x+(f.demo?'<p class="mu">Dados de demonstração.</p>':"")}
function calc(){if(!$("c1"))return;const g=i=>+$(i).value||0,L=g("c1"),v=g("c2"),m=g("c3");$("r1").textContent=v?(L/v).toFixed(2)+" L":"—";$("r2").textContent=m?(L/m*60).toFixed(0)+" L/h":"—";const a=g("pa"),b=g("pb"),t=a+b+g("pc")+g("pd");$("r3").textContent=t?((a+b)/t*100).toFixed(1)+" %":"—"}
function go(v,f,s){if(v!=V.v)V.note=null;V.v=v;if(f)V.f=f;if(s!=null)V.s=s;render();scrollTo(0,0)}
function render(){const m={home,farm,kpi:kpiv,sector,visit,new:newf,backup:bkv};$("app").innerHTML=statusBar()+m[V.v]();
const t=V.v=="sector"?"farm":V.v,N=[["home","🏠","Fazendas"],["farm","🧩","Central"],["kpi","📊","Indicadores"],["backup","💾","Dados"]];
$("nav").innerHTML=N.map(n=>`<button class="${t==n[0]?"on":""}" onclick="go('${n[0]}')"><span>${n[1]}</span>${n[2]}</button>`).join("")+`<button class="fab" onclick="go('visit')"><span>＋</span>Visita</button>`;if(V.v=="sector"&&V.s==5){calc();tickT()}drSoon()}
