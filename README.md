# MilkIQ · Leite IA

App web para gestão técnica de fazendas leiteiras, feito em HTML, CSS e JavaScript puros, sem dependências externas. Para abrir, basta `index.html`. `npm run build` gera `dist/milkiq.html`, uma versão em arquivo único para compartilhar.

## Como rodar

Abra `index.html` no navegador, ou sirva a pasta:

```bash
python3 -m http.server 8000   # depois acesse http://localhost:8000
```

## Testes

```bash
npm install && npx playwright install chromium   # só na primeira vez
npm test
```

`tests/run.js` cobre:
- **Integridade:** confere o hash do original, o checksum do backup de 11/11, o inventário de funções de cada setor e se o app continua autocontido.
- **Telas:** abre todas as telas, setores e abas no celular e no computador, sem erros no console e sem rolagem horizontal.
- **Fluxos:** fazenda, análise, cronômetro e visita persistem após recarregar; rascunhos são recuperados.
- **Backup:** importa o arquivo de 11/11; faz ida e volta exportando e importando; recusa arquivos adulterados, truncados ou de versão futura; isola os dados demo; desfaz a importação; protege dados ilegíveis.

Para testar outra cópia do app: `MILKIQ_APP=legacy/milkiq-original-etapa1-2026-11-11.html npm test`. O GitHub Actions roda os testes a cada push.

## Estrutura

```
index.html        página principal (carrega css/ e js/ na ordem)
css/app.css       estilos
js/01-base.js     setores, telas principais, navegação
js/02-…08-*.js    armazenamento, setores 6/5/7/8, dados, backup (código original)
js/10-central.js  Central da Fazenda, indicadores reais, status, alertas, gráficos, menus
js/11-fazendas.js cadastro, ficha, edição e exclusão de fazendas
js/99-inicio.js   partida do app
tools/bundle.js   gera o arquivo único dist/milkiq.html
legacy/           cópia original congelada (não editar) + SHA256SUMS
tests/run.js      testes automatizados
*.json            backup de 11/11 (usado como teste)
```

## Origem

O código foi importado do artifact do Claude "MilkIQ · Leite IA" (build `etapa1-2026-11-11`, dados v2). O commit `7ca2e64` (tag `v-original`, cópia em `legacy/`) é a cópia fiel do original. A única mudança feita depois disso: quando o app roda fora do Claude, a exportação de backup baixa o arquivo pelo navegador, porque a API `window.claude.use("downloads")` só existe dentro do artifact.

## Módulos (Central da Fazenda, 9 setores)

Cada fazenda tem sua Central, com indicadores, alertas e os 9 setores. O status de cada setor é **calculado a partir dos registros**:
- **Sem dados**: não há nenhum registro;
- **Bom / Atenção / Crítico**: só quando existe um critério (metas definidas por você, faixas cadastradas, prazos de revisão);
- **Não avaliado / Sem meta**: há dados, mas nenhum critério para avaliá-los.

| # | Setor | Estado |
|---|-------|--------|
| 1 | Cadastro da fazenda | **Funcional**: cadastrar, consultar (ficha), editar e excluir com confirmação + desfazer |
| 2 | Ordenhadeiras e equipamentos | Mostra os equipamentos do Setor 8; módulo próprio na Etapa 2 |
| 3 | ISO Check | Mostra as medições do Diagnóstico (Setor 8); módulo próprio na Etapa 3 |
| 4 | Testes técnicos | Planejado |
| 5 | Qualidade do leite | **Funcional**: análises, evolução, antes/depois, tetos (escore manual, sem IA), indicadores/metas, relatório |
| 6 | Otimização da ordenha | **Funcional**: cronômetro, comparação entre ordenhas, ranking, gráficos, histórico, relatório, calculadoras |
| 7 | Limpeza CIP e químicos | **Funcional**: lavagens, produtos/estoque, água, gráficos, antes/depois, relatório |
| 8 | Manutenção preventiva | **Funcional**: equipamentos, revisões, serviços, peças, diagramas, diagnóstico, relatório |
| 9 | Documentos e relatórios | Atalhos para os relatórios de cada setor |

Outras telas: Fazendas, Indicadores (KPIs e gráficos reais), Visitas, Dados e backup. No computador, o menu fica na lateral; no celular, ficam a barra inferior e a faixa de setores.

## Dados

- Tudo fica no `localStorage` do navegador: não sincroniza entre aparelhos.
- As chaves são `mq_ord` (banco principal), `mq_draft` (rascunhos), `mq_snap` (cópia para desfazer importação), `mq_pre_v2` e `mq_user` (dados legados).
- As fazendas de demonstração (`modelo`, `critica`) são geradas no código e nunca entram no backup como dados reais.
- O backup `.json` (formato `milkiq-backup` v1) leva uma assinatura SHA-256 do corpo e é validado antes de qualquer importação. A versão dos dados atual é a **v3**: backups v1 e v2 são convertidos ao importar. A cópia original em `legacy/` (v2) recusa dados v3 sem alterá-los.

`milkiq-backup-20261111-2235.json` é um backup exportado em 11/11/2026. Ele está vazio: 0 registros reais e só um rascunho do cronômetro.

## Documentos

`Relatorio-Geral-MilkIQ-Historico-Completo.md` descreve uma versão **diferente** do projeto, feita em React, TanStack, Supabase e Lovable Cloud. Esse código não está neste repositório.
