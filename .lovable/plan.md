## Ajuste proposto

O problema vem da reclassificação dinâmica: para despesas à vista, o dashboard recalcula a fatura pela data de corte e sobrescreve visualmente o mês salvo. Por isso, mesmo você alterando a despesa para junho, ela volta a aparecer em maio quando a regra de corte resolve 25/04 como fatura de maio.

## O que vou implementar

1. **Respeitar fatura manual em despesas à vista**
   - Quando o usuário escolher manualmente uma fatura diferente da fatura calculada pela data de corte, essa escolha será preservada.
   - Exemplo: compra em `25/04/2026`, corte resolve maio, mas usuário seleciona junho → o dashboard mantém junho.

2. **Salvar a referência automática para comparação**
   - Ao criar ou editar despesa à vista, o app calculará a fatura automática via `resolveFatura`.
   - Se a fatura escolhida for diferente da automática, o app marcará a despesa como ajuste manual usando o mecanismo já existente de `fatura_original`.
   - Se a fatura escolhida for igual à automática, não marca como ajuste manual.

3. **Manter parcelas com comportamento atual**
   - Compras parceladas continuarão respeitando a fatura salva, como já fazem hoje.
   - Isso evita quebrar a lógica de parcelas futuras e adiantamento.

4. **Melhorar o formulário de nova despesa**
   - O mês da fatura inicial passará a usar a fatura foco/dinâmica do dashboard, não apenas “mês atual + 1”.
   - A fatura poderá continuar sendo alterada manualmente pelo usuário.

5. **Evitar efeitos colaterais na aba Futuras**
   - Ajustar a lógica para que despesas à vista com fatura manual não sejam tratadas como “parcelas adiantadas”.
   - A aba Futuras continuará focada em parcelas e assinaturas.

## Arquivos envolvidos

- `src/pages/Index.tsx`
- `src/components/ExpenseForm.tsx`
- `src/lib/faturaResolver.ts` se for necessário centralizar a função de comparação
- `src/components/FutureExpenses.tsx` para evitar interpretar ajuste manual como adiantamento

## Resultado esperado

Depois do ajuste, uma despesa de `25/04/2026` poderá ficar na fatura de junho se você selecionar junho manualmente, e o sistema não voltará sozinho para maio. A regra de corte continuará valendo como padrão automático, mas a escolha manual terá prioridade.