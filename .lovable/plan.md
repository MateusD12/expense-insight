## Problema

1. **Assinaturas não aparecem na tabela do dashboard.** O dashboard gera `subscriptionVirtuals`, mas só usa o array para somar no card "Próximas faturas" e popular o dropdown de faturas. As linhas das assinaturas projetadas **nunca são adicionadas ao pool da tabela principal**, diferente das parcelas (`virtualExpenses`), que são incluídas quando o filtro é fatura foco ou futura.

2. **Parcelas projetadas não aparecem na fatura foco quando o mês vira.** Hoje, quando o filtro é a fatura foco, o pool inclui `virtualExpenses` — então deveria aparecer. O que falha é o ciclo "assinaturas + parcelas" da fatura nova, porque a tabela só ganha parcelas, não assinaturas.

3. **Despesas adiantadas/parcelas de faturas que já passaram continuam visíveis** ao escolher "Todas as faturas" ou ao voltar para uma fatura anterior. O usuário quer um filtro do tipo "ocultar o que já passou" que mostre somente o que ainda está por vir (fatura foco em diante).

## O que será implementado

### 1. Incluir assinaturas projetadas como linhas da tabela (`src/pages/Index.tsx`)

- Transformar `subscriptionVirtuals` no mesmo formato de `Expense` virtual (como já é feito em `FutureExpenses.tsx`), com flag `isSubscription`, id sintético `sub_<id>_<yyyy-mm>`, `parcela=1`, `total_parcela=1`, `classificacao` da assinatura, etc.
- Adicionar essas linhas ao `pool` da tabela quando o filtro for fatura foco ou futura (mesma regra das parcelas virtuais).
- Garantir que o card "Próximas faturas" e os gráficos continuem somando o mesmo valor (sem dupla contagem) — o array virá da mesma fonte.

### 2. Indicar visualmente assinaturas e parcelas projetadas na tabela principal

- Pequeno ícone (`Repeat` para assinatura, `Sparkles` para parcela virtual) ao lado do nome da despesa, igual ao que já existe em `FutureExpenses.tsx`.
- Linhas virtuais não devem oferecer ações de editar/excluir (seriam lançamentos automáticos quando o mês chegar).

### 3. Novo filtro "Ocultar passadas" no dashboard

- Adicionar toggle/switch ao lado dos filtros existentes: **"Somente próximas faturas"** (ligado por padrão).
- Quando ligado: oculta da tabela e dos gráficos qualquer item cuja `fatura` (mês) seja anterior à `faturaFoco`, **mesmo no filtro "Todas as faturas"** ou em fatura específica anterior.
- Quando desligado: comportamento atual (mostra histórico completo conforme filtro).
- O dropdown de fatura continua existindo; o toggle apenas adiciona um corte mínimo no eixo do tempo.

### 4. Manter comportamento existente

- Filtro padrão continua sendo `faturaFoco`.
- Adiantamento/reversão de parcelas e assinaturas continuam intactos.
- Importação CSV e edição manual de fatura permanecem com a mesma regra (a escolha manual prevalece, conforme já implementado em `effectiveFatura`).

## Detalhes técnicos

- **Arquivo principal:** `src/pages/Index.tsx`
  - Refatorar `subscriptionVirtuals` para devolver `(Expense & { isVirtual; isSubscription })[]` ao invés de `{ fatura, valor }[]`, reutilizando a mesma lógica do `FutureExpenses.tsx`.
  - Atualizar `filteredAndSorted`:
    ```ts
    const isFutureOrFocus = filters.fatura !== "all" && filters.fatura >= faturaFoco;
    const pool = isFutureOrFocus
      ? [...normalizedExpenses, ...virtualExpenses, ...subscriptionVirtuals]
      : filters.fatura === "all"
        ? [...normalizedExpenses, ...virtualExpenses, ...subscriptionVirtuals]
        : normalizedExpenses;

    if (hideOlderThanFoco) {
      result = result.filter((e) => (e.fatura?.slice(0,7) ?? "") >= faturaFoco);
    }
    ```
  - Adicionar `useState<boolean>(true)` para `hideOlderThanFoco`.
  - Atualizar dependências de `useMemo` e os cálculos do card "Próximas faturas" para usar a mesma fonte (sem dupla contagem das assinaturas).
- **Tabela:** linhas virtuais (`isVirtual`) ganham o mesmo tratamento visual usado em `FutureExpenses.tsx` (ícone + esconder ações de edição).
- **Gráficos:** continuam derivando de `filteredAndSorted`, então herdam automaticamente as assinaturas e o filtro "ocultar passadas".

## Resultado esperado

- Ao entrar no novo mês, a tabela do dashboard já mostra as assinaturas projetadas e as parcelas virtuais da fatura foco, mesmo sem lançamento manual.
- Marcando "Somente próximas faturas" (ligado por padrão), tudo que pertence a faturas anteriores à foco some — inclusive parcelas adiantadas e assinaturas antigas — restando apenas o que ainda está por vir.
- Desligando o toggle, o histórico volta a aparecer normalmente conforme o filtro de fatura escolhido.