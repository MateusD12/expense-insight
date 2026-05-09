# INSTRUÇÕES PARA O MODELO (LEIA PRIMEIRO E SEMPRE SIGA ESTAS REGRAS)

**ATENÇÃO:** Sempre que este projeto for aberto ou uma nova interação começar, siga estritamente a ordem abaixo:

1. **PRIMEIRA AÇÃO OBRIGATÓRIA:** Você DEVE ler este arquivo (`HISTORICO.md`) antes de fazer qualquer outra coisa. Ele é a principal fonte de contexto do projeto.
2. **ATUALIZAÇÃO CONTÍNUA:** Conforme você for desenvolvendo ou resolvendo problemas, vá documentando neste arquivo os passos tomados. Não espere até o final para fazer um grande resumo, vá salvando o progresso para não perder o raciocínio em caso de falha.
3. **SALVAMENTO CONSTANTE (GIT COMMIT):** Sempre que concluir uma alteração lógica ou completar uma funcionalidade/correção, você DEVE fazer o commit das suas alterações (`git add .` e `git commit -m "..."`). Deixe o código sempre salvo no versionamento.
4. **ÚLTIMA AÇÃO OBRIGATÓRIA:** Ao finalizar o pedido do usuário, verifique se o histórico foi atualizado com a conclusão da task. A sua última ação deve ser sempre garantir que este arquivo reflete as últimas mudanças do sistema e que elas estão commitadas.

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

## [Concluído] 08/05/2026 - Instalação de PWA
**Adições e Configurações:**
- **App Instalável (PWA):** O projeto foi atualizado para suportar a instalação como um PWA (Progressive Web App) e uso offline/acesso rápido.
- **Configuração do Vite:** O arquivo `vite.config.ts` foi configurado com opções avançadas do `vite-plugin-pwa` (habilitando `injectRegister: "auto"` e ícones).
- **Prompt de Download:** Modificado o componente `PWAPrompt` para aparecer no canto inferior direito da tela como solicitado ("canto inferior da tela"), informando o usuário sobre a possibilidade de instalar o aplicativo.
- **Ícone:** O manifest espera por um arquivo `icon.png` em `public/`. **Nota:** Não foi possível encontrar a "imagem em anexo" no meu diretório. Por favor, certifique-se de salvar sua imagem desejada na pasta `public/` com o nome exato `icon.png` (ou `icon.svg` desde que seja atualizado no `vite.config.ts`) para que seja usada como ícone do app.