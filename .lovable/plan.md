Pelo que verifiquei, os lançamentos do dia 28/05 continuam aparecendo em Jun/26 porque eles já estão salvos no banco com `fatura = 2026-06-01`. A função corrigida (`resolveFatura`) só recalcula quando a despesa não tem fatura salva; hoje a fatura salva prevalece para preservar escolhas manuais/importações. Além disso, o auto-lançamento de assinaturas ainda grava “mês seguinte” diretamente, sem usar os cortes.

Plano de correção:

1. Ajustar a normalização da tabela
   - Para cada despesa, calcular a fatura resolvida pelos cortes quando houver `banco`, `cartao` e `data`.
   - Se a despesa salva estiver em uma fatura cujo corte é anterior à data da compra, substituir visualmente pela fatura correta.
   - Exemplo: Itaú 2596, compra em 28/05/2026, fatura salva Jun/26 com corte 27/05/2026 → mostrar como Jul/26.
   - Manter a fatura salva quando ela ainda for compatível com o corte, para não quebrar lançamentos manuais válidos.

2. Corrigir novos lançamentos de assinatura
   - No auto-lançamento de assinaturas (`Subscriptions.tsx`), trocar a regra fixa “mês atual + 1” por `resolveFatura(...)`.
   - Assim assinaturas cobradas após o corte já serão gravadas na fatura seguinte correta.

3. Corrigir parcelas criadas pelo formulário
   - Garantir que a primeira parcela respeite a fatura resolvida pelos cortes.
   - As parcelas seguintes continuarão avançando mês a mês a partir da fatura correta.

4. Opcional, mas recomendado: corrigir os dados já gravados
   - Atualizar os lançamentos reais que estão incompatíveis com o corte cadastrado, como os dois lançamentos de 28/05/2026 no Itaú 2596 que estão em Jun/26 mas deveriam ir para Jul/26.
   - Isso remove a inconsistência também do banco, não só da visualização.

Detalhe técnico:
- A regra aplicada será: uma despesa pertence à primeira fatura do cartão em que `data_compra <= data_corte`.
- Se a compra for depois do último corte cadastrado, projetamos a partir da última fatura conhecida.
- A exceção “fatura manual prevalece” continuará existindo apenas quando a fatura manual não contradizer o corte cadastrado.