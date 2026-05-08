## Problema

Hoje a aba **Futuras** mostra parcelas projetadas (virtuais) que só viram registro real quando você clica em "Adiantar". Isso causa dois problemas:

1. **Não dá pra editar** uma parcela "a cair" (mudar fatura/data) — você precisou cadastrar manualmente a Fiap e ela duplicou com a virtual.
2. Quando a fatura "vira" (chega no mês), a parcela continua como virtual em vez de cair na fatura atual automaticamente.

## Mudanças

### 1. Materialização automática de parcelas ao virar a fatura
Em `src/components/FutureExpenses.tsx`, ao montar a lista de virtuais a partir das despesas parceladas:
- Para cada parcela virtual cuja `fatura` seja **≤ fatura foco** (`getFaturaAtual(cutoffs)`), em vez de exibir como virtual, **inserir automaticamente no banco** como registro real (mesmo payload que o `handleAdvanceVirtual` atual já usa, mas mantendo `fatura` = a própria fatura virtual e `fatura_original = null`).
- Implementado via `useEffect` que detecta virtuais "vencidas" e chama `bulkAddExpenses` uma única vez por carga (com guard pra não disparar de novo).
- Aplica-se **somente a parcelas (total_parcela > 1)** — assinaturas continuam com a regra atual de geração no mês corrente.

### 2. Editar parcelas virtuais "a cair"
Adicionar botão **Editar** (ícone lápis) na coluna Ações da `FutureExpenses` para linhas virtuais de parcelas (não assinaturas):
- Ao clicar, abre o `ExpenseForm` pré-preenchido com os dados da parcela virtual.
- Ao salvar, **materializa** a parcela como registro real com os campos editados (data, fatura, valor, etc.) — usa `addExpense.mutate(...)`. Como a virtual deixa de aparecer (existe um real com mesma chave `despesa_parcela_total`), a duplicação some.
- Reaproveita o `existingKeys` Set que já filtra duplicatas.

### 3. Resolver duplicata existente da Fiap
Sem mudança de código: assim que a parcela manual ficar com a mesma combinação `despesa + parcela + total_parcela` da projeção, a virtual some automaticamente (lógica já existe). Se não somem hoje, é porque os campos divergem — você consegue corrigir editando a despesa manual pela aba Tabela pra bater com a despesa-fonte.

## Arquivos afetados

- `src/components/FutureExpenses.tsx` — auto-materialização + botão Editar + integração com `ExpenseForm`.
- Nenhuma mudança de schema, hooks ou backend.

## Não incluído

- Alterar regra de assinaturas (continuam recorrentes mensais).
- Mudar a aba Tabela.
