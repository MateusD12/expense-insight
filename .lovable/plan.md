Tornar os 3 cards (Já Gasto, A Cair, Previsto Fatura) clicáveis como filtros de status que afetam tabela e dashboard.

Mudanças em `src/pages/Index.tsx`:

1. Adicionar estado `statusFilter: "all" | "realizado" | "aCair"` (default `"all"`).
2. No `filteredAndSorted`, após o filtro de "somente próximas faturas", aplicar:
   - `realizado` → mantém apenas itens onde `!isVirtual` (já caíram).
   - `aCair` → mantém apenas itens com `isVirtual` (parcelas/assinaturas projetadas).
   - `all` → sem alteração.
3. Tornar os 3 cards `cursor-pointer` com `onClick`:
   - Já Gasto → toggle `realizado`.
   - A Cair → toggle `aCair`.
   - Previsto Fatura → reseta para `all` (mostra tudo).
4. Indicar visualmente o card ativo com `ring-2 ring-white/70 scale-[1.02]`; cards inativos ficam com `opacity-70` quando há filtro ativo.
5. Incluir `statusFilter` em `hasActiveFilters` e no botão "Limpar Filtros" (resetar para `all`).

Como `chartData` deriva de `filteredAndSorted`, o dashboard segue automaticamente.