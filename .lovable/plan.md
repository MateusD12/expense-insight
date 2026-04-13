

## Plano: Foco automático na fatura do mês seguinte

### O que muda

Hoje o dashboard mostra **todas** as despesas até a fatura atual. O pedido é: por padrão, mostrar apenas a fatura do **mês seguinte** (ex: em abril → fatura de maio), pois é onde caem os gastos do mês corrente. Os cards (Total, Teto, Transações, Maior Categoria) devem refletir apenas essa fatura.

### Lógica

- **Fatura foco**: `format(addMonths(new Date(), 1), "yyyy-MM")` → em abril/26 = `"2026-05"`
- O filtro de fatura inicia com esse valor ao invés de `"all"`
- O usuário ainda pode trocar para "Todas Faturas" ou outra fatura específica
- Adicionar um indicador visual no topo mostrando qual fatura está sendo exibida (ex: "Fatura de Mai/26")

### Mudanças em `src/pages/Index.tsx`

1. **Estado inicial do filtro de fatura**: Mudar `fatura: "all"` para `fatura: faturaFoco` (calculado como mês seguinte)
2. **Calcular `faturaFoco`** antes do estado, usando `useMemo` ou constante
3. **Indicador visual**: Adicionar badge/texto acima dos cards mostrando "Fatura de Mai/26" quando o filtro está no padrão
4. **`filteredAndSorted`**: A lógica de filtragem já respeita `filters.fatura`, então ao mudar o default o resto funciona automaticamente — os cards, gráficos e tabela já derivam de `filteredAndSorted`

### Detalhes técnicos

```text
Antes:
  filters.fatura = "all" → mostra tudo até fatura atual
  Cards mostram soma de TODAS as faturas visíveis

Depois:
  filters.fatura = "2026-05" (calculado) → mostra só essa fatura
  Cards mostram soma apenas da fatura de maio
  Usuário pode trocar para "all" ou outra fatura no dropdown
```

Nenhuma mudança no banco de dados é necessária.

