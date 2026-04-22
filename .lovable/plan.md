

## Problemas

1. **Tabela mostra mais valores que Assinaturas**: o PDF do Itaú trouxe **2 cobranças** de algumas assinaturas no mesmo mês (ex: Totalpassao em 30/03 e 28/04, lovablelovable em 28/03 e 28/04). Não é bug — são cobranças reais que vieram na fatura mai/26. A página Assinaturas mostra só 1 entrada por nome (correto). A diferença é esperada, mas confunde.

2. **Próximas faturas não mostram assinaturas ativas**: hoje `FutureExpenses` só projeta parcelas de compras parceladas. Assinaturas não-pausadas precisam aparecer como linhas virtuais nos meses futuros.

## O que será feito

### 1) Projetar assinaturas em `FutureExpenses.tsx`

- Importar `useSubscriptions`.
- Para cada assinatura **não pausada**, gerar **N linhas virtuais** (ex: próximos 6 meses) com:
  - `despesa` = `subscription.nome`
  - `valor` = `subscription.valor`
  - `data` = `YYYY-MM-DD` usando `dia_cobranca`
  - `fatura` = mês seguinte ao `data` (regra do app: compra do mês X cai na fatura X+1)
  - `classificacao` = "Assinatura"
  - flag visual `isSubscription: true` (ícone Repeat roxo, badge "ASSINATURA")
- **Dedup**: se já existe despesa real com mesmo `nome` + mesmo mês de `data`, não gerar virtual daquele mês (evita duplicar com lançamento real já presente).
- Pular geração para o **mês corrente** se `last_generated_month` já marcou (a auto-geração de `Subscriptions.tsx` cuida disso).
- Assinaturas pausadas → não aparecem.

### 2) Linha virtual de assinatura — ações

- Sem botão "Adiantar" (não faz sentido para assinatura recorrente).
- Mostrar badge "ASSINATURA" no lugar de Parcela.
- Tooltip/legenda: "Projeção da assinatura ativa".

### 3) Esclarecer duplicação na tabela (sem mexer em dado)

- Adicionar pequena nota informativa no topo da página **Assinaturas**:
  > "Algumas faturas trazem mais de uma cobrança da mesma assinatura no mês (ex: cobrança retroativa). A tabela do Dashboard mostra todos os lançamentos reais; aqui você vê apenas o cadastro recorrente."
- Sem alterar dedup nem deletar lançamentos.

### 4) Validação visual rápida

- Confirmar nos logs que assinaturas projetadas aparecem em jun/26, jul/26… na aba **Futuras**.
- Confirmar que assinatura **pausada** (lovablelovable.devus na imagem) **não aparece** nas próximas.

## Arquivos

- `src/components/FutureExpenses.tsx` — adicionar projeção de assinaturas + flag visual.
- `src/components/Subscriptions.tsx` — adicionar nota informativa no topo.

## Fora de escopo

- Alterar parser do PDF.
- Apagar/agrupar cobranças duplicadas reais.
- Mudança de schema.

