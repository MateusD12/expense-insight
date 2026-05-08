## Mudança

Adicionar o filtro **Cartões** na barra de filtros expandida em `src/pages/Index.tsx` (linhas ~760–823). Hoje existe o estado `filters.cartao` e ele já é considerado na lógica de filtragem, mas não há UI — só Faturas, Bancos e Categorias aparecem.

### Passos

1. Trocar o grid de `md:grid-cols-4` para `md:grid-cols-5` para acomodar o novo seletor + botão Limpar.
2. Inserir um `<Select>` "Cartões" logo após o de Bancos:
   - `value={filters.cartao}`, `onValueChange={(v) => setFilters((f) => ({ ...f, cartao: v }))}`.
   - Opções: `"Todos Cartões"` + lista única de `cartao` das despesas. Se `filters.banco !== "all"`, restringir a opções aos cartões daquele banco (mesma regra de `DashboardFilters.tsx`).
3. Ao mudar `filters.banco`, resetar `cartao` para `"all"` (evitar combinação inválida) — atualizar o `onValueChange` do Select de Bancos.
4. Incluir `filters.cartao !== "all"` no cálculo de `hasActiveFilters` (linha ~615).
5. Manter o botão "Limpar" como está (já reseta `cartao: "all"`).

Sem mudanças em hooks, schema ou lógica de agregação.
