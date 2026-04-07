

## Plano: Aplicativo de Controle de Gastos do Cartão de Crédito

### Visão Geral
Construir um sistema completo com tabela de gastos e dashboard com gráficos, usando Supabase para persistência. Sem autenticação inicialmente (dados públicos), podendo ser adicionada depois.

### Etapa 1 — Banco de Dados (Supabase Migration)
Criar tabela `expenses` com as colunas:
- `id` (uuid, PK)
- `banco` (text) — ex: NuBank, Itaú
- `cartao` (text) — ex: 9531, 6466, 2596
- `valor` (numeric)
- `data` (date)
- `parcela` (integer, default 0)
- `total_parcela` (integer, default 0)
- `despesa` (text) — descrição da transação
- `justificativa` (text) — nome simplificado
- `classificacao` (text) — ex: Estudos, Alimentação, Carro
- `fatura` (date) — mês de fechamento
- `created_at` (timestamptz)

RLS desabilitado inicialmente (sem auth). Inserir os ~49 registros da planilha.

### Etapa 2 — Estrutura do App e Navegação
- Layout com barra superior simples: abas **Planilha** e **Dashboard**
- Duas páginas: `/planilha` e `/dashboard`
- Rota `/` redireciona para `/planilha`

### Etapa 3 — Página Planilha
- Tabela com todas as colunas, com formatação de valores (R$) e datas
- Botão para adicionar novo gasto (modal/dialog com formulário)
- Edição inline ou via modal
- Exclusão com confirmação
- Ordenação por colunas

### Etapa 4 — Página Dashboard
Quatro gráficos usando Recharts (já disponível no projeto):

1. **Gráfico de Linhas** — Total gasto por fatura (mês), eixo X = mês da fatura, eixo Y = valor total
2. **Gráfico de Pizza** — Distribuição por Banco, com sublinha do Cartão e valores em porcentagem
3. **Top 10 por Classificação** — Barras horizontais com soma dos valores
4. **Top 10 por Justificativa** — Barras horizontais com soma dos valores

### Etapa 5 — Filtros Dinâmicos (Dashboard)
Quatro selects no topo do dashboard que filtram todos os gráficos simultaneamente:
- **Fatura** (mês)
- **Banco**
- **Cartão**
- **Classificação**

Cada filtro com opção "Todos". Filtros em cascata quando possível (cartões filtrados pelo banco selecionado).

### Detalhes Técnicos
- **DB**: 1 migration SQL para criar tabela + seed dos dados
- **Arquivos novos**: `src/pages/Planilha.tsx`, `src/pages/Dashboard.tsx`, `src/components/ExpenseForm.tsx`, `src/components/DashboardFilters.tsx`, `src/components/charts/` (4 componentes de gráfico)
- **Hooks**: `useExpenses` para CRUD via Supabase client
- **Libs existentes**: Recharts, shadcn/ui (Table, Dialog, Select, Button, Card)

