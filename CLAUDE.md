# CLAUDE.md

- O app inteiro está em `index.html`, em JS puro e minificado à mão, com pt-BR em toda a interface. Não há build nem dependências em tempo de execução; os testes ficam em `tests/run.js` (Playwright).
- O código está organizado por blocos de comentário `/* ===== Setor N ... ===== */`.
- O roteamento é feito por `go(view, farmId, sectorIdx)` e `render()`. O estado da UI fica em `V`; o banco persistido fica em `DB`, salvo em `localStorage["mq_ord"]` por `svS()`, que relê o valor para conferir a gravação.
- Coleções novas: inclua em `ARR` (listas) ou `MAP` (objetos), com rótulo em `LAB`. Se o formato mudar, aumente `DATA_VER` e adicione a migração em `MIGR`.
- Formulários novos que precisem de rascunho entram em `DRF`.
- Registros com `demo:true`, ou de fazendas `modelo`/`critica`, são dados de demonstração: nunca os misture com os dados reais.
- O backup precisa continuar compatível com `format:"milkiq-backup", formatVer:1`.
- Antes de dar uma mudança por concluída, rode `npm test`: os testes abrem a página no Chromium e conferem se o console fica sem erros. Ao criar uma tela, função ou setor, inclua-o em `INVENTORY` e nos fluxos de `tests/run.js`.
- Nunca edite `legacy/`, que é a cópia congelada do original e é conferida por hash.
