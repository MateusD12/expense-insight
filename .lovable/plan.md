## Problema

A lógica de "A Cair" para despesas reais com data futura existe em `gastoBreakdown` e no filtro `statusFilter`, mas **a tabela não dá nenhum sinal visual** para essas linhas — elas aparecem idênticas a despesas já realizadas. Por isso o usuário "não vê" as futuras como a cair.

Além disso, vale revalidar a comparação de datas para garantir que `e.data` (vindo do Supabase como `date`) seja comparado em formato `YYYY-MM-DD` puro (sem timestamp), evitando falsos negativos.

## Mudanças (apenas em `src/pages/Index.tsx`)

1. **Centralizar o helper `isPending`** uma única vez no componente (hoje está duplicado em `filteredAndSorted` e em `gastoBreakdown`). Normalizar a comparação para os 10 primeiros caracteres da `data` (`e.data.slice(0, 10) > hojeISO`) para blindar contra qualquer string com timestamp.

2. **Marcar visualmente despesas reais futuras na tabela** (linhas ~1203–1275):
   - Calcular `isPendingReal = !isVirtual && isPending(e)`.
   - Aplicar o mesmo tom de fundo já usado para virtuais (`bg-slate-50/40`) quando `isPendingReal`.
   - Adicionar o ícone `Sparkles` ao lado do nome da despesa, igual ao que já é usado para virtuais.
   - Em vez de esconder os botões de editar/excluir (que continuam disponíveis para reais), exibir um badge discreto **"A CAIR"** ao lado do nome (ou na coluna de ações, antes dos botões) para deixar claro o status. Reaproveitar tipografia/cores existentes (ex.: `text-[9px] font-bold uppercase text-purple-500 italic`).

3. **(Opcional, mesma passada)**: garantir que `chartData` e demais agregações já consomem `filteredAndSorted`, então elas naturalmente respeitam o filtro "A Cair" — não há mudança extra necessária.

## Não muda

- Schema, hooks, formulário, resolver de fatura, assinaturas, parcelas.
- Cálculo dos cards (já está correto). Apenas reaproveitamos o mesmo `isPending`.

## Validação rápida

- Cadastrar despesa real com data futura → deve aparecer na tabela com fundo claro + ícone + badge "A CAIR", e somar em **A Cair** / **Previsto Fatura**, não em **Já Gasto**.
- Clicar no card **A Cair** → tabela e gráficos mostram virtuais + reais futuras.
- Clicar em **Já Gasto** → some todas as futuras (virtuais e reais).
