

## Diagnóstico

O problema é que os dados foram importados via CSV, e cada despesa parcelada tem **apenas 1 registro** no banco (ex: "Mercadolivre parcela 5/6, fatura maio/26"). O sistema de "Futuras" espera encontrar registros separados para cada parcela futura, mas eles não existem.

Por exemplo, "Ec *mercadolivre" está como parcela 1/6 na fatura maio/26 — mas as parcelas 2/6 a 6/6 (jun, jul, ago, set, out) simplesmente não existem no banco.

## Solução: Gerar parcelas futuras virtualmente

Em vez de depender de registros existentes, o componente `FutureExpenses` vai **calcular** as parcelas restantes a partir dos dados que já existem. Para cada despesa onde `parcela < total_parcela`, o sistema gera entradas virtuais para os meses seguintes.

### Lógica

Para uma despesa com parcela 5/6 e fatura maio/26:
- Parcela 6/6 → fatura jun/26 (virtual, calculada)

Para "Ec *mercadolivre" com parcela 1/6 e fatura maio/26:
- Parcela 2/6 → jun/26
- Parcela 3/6 → jul/26
- Parcela 4/6 → ago/26
- Parcela 5/6 → set/26
- Parcela 6/6 → out/26

### Mudanças

**`src/components/FutureExpenses.tsx`**:
- Reescrever o `useMemo` de `futureExpenses` para:
  1. Filtrar despesas com `total_parcela > 1` e `parcela < total_parcela`
  2. Para cada uma, gerar N entradas virtuais (uma por mês restante) com parcela incrementada e fatura avançada
  3. Cada entrada virtual terá um `id` composto (ex: `${original.id}_p${i}`) para ser usada como key no React
  4. Manter suporte a registros reais com `fatura_original` (parcelas que já foram bulk-geradas pelo formulário novo)
- Desabilitar o botão "Adiantar" para parcelas virtuais (não existe registro no banco para fazer update) — ou criar o registro real no momento do adiantamento
- Adicionar indicação visual de "parcela projetada" vs "parcela real"

**Botão "Adiantar" para parcelas virtuais**:
- Ao clicar em "Adiantar" numa parcela virtual, o sistema cria um novo registro real no banco com a fatura do mês atual e `fatura_original` com a fatura projetada
- Isso permite que o adiantamento funcione tanto para dados importados quanto para dados gerados pelo formulário

**Regra de exclusão da tabela principal**: A tabela principal (`filteredAndSorted`) já filtra corretamente — mostra apenas parcelas com fatura ≤ atual e data ≤ hoje. As parcelas virtuais futuras nunca aparecerão lá.

### Fluxo visual esperado

```text
Dados no banco:
  Ec *mercadolivre | 1/6 | fatura mai/26

Aba "Futuras" mostra (calculado):
  ┌──────────────────────┬────────┬─────────┬──────────┬──────────┐
  │ Despesa              │ Valor  │ Parcela │ Fatura   │ Ações    │
  ├──────────────────────┼────────┼─────────┼──────────┼──────────┤
  │ Ec *mercadolivre     │ R$ XX  │  2/6    │ jun/26   │ Adiantar │
  │ Ec *mercadolivre     │ R$ XX  │  3/6    │ jul/26   │ Adiantar │
  │ Ec *mercadolivre     │ R$ XX  │  4/6    │ ago/26   │ Adiantar │
  │ Ec *mercadolivre     │ R$ XX  │  5/6    │ set/26   │ Adiantar │
  │ Ec *mercadolivre     │ R$ XX  │  6/6    │ out/26   │ Adiantar │
  └──────────────────────┴────────┴─────────┴──────────┴──────────┘
```

