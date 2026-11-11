# MilkIQ · Leite IA

App web mobile-first para gestão técnica de fazendas leiteiras. É um **arquivo HTML único** (`index.html`): HTML, CSS e JavaScript puros, sem build e sem dependências externas.

## Como rodar

Abra `index.html` no navegador, ou sirva a pasta:

```bash
python3 -m http.server 8000   # depois acesse http://localhost:8000
```

## Origem

O código foi importado do artifact do Claude "MilkIQ · Leite IA" (build `etapa1-2026-11-11`, dados v2). O commit `7ca2e64` é a cópia fiel do original. A única mudança feita depois disso: quando o app roda fora do Claude, a exportação de backup baixa o arquivo pelo navegador, porque a API `window.claude.use("downloads")` só existe dentro do artifact.

## Módulos (Central da Fazenda, 9 setores)

| # | Setor | Estado |
|---|-------|--------|
| 1 | Cadastro da fazenda | Cadastro de fazendas funcionando (tela "Cadastrar fazenda") |
| 2 | Ordenhadeiras e equipamentos | Planejado (placeholder) |
| 3 | ISO Check | Planejado (placeholder) |
| 4 | Testes técnicos | Planejado (placeholder) |
| 5 | Qualidade do leite | **Funcional**: análises, evolução, antes/depois, tetos com fotos, indicadores/metas, relatório |
| 6 | Otimização da ordenha | **Funcional**: cronômetro por vaca, comparação entre turnos, ranking, gráficos, histórico, relatório, calculadoras |
| 7 | Limpeza CIP e químicos | **Funcional**: lavagens CIP, produtos químicos, análises de água |
| 8 | Manutenção preventiva | **Funcional**: equipamentos, componentes, revisões, serviços, medições, peças, diagramas, referências |
| 9 | Documentos e relatórios | Planejado (placeholder) |

Outras telas: Fazendas, Indicadores, Nova visita, Dados e backup.

## Dados

- Tudo fica no `localStorage` do navegador: não sincroniza entre aparelhos.
- As chaves são `mq_ord` (banco principal), `mq_draft` (rascunhos), `mq_snap` (cópia para desfazer importação), `mq_pre_v2` e `mq_user` (dados legados).
- As fazendas de demonstração (`modelo`, `critica`) são geradas no código e nunca entram no backup como dados reais.
- O backup `.json` (formato `milkiq-backup` v1) leva uma assinatura SHA-256 do corpo e é validado antes de qualquer importação.

`milkiq-backup-20261111-2235.json` é um backup exportado em 11/11/2026. Ele está vazio: 0 registros reais e só um rascunho do cronômetro.

## Documentos

`Relatorio-Geral-MilkIQ-Historico-Completo.md` descreve uma versão **diferente** do projeto, feita em React, TanStack, Supabase e Lovable Cloud. Esse código não está neste repositório.
