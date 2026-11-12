# CLAUDE.md

- O app é composto por `index.html`, `css/app.css` e `js/NN-*.js`, todos em JS puro com pt-BR em toda a interface. Não há build nem dependências em tempo de execução; os testes ficam em `tests/run.js` (Playwright).
- Os arquivos `js/` são scripts clássicos que compartilham o escopo global, e **a ordem de carregamento em `index.html` importa**: o código de nível superior só enxerga funções de arquivos já carregados. Arquivo novo entra com o próximo número, e a tag `<script>` vai em `index.html`.
- O código antigo (01–09) é minificado à mão; o código novo deve ser legível e comentado.
- `npm run build` gera `dist/milkiq.html`, um arquivo único autocontido para compartilhar ou publicar.
- O roteamento é feito por `go(view, farmId, sectorIdx)` e `render()`. O estado da UI fica em `V`; o banco persistido fica em `DB`, salvo em `localStorage["mq_ord"]` por `svS()`, que relê o valor para conferir a gravação.
- Coleções novas: inclua em `ARR` (listas) ou `MAP` (objetos), com rótulo em `LAB`. Se o formato mudar, aumente `DATA_VER` e adicione a migração em `MIGR`.
- Formulários novos que precisem de rascunho entram em `DRF`.
- Registros com `demo:true`, ou de fazendas `modelo`/`critica`, são dados de demonstração: nunca os misture com os dados reais.
- O backup precisa continuar compatível com `format:"milkiq-backup", formatVer:1`.
- Antes de dar uma mudança por concluída, rode `npm test`: os testes abrem a página no Chromium e conferem se o console fica sem erros. Ao criar uma tela, função ou setor, inclua-o em `INVENTORY` e nos fluxos de `tests/run.js`.
- Nunca edite `legacy/`, que é a cópia congelada do original e é conferida por hash.
- Telas novas não podem mostrar números fixos ou fictícios. Indicadores, status e alertas vêm de `fkpi`, `sstat` e `falerts` (em `js/10-central.js`); sem registro, a tela mostra "Sem dados". Um status só pode ser Bom, Atenção ou Crítico se existir um critério (meta do usuário, faixa cadastrada ou referência verificada).
- Funções antigas (`QA`, `SS`, `L`, `CYS`, `cls`, `planSt`...) leem a fazenda em `V.f`. Para calcular outra fazenda, use `withFarm(id, fn)`.
- `sector(1)` (com argumento) devolve a tela "placeholder" com as calculadoras; o Setor 6 usa isso na aba Calculadoras.
