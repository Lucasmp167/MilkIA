const SECT=[
["🏡","Cadastro da fazenda","Produtor, rebanho, produção, localização e metas",["Dados do produtor e localização","Rebanho e produção diária","Metas (CCS, CBT, litros/vaca)"]],
["⚙️","Ordenhadeiras e equipamentos","Cadastro técnico, modelos GEA, componentes e peças",["Cadastro técnico por máquina","Componentes e peças","Histórico de intervenções"]],
["📏","ISO Check","Auditorias ISO 5707/6690, vácuo, pulsação",["Medições de vácuo e pulsação","Comparação entre datas","Classificação técnica"]],
["🔧","Testes técnicos","Diagnóstico mecânico, campo, leite residual, PT6",["Testes de campo","Leite residual","Comparação de relatórios PT6"]],
["🥛","Qualidade do leite","CCS, CBT, gordura, proteína, lactose, crioscopia, ureia",["Análises laboratoriais","Tendência CCS/CBT","Avaliação de tetos (escore manual do técnico)"]],
["⏱️","Otimização da ordenha","Cronômetros, preparo, acoplamento, sobreordenha, ranking",["Cronômetros por vaca","Comparação entre turnos","Ranking de ordenhadores (com ressalvas)"]],
["🧼","Limpeza CIP e químicos","Temperaturas, tempo, concentração, consumo, estoque, água",["Registros de CIP","Consumo e estoque de químicos","Análises de água"]],
["🛠️","Manutenção preventiva","Revisões, peças, histórico e alertas",["Cronograma de revisões","Peças trocadas","Alertas de vencimento"]],
["📄","Documentos e relatórios","PDFs técnicos, gráficos, fotos, assinaturas, planos de ação",["Relatórios em PDF","Fotos e assinaturas","Planos de ação"]]];
const ST={ok:"Bom",wa:"Atenção",cr:"Crítico",na:"Não avaliado"};
let farms=[
{id:"modelo",name:"Fazenda Modelo",producer:"Produtor Fictício A",city:"Castro, PR",demo:true,cows:180,milking:160,liters:4800,turns:2,hours:7.5,hoursSet:true,goalCcs:200,ccs:[],cbt:[],prod:[],st:[],alerts:[],visits:[]},
{id:"critica",name:"Fazenda Crítica",producer:"Produtor Fictício B",city:"Carambeí, PR",demo:true,cows:90,milking:75,liters:1500,turns:2,hours:6,hoursSet:true,goalCcs:300,ccs:[],cbt:[],prod:[],st:[],alerts:[],visits:[]}];
let V={v:"home",f:farms[0].id,s:0};
const $=id=>document.getElementById(id),F=()=>farms.find(x=>x.id==V.f)||farms[0];
const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):null;
function line(d,c,goal){if(!d.length)return'<p class="mu">Sem dados ainda.</p>';const W=320,H=120,mx=Math.max(...d,goal||0)*1.1,mn=Math.min(...d,goal||1e9)*.9;
const X=i=>10+i*(W-20)/(d.length-1||1),Y=v=>H-10-(v-mn)/(mx-mn||1)*(H-20);
return`<svg viewBox="0 0 ${W} ${H}"><polyline fill="none" stroke="${c}" stroke-width="2.5" points="${d.map((v,i)=>X(i)+","+Y(v)).join(" ")}"/>${goal?`<line x1="10" x2="${W-10}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="currentColor" stroke-dasharray="4" opacity=".5"/><text x="12" y="${Y(goal)-4}" font-size="9" fill="currentColor" opacity=".7">meta ${goal}</text>`:""}</svg>`}
function bars(d,c){if(!d.length)return'<p class="mu">Sem dados ainda.</p>';const W=320,H=110,mx=Math.max(...d)*1.1,w=(W-20)/d.length;return`<svg viewBox="0 0 ${W} ${H}">${d.map((v,i)=>`<rect x="${10+i*w+2}" y="${H-8-v/mx*(H-16)}" width="${w-4}" height="${v/mx*(H-16)}" rx="3" fill="${c}"/>`).join("")}</svg>`}
function head(t,sub){return`<div class="top"><div><h1>${t}</h1><div class="mu">${sub||""}</div></div></div>`}
function sector(o){if(V.s==5&&!o)return ord();if(V.s==4)return qual();if(V.s==6)return cip();if(V.s==7)return man();if(V.s==0&&!o)return ficha();if(V.s==1&&!o)return eqv();const f=F(),s=SECT[V.s],st=sstat(f,V.s);let x=farmHead(f,s[0]+" "+s[1],E(s[2]))+`<div class="card">${badge(st)} <span class="mu">${E(st.t)}</span><p class="mu" style="margin-top:8px">Módulo completo previsto para as próximas etapas. Itens previstos:</p><ul>${s[3].map(i=>`<li>${i}</li>`).join("")}</ul></div>`+(SEXTRA[V.s]?SEXTRA[V.s](f):"");
if(V.s==2)x+='<div class="banner">Sem referência técnica verificada cadastrada: toda medição será classificada como “Não avaliado” até você informar limites oficiais.</div>';
if(V.s==5)x+=`<div class="card"><b>Calculadoras (funcionam de verdade)</b>
<label>Litros produzidos</label><input id="c1" type="number" value="${pos(f.liters)?f.liters:""}" oninput="calc()"><label>Vacas ordenhadas</label><input id="c2" type="number" value="${pos(f.milking)?f.milking:""}" oninput="calc()"><label>Duração da ordenha (min)</label><input id="c3" type="number" value="${f.hoursSet&&pos(f.hours)?f.hours*60:""}" oninput="calc()">
<p>Litros/vaca: <span class="res" id="r1"></span></p><p>Litros/hora: <span class="res" id="r2"></span></p>
<label>Pulsação: fases A, B, C, D (ms)</label><div class="grid"><input id="pa" type="number" value="300" oninput="calc()"><input id="pb" type="number" value="150" oninput="calc()"><input id="pc" type="number" value="450" oninput="calc()"><input id="pd" type="number" value="100" oninput="calc()"></div><p>Relação de pulsação: <span class="res" id="r3"></span> <span class="mu">(valor de referência: não avaliado)</span></p></div>`;
return x+(f.demo?'<p class="mu">Dados de demonstração.</p>':"")}
function calc(){if(!$("c1"))return;const g=i=>+$(i).value||0,L=g("c1"),v=g("c2"),m=g("c3");$("r1").textContent=v?(L/v).toFixed(2)+" L":"—";$("r2").textContent=m?(L/m*60).toFixed(0)+" L/h":"—";const a=g("pa"),b=g("pb"),t=a+b+g("pc")+g("pd");$("r3").textContent=t?((a+b)/t*100).toFixed(1)+" %":"—"}
function go(v,f,s){if(v!=V.v)V.note=null;V.v=v;if(f)V.f=f;if(s!=null)V.s=s;render();scrollTo(0,0)}
