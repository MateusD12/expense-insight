## Objetivo

Quando o usuário cadastra uma despesa com `data` posterior a hoje, ela deve ser considerada **gasto futuro** (entrar em "A Cair", não em "Já Gasto"), mesmo sendo um lançamento real (não-virtual). Assim que a data chega/passa, o lançamento migra naturalmente para "Já Gasto".

## Mudanças (apenas em `src/pages/Index.tsx`)

1. **Helper `isPending(e)`**: retorna `true` quando o lançamento ainda não foi efetivamente realizado:
   - `e.isVirtual === true` (parcelas futuras + assinaturas projetadas — comportamento atual), **ou**
   - `e.data` existe e é posterior à data de hoje (`e.data > hojeISO`).

2. **`gastoBreakdown`**: substituir a checagem `if (e.isVirtual)` por `if (isPending(e))`. Resultado:
   - **Já Gasto** = soma das despesas reais com data ≤ hoje.
   - **A Cair** = soma de virtuais + reais com data futura.
   - **Previsto Fatura** = continua sendo `realizado + aCair` (sem alteração).

3. **Filtro dos cards (`statusFilter`)** dentro de `filteredAndSorted`:
   - `realizado` → `result.filter(e => !isPending(e))`
   - `aCair` → `result.filter(e => isPending(e))`

4. **Indicação visual na tabela (opcional, leve)**: linhas com data futura ganham o mesmo tratamento já usado para virtuais (mesma classe/badge "A cair") para deixar claro que ainda não caiu. Reaproveitar o estilo existente para `isVirtual`.

## Não muda

- Schema do banco, hooks, resolvers de fatura, formulário, assinaturas e parcelas.
- A despesa continua sendo um registro real no banco — a classificação "futura" é puramente derivada da data no front.

## Edge cases

- Data igual a hoje → considerada "Já Gasto".
- Mudança de dia: como `hojeISO` é avaliado a cada render, ao reabrir o app no dia da despesa ela passa automaticamente para "Já Gasto".
