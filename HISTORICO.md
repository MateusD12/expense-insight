# Histórico de Alterações - App Financeiro

Este arquivo mantém um registro das alterações e problemas resolvidos neste projeto, para dar contexto em futuras sessões de chat.

## [Concluído] 08/05/2026 - Correções de Faturas e Despesas
**Problemas Relatados:**
1. Despesas ainda estão como "a Cair" e não há como alterar a data nas faturas seguintes.
2. Adiantamento de faturas (ex: alura no valor de 54,40) pagas em fatura passada, mas ainda constam como despesa "a Cair".
3. Despesas sendo duplicadas por algum motivo.

**Soluções Aplicadas:**
- **Duplicação Resolvida:** Corrigido o gerador de faturas virtuais (`virtualExpenses`) que não estava rastreando as parcelas recém-geradas no ciclo. Adicionado `existingKeys.add(key)` para evitar a duplicação em cascata de parcelas baseadas em entradas reais.
- **Edição de Faturas Seguintes (Projeções/Virtuais):** O botão de editar (lápis) agora fica habilitado para as despesas virtuais ("A Cair"). Ao editar e salvar, o sistema materializa essa parcela no banco de dados como uma despesa real (utilizando `addExpense`), permitindo que a data ou fatura sejam modificadas de acordo com as necessidades (ex: adiantamentos). 
- **Pagamento Adiantado ("a Cair" resolvido):** Agora que é possível editar projeções virtuais de faturas adiantadas (como da Alura), o usuário pode editá-las e salvá-las na fatura correspondente. O sistema entenderá que ela agora é uma despesa real materializada e a removerá da fila de faturas "Virtuais/A Cair".