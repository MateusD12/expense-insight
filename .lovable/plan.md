

## Problema

O parser do Itaú está pegando só 35 de ~60+ transações e somando R$ 332 em vez de R$ 3.326,53. Olhando o screenshot da fatura (R$ 3.326,53) vs revisão (R$ 1.220,66 selecionado, Total PDF R$ 332,00):

1. **Total PDF errado (R$ 332)**: o regex `Total\s+desta\s+fatura` provavelmente está casando com algum subtotal ou o valor está sendo cortado (talvez pegou só "332" de "3.326,53" por causa de espaço no meio do número no PDF).
2. **Faltam transações**: o parser depende do marcador "Lançamentos" para começar (`inLancamentos = true`). Faturas do Itaú têm várias seções/páginas separadas por cartão (titular + adicionais), cada uma com seu próprio cabeçalho — após a primeira seção terminar (`Total dos lançamentos`), `inLancamentos` vira `false` e nunca mais reabre, perdendo todas as outras seções.
3. **Reconstrução de linhas frágil**: agrupamento por Y arredondado pode quebrar linhas onde valor e descrição estão em Y ligeiramente diferentes, ou juntar duas linhas distintas. Também explica perda de transações.

## Plano de correção

**Arquivo: `src/lib/parseItauPdf.ts`**

1. **Reabrir seção em cada "Lançamentos"**: tornar `inLancamentos` reativo — toda vez que aparecer "lançamentos no cartão", "lançamentos nacionais", "lançamentos internacionais", "compras parceladas", reativar. Manter os finalizadores ("total dos lançamentos", "próximas faturas", etc.) que apenas pausam até a próxima seção.

2. **Modo permissivo (fallback)**: se após o parse só tiver poucas transações (<50% do esperado), refazer parse sem o gating de seção — qualquer linha que case `^DD/MM ... valor` vira transação, exceto se contiver palavras de pagamento ("pagamento efetuado", "estorno", "saldo anterior").

3. **Corrigir total da fatura**: 
   - Tornar regex tolerante a espaços dentro do número: `R\$?\s*([\d][\d.,\s]*\d,\d{2})` e depois normalizar removendo espaços.
   - Adicionar fallbacks: "O total da sua fatura é", "Total a pagar", "Valor total da fatura".
   - Se múltiplos valores encontrados, pegar o **maior** (evita pegar subtotal).

4. **Melhorar reconstrução de linhas**: aumentar tolerância de Y (agrupar Y dentro de ±2px) e ordenar items por X dentro da linha antes de juntar — evita perder textos com baseline ligeiramente deslocado.

5. **Logs de diagnóstico**: `console.log` com nº de páginas, nº de linhas extraídas, nº de transações por seção e total detectado — facilita debugar próximas faturas.

### Sem mudanças em UI

A tela de revisão já é genérica; só vai exibir mais linhas e o total correto.

