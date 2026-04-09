

## Plano: Redesign Visual — Dashboard e Tabela em Página Única

Baseado nas capturas de tela de referência, o layout atual (duas rotas separadas) será unificado em uma única página com abas, header colorido, cards de resumo e gráficos estilizados.

### Mudanças Principais

**1. Página única com abas (substituir rotas separadas)**
- Remover rotas `/planilha` e `/dashboard` — tudo fica em `/` em uma única página `Index.tsx`
- Usar `Tabs` do shadcn para alternar entre "Dashboard" e "Tabela"
- Remover `AppLayout.tsx` com navegação por rotas

**2. Header estilizado**
- Banner azul/gradiente com título "💳 Controle de Gastos" e subtítulo
- Botões "Novo Gasto" e "Importar Planilha" dentro do header

**3. Filtros globais (abaixo do header)**
- Barra de busca por texto (despesa)
- Selects: Banco, Cartão, Categoria, Fatura
- Filtros aplicam tanto na aba Dashboard quanto na Tabela

**4. Cards de resumo (4 cards coloridos)**
- **Total em Gastos** (azul) — soma dos valores filtrados
- **Transações** (verde) — contagem de registros
- **Bancos** (verde) — quantidade de bancos distintos
- **Categorias** (laranja) — quantidade de classificações distintas

**5. Aba Dashboard — gráficos redesenhados**
- **Gastos por Banco/Cartão**: Donut chart (rosca) com legenda "Banco ••cartão"
- **Evolução por Fatura**: Area chart com gradiente (roxo/lilás)
- **Top 10 por Categoria**: Lista ranqueada com barras coloridas horizontais e valores à direita (não Recharts BarChart — custom styled bars)
- **Top 10 por Justificativa**: Mesmo estilo de lista ranqueada

**6. Aba Tabela — tabela de gastos**
- Mesma tabela atual com todas as colunas
- Valores em verde (R$), classificação com badges coloridos
- Ações de editar/excluir mantidas

### Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/Index.tsx` | **Reescrever** — página principal com tabs, header, cards, filtros |
| `src/pages/Planilha.tsx` | **Remover** — conteúdo migrado para Index |
| `src/pages/Dashboard.tsx` | **Remover** — conteúdo migrado para Index |
| `src/components/AppLayout.tsx` | **Simplificar** — remover nav, manter shell mínimo |
| `src/components/DashboardFilters.tsx` | **Adaptar** — adicionar campo de busca |
| `src/components/SummaryCards.tsx` | **Criar** — 4 cards coloridos |
| `src/components/RankedList.tsx` | **Criar** — componente de lista ranqueada com barras coloridas |
| `src/App.tsx` | **Simplificar** — rota única `/` |

### Detalhes Técnicos

- Donut chart: Recharts `PieChart` com `innerRadius` para efeito rosca
- Area chart: Recharts `AreaChart` com `linearGradient` fill
- Top 10 lists: Componente custom HTML/CSS com barras de progresso coloridas (não Recharts)
- Cards de resumo: Grid 2x2 com cores de fundo via Tailwind (`bg-blue-500`, `bg-green-500`, `bg-orange-500`)
- Badges de classificação na tabela com cores mapeadas por categoria
- Cartão formatado como `••••XXXX` na legenda do donut

