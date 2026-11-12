# MilkIQ · Leite IA

App web para gestão técnica de fazendas leiteiras, feito em HTML, CSS e JavaScript puros, sem dependências externas. Para abrir, basta `index.html`. `npm run build` gera `dist/milkiq.html`, uma versão em arquivo único para compartilhar.

## Usar o app

- **Versão estável:** https://lucasmp167.github.io/MilkIA/
- **Versão de testes:** https://lucasmp167.github.io/MilkIA/teste/ (novidades antes de irem para a estável; usa **dados separados**)

### Instalar no Samsung (Android)
1. Abra o link no **Chrome** ou no **Samsung Internet**, com internet, e espere a página carregar.
2. Chrome: toque em **⋮ → Instalar app** (ou **Adicionar à tela inicial → Instalar**). Samsung Internet: toque em **☰ → Adicionar página a → Tela inicial** (ou no ícone de instalar na barra de endereço). O app também mostra um botão **📲 Instalar** quando o navegador permite.
3. O ícone do MilkIQ aparece na tela inicial. A partir daí ele abre em tela cheia e **funciona sem internet**.

### Sem internet
- Depois da primeira abertura, todo o app fica guardado no aparelho (service worker).
- Os dados ficam no banco do aparelho (IndexedDB), com cópia rápida no localStorage. O app pede ao navegador para não apagá-los.
- Quando sair uma versão nova, aparece **“Atualizar agora”**, e os dados são mantidos.
- Não há nuvem: para levar os dados a outro aparelho, use **Dados → Gerar backup**.

### Publicação
O workflow `.github/workflows/publicar.yml` roda os testes e publica no branch `gh-pages`:
- a **estável** é o commit indicado em `deploy/ESTAVEL`, depois de passar nos próprios testes;
- a de **testes** é o último commit do branch.

Para promover uma versão, troque o commit em `deploy/ESTAVEL`.

## Rodar localmente

Abra `index.html` no navegador, ou sirva a pasta com `python3 -m http.server 8000` e acesse http://localhost:8000. Para testar o site publicável (offline/PWA): `node tools/build-site.js --out site` e sirva a pasta `site/`.

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
js/12-equipamentos.js Setor 2: ordenhadeiras, medições, componentes, relatórios
js/99-inicio.js   partida do app
tools/bundle.js   gera o arquivo único dist/milkiq.html
tools/build-site.js  gera o site publicável (PWA offline): estável e testes
tools/sw-template.js service worker (cache offline)
tools/icons.js    gera os ícones PNG a partir dos SVG
js/00-ambiente.js separa os dados da versão de testes
js/13-offline.js  IndexedDB, conexão, instalação e atualização
js/14-iso.js      Setor 3: ISO Check e biblioteca de referências
js/15-testes.js   Setor 4: leite residual, testes de campo, relatórios externos
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
| 2 | Ordenhadeiras e equipamentos | **Funcional**: várias ordenhadeiras por fazenda (GEA e outras marcas), ficha e configuração, componentes por bloco, esquema visual genérico, medições gerais e por ponto, avaliação só com referência verificada, problemas com causas e ações, pendências e histórico por equipamento, diagramas (oficial × não oficial), relatório individual, comparativo outra marca × GEA. Mesmo cadastro do Setor 8 |
| 3 | ISO Check | **Funcional**: auditorias por equipamento (ensaios estáticos, por pulsador e dinâmicos), avaliação só por referência verificada, problemas com causas e ações, comparação com a auditoria anterior, relatório com assinatura; **biblioteca de referências** ISO 5707 / ISO 6690 / GEA / outras, com fonte, item e status de verificação (o app não traz valores normativos) |
| 4 | Testes técnicos | **Funcional**: leite residual por vaca/quarto (média, mediana, máximo, % acima da referência verificada, evolução), testes de campo livres, relatórios externos (ex.: analisador) com arquivo anexado e comparação entre datas |
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
