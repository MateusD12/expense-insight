

## Problemas identificados

1. **Só 35 despesas importadas** (Total PDF R$ 3.326,53 ✅ correto, mas soma selecionada R$ 6.864,61 e só 35 linhas) — o parser está perdendo transações OU duplicando algumas com valores inflados. O badge "A importar: 35" + soma 2x o total indica que essas 35 contêm duplicatas com valor dobrado, e dezenas de outras transações reais estão faltando.

2. **Falta UX para revisar fatura grande**: sem busca, sem filtros, sem separação visual entre "já classifiquei" e "ainda preciso classificar".

## Plano

### Parte 1 — Corrigir parser (`src/lib/parseItauPdf.ts`)

A reconstrução por Y (`TOL=2`) ainda está fragmentando linhas — uma transação vira 2 (sem valor + só valor) ou 2 viram 1 (mistura descrição+valor de outra). Ações:

1. **Aumentar tolerância Y para ±3.5px** e **mesclar grupos consecutivos** quando o último não tem valor monetário no fim e o próximo começa com valor — junta uma transação quebrada.
2. **Validar transação por âncora de valor**: regex deve exigir `,\d{2}` no fim absoluto da linha; descartar linhas que tenham 2+ valores monetários (provavelmente é cabeçalho/total).
3. **Detectar e remover seção "Próximas faturas"** (parcelas futuras) explicitamente — ela soma R$ 3.326+ adicional e explica o ~2x. Adicionar `"próximas faturas"`, `"parcelas a vencer"`, `"compras parceladas a vencer"` em SECTION_CLOSERS sem reabrir.
4. **Logar cada transação descartada** no console (linha + motivo) para diagnóstico futuro.

### Parte 2 — UX da revisão (`src/components/InvoiceImport.tsx`)

1. **Barra de filtros** acima da tabela:
   - Input de busca (filtra por despesa, classificação, justificativa).
   - Filtro de valor min/max (2 inputs numéricos).
   - Filtro de status (Todas / Novas / Duplicatas / Parcelas).
   - Toggle "Esconder classificadas" (some com itens já com classificação E justificativa preenchidas).

2. **Separação visual em 2 seções**:
   - **"Pendentes de classificação"** no topo — itens cuja `classificacao` está vazia ou é o default `"Outros"` herdado do parser **e** o usuário ainda não tocou. (Marcar item como "tocado" quando user altera qualquer campo.)
   - **"Já classificadas"** embaixo — itens que o usuário ajustou. Cabeçalho colapsável com contador.
   - Implementação simples: dois `<TableBody>` (ou um só com linhas separadoras) ordenados, mantendo o mesmo estado `items[]`.

3. **Ordenação clicável** nas colunas Data, Despesa, Valor (ícone seta no header).

4. **Contador no rodapé**: "X pendentes · Y classificadas · Z duplicatas".

### Escopo fora
- Não mexer em hooks/schema/Index.tsx.
- Manter ComboCell como está.

