
## Diagnóstico

Verifiquei os cortes cadastrados e as despesas reais no banco.

**Cortes do Itaú •••• 2596:**
- Fatura mai/26 → corte 25/04/2026 (já passou)
- Fatura jun/26 → corte **27/05/2026**

**Despesas de 25–30/05 desse cartão no banco:** todas estão com `fatura = 2026-06-01` (jun/26). Ou seja, no banco já estão corretas.

O problema, então, **não é a gravação** — é a **resolução/exibição** no dashboard. Encontrei três falhas reais que combinadas explicam o sintoma:

### Falha 1 — `resolveFatura` está com a regra invertida para o cenário "compra exatamente no dia do corte ou depois"

Em `src/lib/faturaResolver.ts`:

```ts
const match = cardCutoffs.find((c) => c.data_corte >= dataCompra);
```

Isso significa "primeiro corte cuja data é maior ou igual à data da compra ganha". Resultado:
- Compra **27/05** (dia do corte) → casa com o corte de 27/05 e cai em jun/26. ✔ por acaso, mas a interpretação correta de "fechamento dia 27" varia (alguns bancos consideram o dia 27 como o último da fatura corrente, outros como o primeiro da próxima).
- Compra **26/05** → casa com o corte de 27/05 (que é da fatura jun/26) e cai em **jun/26**. ❌ Deveria ser **mai/26** (a fatura que ainda não fechou).

A semântica correta é: "a compra entra na **primeira fatura cujo corte ainda não passou na data da compra**". Ou seja: `data_corte >= dataCompra` está certo *se* a regra do cartão for "tudo até a véspera do corte cai nessa fatura"; mas a forma como o usuário cadastrou os cortes é "fatura mai/26 fecha em 25/04", o que significa "compras **até 25/04** vão pra mai/26, compras **a partir de 26/04** vão pra jun/26". Para 25/04, o match com 25/04 (mai/26) é o correto. Para 26/04 em diante, como não há corte intermediário, deveria pegar o próximo (jun/26 com corte 27/05). E é o que acontece. 

**O bug real aqui é outro:** quando há um corte futuro como 27/05 (jun/26), uma compra em 26/05 está caindo em jun/26 (porque 27/05 ≥ 26/05), mas ela deveria estar em mai/26 — só que **não há corte cadastrado para mai/26 no futuro** (o de 25/04 já passou). Como o resolver não distingue cortes "passados" de "abertos", ele usa o de 27/05 indevidamente.

### Falha 2 — `getFaturaAtual` mistura cartões diferentes

```ts
const open = cutoffs.filter((c) => c.data_corte >= today)
  .sort((a, b) => a.data_corte.localeCompare(b.data_corte));
if (open.length > 0) return open[0].fatura;
```

Isso pega o **primeiro corte aberto entre todos os cartões**. Se o Itaú 2596 tem corte 27/05 (jun/26) e os outros cartões (Itaú 6466, Nubank 9531) só têm cortes que já passaram, o "fatura foco" global vira **jun/26** — e tudo de maio dos outros cartões some do dashboard padrão (porque o switch "Somente próximas faturas" está ligado e corta tudo `< jun/26`).

### Falha 3 — vencimento do Itaú 2596 jun/26 está com data inconsistente

`data_vencimento: 2026-04-03` para a fatura de jun/26 — provavelmente erro de digitação (deveria ser 06/06 ou similar). Não causa o bug do dashboard, mas vou alertar na UI.

## O que será implementado

### 1. Corrigir `getFaturaAtual` em `src/lib/faturaResolver.ts`

Usar a fatura mais antiga ainda aberta considerando **todos os cortes**, mas escolhendo a `fatura` mínima entre os abertos (não o corte mais próximo). Assim, se houver cartões com fatura mai/26 ainda em aberto (sem corte futuro cadastrado, mas a fatura mai/26 ainda não venceu), `faturaFoco` continua mai/26 até o último vencimento daquele mês passar.

```ts
export function getFaturaAtual(cutoffs: InvoiceCutoff[]): string {
  const today = format(new Date(), "yyyy-MM-dd");
  // Faturas com vencimento futuro = ainda em aberto
  const open = cutoffs
    .filter((c) => c.data_vencimento >= today)
    .sort((a, b) => a.fatura.localeCompare(b.fatura));
  if (open.length > 0) return open[0].fatura;
  // fallback mês+1
}
```

