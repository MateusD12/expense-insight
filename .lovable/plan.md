Vou dividir o card "Total Gastos" em três novos, mantendo Teto, Transações, Maior Categoria e Próx. Fatura.

Cards novos (sempre baseados na fatura atualmente filtrada):

1. Já Gasto — soma apenas das despesas reais (registros já existentes no banco). Quando a parcela/assinatura "cai" e vira lançamento real, ela passa a contar aqui automaticamente.
2. A Cair — soma apenas dos itens virtuais (parcelas futuras projetadas + assinaturas previstas) ainda não materializados.
3. Previsto Fatura — soma dos dois acima (estimativa total da fatura até o fechamento).

Detalhes:
- O card Teto passa a comparar com o Previsto (não com o Já Gasto), para alertar antes do estouro.
- Grid passa de 5 para 7 colunas em telas grandes (`xl:grid-cols-7`), 3 colunas em md, 2 em mobile, mantendo a estética atual com gradientes distintos para cada métrica.
- A lógica reaproveita `filteredAndSorted` (que já respeita filtro de fatura, "somente próximas faturas" e demais filtros) e diferencia real vs virtual via flag `isVirtual` já existente em `virtualExpenses` e `subscriptionVirtuals`.

Arquivo afetado: `src/pages/Index.tsx` (novo `useMemo` `gastoBreakdown` + substituição do bloco de cards de resumo).