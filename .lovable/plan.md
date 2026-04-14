

## Plano: Permitir visualizar faturas futuras no dashboard e tabela

### Problema

A lógica atual em `filteredAndSorted` (linha 310) bloqueia despesas de faturas futuras com a regra `isPresente` — que só mostra faturas até o mês seguinte ao atual. Quando o usuário seleciona uma fatura futura (ex: junho/26), nada aparece porque as parcelas são filtradas antes.

Além disso, o dropdown de faturas provavelmente não inclui meses futuros como opções, já que só lista faturas existentes nos dados.

### Mudanças em `src/pages/Index.tsx`

1. **Bypass do filtro `isPresente` quando o usuário escolhe uma fatura específica futura**: Se `filters.fatura !== "all"` e `filters.fatura !== faturaFoco`, pular a verificação `isPresente` e deixar o filtro de fatura decidir sozinho quais registros mostrar.

2. **Gerar opções de faturas futuras no dropdown**: Calcular faturas futuras a partir das despesas parceladas (mesma lógica do `FutureExpenses`) e adicioná-las às opções do filtro de fatura. Assim, o usuário verá "junho/26", "julho/26", etc. como opções selecionáveis.

3. **Incluir parcelas virtuais na tabela e cards**: Quando uma fatura futura for selecionada, gerar as parcelas virtuais (projetadas) inline — mesma lógica de `FutureExpenses` — para que a tabela e os cards (Total, Teto, Transações, Maior Categoria) reflitam o valor comprometido naquela fatura.

### Detalhes técnicos

```text
Antes:
  Dropdown fatura: [Todas | mai/26 | abr/26 | ...]  (só meses com dados reais)
  Selecionar jun/26: impossível (não existe na lista)

Depois:
  Dropdown fatura: [Todas | mai/26 | jun/26 | jul/26 | ...]  (inclui meses com parcelas projetadas)
  Selecionar jun/26: mostra parcelas virtuais que cairão nessa fatura
  Cards refletem os valores projetados dessa fatura
```

### Arquivos alterados

- `src/pages/Index.tsx` — lógica de filtragem, geração de parcelas virtuais, opções do dropdown de faturas