A mudança chave: usa **`data_vencimento`** em vez de `data_corte` para decidir se a fatura ainda está "aberta para visualização", e ordena por `fatura` (mês de referência), não pela data do corte.

### 2. Corrigir `resolveFatura` em `src/lib/faturaResolver.ts`

Usar apenas cortes do **mesmo cartão** que ainda não passaram, escolhendo o **menor `data_corte` que seja `>= dataCompra`**. Se nenhum corte futuro existir para essa fatura, usar fallback baseado na data de vencimento esperada do cartão (ou mês+1 atual).

A regra de "compras até o dia do corte vão para essa fatura, depois disso vão para a próxima" será explicitada:

```ts
// Compras com data <= data_corte ⇒ entram nessa fatura
// Compras com data > data_corte ⇒ próxima fatura
const sorted = cardCutoffs.sort((a, b) => a.data_corte.localeCompare(b.data_corte));
const match = sorted.find((c) => dataCompra <= c.data_corte);
if (match) return match.fatura;
// Sem corte cadastrado posterior à compra → fallback mês+1
```

Isso garante que compra **26/05** + corte **27/05 (jun/26)** caia em **jun/26** corretamente (porque 26/05 ≤ 27/05), e compra **28/05** caia em jul/26 ou no fallback.

Espera — relendo o relato do usuário: "fatura fecha 27/05, então tudo depois dessa data é para cair na fatura seguinte". Ou seja, **27/05 é o último dia da fatura jun/26**. Compra do dia 28/05 deveria ir pra **jul/26**. Hoje está caindo em jun/26 porque o resolver casa com `data_corte (27/05) >= dataCompra (28/05)` → falso, então cai no fallback que é **mês da compra +1 = jun/26** ❌.

A correção acima (`dataCompra <= c.data_corte` ⇒ entra; senão próxima) faz a compra de 28/05 não casar com nenhum corte → cai no fallback. O fallback precisa ser inteligente: se a última fatura cadastrada é jun/26 com corte 27/05, então 28/05 → **jul/26**.

```ts
// Fallback inteligente: se a compra é depois do último corte conhecido,
// avançar tantos meses quanto necessário a partir da última fatura.
const last = sorted[sorted.length - 1];
if (last && dataCompra > last.data_corte) {
  // Quantos meses entre o último corte e a compra
  const monthsAhead = monthsBetween(last.data_corte, dataCompra) + 1;
  return addMonthsToFatura(last.fatura, monthsAhead);
}
// Caso geral sem cortes
return mesDaCompra+1;
```

### 3. Filtro "Somente próximas faturas" (Index.tsx) usar `>=` correto

O switch em `src/pages/Index.tsx` já filtra `e.fatura.slice(0,7) >= faturaFoco`. Com a correção #1, `faturaFoco` ficará "mai/26" enquanto qualquer fatura de maio estiver com vencimento futuro. Quando o último vencimento de maio passar, vira "jun/26" automaticamente — comportamento desejado pelo usuário.

### 4. Pequeno aviso na UI de cortes

Em `src/components/InvoiceCutoffs.tsx`, sinalizar com badge vermelho quando `data_vencimento < data_corte` (caso do Itaú 2596 jun/26: corte 27/05, vencimento 03/04 — claramente errado). Apenas aviso visual, não bloqueia.

## Detalhes técnicos

- **Arquivos alterados:**
  - `src/lib/faturaResolver.ts`: reescrever `resolveFatura` (regra `<=` + fallback inteligente) e `getFaturaAtual` (usar `data_vencimento` e mínima `fatura`).
  - `src/components/InvoiceCutoffs.tsx`: badge de alerta quando vencimento < corte.
- Sem mudança de schema. Sem migrations.
- `effectiveFatura` continua respeitando o `expense.fatura` salvo (regra do usuário de "manual prevalece").
- Cobertura: o fluxo de `ExpenseForm.tsx` (auto-sugestão via `resolveFatura`) herda a correção automaticamente.

## Resultado esperado

- Compra do dia **28, 29 ou 30/05** com corte da fatura jun/26 em **27/05** → cai automaticamente em **jul/26** (fatura seguinte).
- Compra do dia **25, 26 ou 27/05** → continua em **jun/26**.
- Dashboard com "Somente próximas faturas" ligado mostra **mai/26** enquanto houver faturas de maio com vencimento futuro; depois muda para **jun/26**.
- Aviso visual no card do Itaú 2596 indicando que o vencimento de jun/26 (03/04) está antes do corte (27/05) — provável erro de cadastro.
