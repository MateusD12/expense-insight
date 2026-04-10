

## Plano: Sistema de Parcelas Futuras com Geração Automática

### Resumo

Quando o usuário cadastrar uma despesa parcelada, o sistema vai gerar automaticamente os registros das parcelas futuras (cada uma com sua fatura correspondente). Uma nova aba "Despesas Futuras" permitirá visualizar, filtrar e gerenciar essas parcelas. O usuário poderá "adiantar" parcelas para a fatura atual ou reverter o adiantamento.

### Como vai funcionar

1. **Ao salvar uma despesa parcelada** (ex: 6 parcelas, data 11/10/2025), o sistema cria automaticamente 6 registros no banco — parcela 1/6 na fatura out/2025, parcela 2/6 na fatura nov/2025, etc.

2. **Nova aba "Futuras"** ao lado de "Dashboard" e "Tabela":
   - Mostra apenas parcelas com fatura posterior ao mês atual
   - Filtros: por fatura futura específica, por despesa (para ver até quando vai)
   - Cada linha mostra: despesa, valor, parcela X/Y, fatura destino

3. **Adiantar parcela**: checkbox ou botão em cada linha que move a parcela para a fatura do mês atual. O campo `fatura` é atualizado, e um novo campo `fatura_original` guarda a fatura programada.

4. **Reverter adiantamento**: se a parcela foi adiantada, aparece um botão para devolver à fatura original (restaura `fatura` com o valor de `fatura_original`).

### Mudanças técnicas

**Banco de dados (migration)**:
- Adicionar coluna `fatura_original` (date, nullable) na tabela `expenses` — guarda a fatura programada original quando uma parcela é adiantada

**`ExpenseForm.tsx`**:
- Ao salvar despesa com `total_parcela > 1`, criar N registros automaticamente, cada um com parcela incrementada e fatura avançada mês a mês

**`src/pages/Index.tsx`**:
- Adicionar nova aba "Futuras" no TabsList
- Componente da aba filtra despesas com fatura > mês atual
- Filtros por fatura futura e por nome de despesa
- Botão "Adiantar" que faz update da fatura para o mês atual e salva fatura_original
- Botão "Reverter" (visível quando fatura_original existe) que restaura a fatura original

**`src/hooks/useExpenses.ts`**:
- Adicionar mutation `bulkAddExpenses` para inserir múltiplas parcelas de uma vez
- Adicionar mutation `advanceInstallment` e `revertInstallment`

### Fluxo do usuário

```text
Novo Gasto (6 parcelas, data 11/10/2025)
  → Sistema cria 6 registros:
    Parcela 1/6 → fatura out/2025
    Parcela 2/6 → fatura nov/2025
    ...
    Parcela 6/6 → fatura mar/2026

Aba "Futuras":
  [Filtro: Fatura] [Filtro: Despesa]
  ┌─────────────┬────────┬─────────┬──────────┬──────────┐
  │ Despesa     │ Valor  │ Parcela │ Fatura   │ Ações    │
  ├─────────────┼────────┼─────────┼──────────┼──────────┤
  │ Netflix     │ R$ 50  │  3/6    │ dez/25   │ Adiantar │
  │ Netflix     │ R$ 50  │  4/6    │ jan/26   │ Adiantar │
  └─────────────┴────────┴─────────┴──────────┴──────────┘

Após adiantar:
  │ Netflix     │ R$ 50  │  3/6    │ nov/25 ★ │ Reverter │
```

