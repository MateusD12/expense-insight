

## O que muda

Hoje cada despesa tem o campo `fatura` fixado na importação/criação. O usuário quer que a fatura seja **derivada dinamicamente** a partir da **data de corte** de cada mês. Ex.: corte 25/04 → tudo até 25/04 entra na fatura de maio; a partir de 26/04 entra na fatura de junho.

## 1) Nova tabela `invoice_cutoffs`

Armazena a data de corte e vencimento por cartão (banco + cartão) e por fatura.

Colunas:
- `id` (uuid)
- `user_id` (uuid)
- `banco` (text)
- `cartao` (text)
- `fatura` (date, ex: `2026-05-01`) — fatura de referência
- `data_corte` (date) — último dia que entra nessa fatura
- `data_vencimento` (date) — quando vence
- `created_at`, `updated_at`
- Único por (`user_id`, `banco`, `cartao`, `fatura`)

RLS por `user_id`.

## 2) Novo hook `useInvoiceCutoffs`

CRUD básico + função utilitária `resolveFatura(banco, cartao, dataCompra)` que:
- Pega todos os cortes do cartão ordenados por `data_corte`.
- Encontra o primeiro corte cuja `data_corte >= dataCompra` → retorna sua `fatura`.
- Se não houver corte definido para a data → fallback para o comportamento antigo (`addMonths(dataCompra, 1)` início do mês).

## 3) Nova aba "Faturas" (configuração)

Componente `InvoiceCutoffs.tsx`:
- Lista por cartão: para cada banco+cartão usado, mostra os cortes cadastrados.
- Botão "Definir corte" abre modal com: banco, cartão, fatura (mês), data de corte (date picker), data de vencimento.
- Quando corte de uma fatura está vencido, sugere botão "Definir corte da próxima fatura" pré-preenchendo o mês seguinte.

Adicionar tab "Faturas" em `Index.tsx` (ao lado de Assinaturas).

## 4) Reclassificação dinâmica de despesas

Em vez de filtrar pelo campo `fatura` salvo no banco, o app passa a calcular a **fatura efetiva** de cada despesa em runtime:

- `effectiveFatura(expense) = resolveFatura(expense.banco, expense.cartao, expense.data)`
- Se houver `fatura_original` (parcela adiantada manualmente) ou se a despesa é parcelada (parcela > 1), respeita o `fatura` salvo.
- Caso contrário, usa o resultado de `resolveFatura`.

Pontos afetados:
- `Index.tsx` → `normalizedExpenses` ganha `effectiveFatura`; filtros e agrupamentos passam a usá-lo.
- `FutureExpenses.tsx` → projeção de assinaturas usa `resolveFatura(sub.banco, sub.cartao, dataCobranca)` em vez do `addMonths(data, 1)` hardcoded.
- `SummaryCards`, gráficos e dropdown de fatura → usam `effectiveFatura`.
- Conceito de "fatura atual" deixa de ser `addMonths(now, 1)`: passa a ser **a fatura cuja `data_corte >= hoje`** (a primeira fatura aberta de cada cartão). Para o filtro padrão do dashboard, se houver múltiplos cartões, usa-se a fatura aberta mais próxima de fechar.

## 5) Importação de PDF

Quando um PDF traz uma fatura completa (ex: Itaú maio/26), o usuário pode marcar no diálogo de importação a `data_corte` e `data_vencimento` daquela fatura, o que cria/atualiza o registro em `invoice_cutoffs` automaticamente. As despisas continuam sendo salvas com o `fatura` resolvido (para parceladas) e os lançamentos à vista derivam dinamicamente.

## 6) Compatibilidade retroativa

- Despesas antigas continuam com seu `fatura` salvo intacto.
- A função `effectiveFatura` só sobrescreve quando existe corte cadastrado para o cartão cobrindo a data; sem corte → comportamento antigo preservado.
- Sem migração destrutiva nos dados existentes.

## Arquivos

- **Migração SQL**: criar tabela `invoice_cutoffs` + RLS.
- `src/hooks/useInvoiceCutoffs.ts` (novo) — CRUD + `resolveFatura`.
- `src/components/InvoiceCutoffs.tsx` (novo) — UI de configuração.
- `src/lib/faturaResolver.ts` (novo) — função pura `resolveFatura` + `getFaturaAtual`.
- `src/pages/Index.tsx` — adicionar tab "Faturas", aplicar `effectiveFatura` em filtros/dropdown.
- `src/components/FutureExpenses.tsx` — usar `resolveFatura` na projeção de assinaturas.

## Fora de escopo

- Reescrever despesas antigas no banco.
- Mudar parsers de PDF (apenas o diálogo de importação ganha campos opcionais de corte/vencimento).
- Notificações/alertas de vencimento (pode ser uma próxima iteração).

