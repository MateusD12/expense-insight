

## Plano: Card "Próxima Fatura" + Gráfico Evolução Mensal independente

### 1. Card "Próxima Fatura"

Adicionar um 5º card na grid de resumo (mudar para `grid-cols-2 lg:grid-cols-5`) que mostra o valor total da fatura seguinte à selecionada.

**Lógica:**
- Fatura selecionada = `filters.fatura` (ex: `"2026-05"`)
- Próxima fatura = `addMonths(faturaAtual, 1)` → `"2026-06"`
- Calcular o total somando despesas reais + virtuais que caem nessa fatura
- Se `filters.fatura === "all"`, usar `faturaFoco` como base e mostrar o mês seguinte
- Mostrar o valor e o nome do mês (ex: "Jun/26 — R$ 2.150,00")

### 2. Gráfico "Evolução Mensal" independente dos filtros

O gráfico deixará de usar `chartData.temporal` (que depende de `filteredAndSorted`) e passará a ter seu próprio `useMemo` com dados de **todas** as faturas (reais + virtuais), independente do filtro de fatura selecionado no dashboard.

**Filtro interno do gráfico:**
- Adicionar um seletor dentro do card do gráfico com opções:
  - "Últimos 3 meses"
  - "Últimos 6 meses"
  - "Último ano"
  - "Tudo"
  - Seleção personalizada de período (mês inicial → mês final)
- Estado próprio: `const [chartPeriod, setChartPeriod] = useState("6m")`
- O gráfico incluirá faturas futuras projetadas (parcelas virtuais), permitindo ver a evolução completa

### Mudanças em `src/pages/Index.tsx`

1. **Novo `useMemo` para dados do gráfico** (`chartTemporalData`): agregar `normalizedExpenses + virtualExpenses` por fatura, sem depender de `filteredAndSorted`. Filtrar pelo período selecionado no filtro interno.

2. **Novo estado** `chartPeriod` para controlar o filtro do gráfico.

3. **Card "Próxima Fatura"**: novo `useMemo` (`proximaFaturaTotal`) que calcula o total da fatura seguinte à selecionada, usando `normalizedExpenses + virtualExpenses`.

4. **Grid de cards**: mudar de `grid-cols-2 lg:grid-cols-4` para `grid-cols-2 lg:grid-cols-5` e adicionar o novo card com estilo visual distinto (ex: gradiente laranja/amber).

5. **UI do gráfico**: adicionar uma row com botões/select de período acima do `AreaChart`, dentro do card de Evolução Mensal.

