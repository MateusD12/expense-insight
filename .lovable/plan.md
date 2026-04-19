

## Problema

Na tela de revisão da fatura, os campos **Classificação** e **Justificativa** são `<Input>` de texto livre. O usuário quer comboboxes (dropdown + opção de digitar nova) que reaproveitem os valores já existentes no banco — igual ao `ExpenseForm`.

## Investigação necessária

Antes de implementar, preciso confirmar:
1. Como o `ExpenseForm.tsx` implementa os dropdowns de classificação/justificativa (provavelmente Combobox com `Command` + `Popover`).
2. Como `useExpenses` expõe as listas distintas de classificações e justificativas existentes.

## Plano

**Arquivo único: `src/components/InvoiceImport.tsx`**

1. **Receber as listas de opções**: adicionar duas props na interface — `classificacoesExistentes: string[]` e `justificativasExistentes: string[]`. Ou derivar de `allExpenses` dentro do próprio componente com `useMemo` (uniq + sort). Vou pelo segundo caminho (menos mudança de API).

2. **Substituir os 2 `<Input>` por Combobox reutilizável**:
   - Criar um pequeno componente interno `ComboboxField` baseado em `Popover` + `Command` (já existem em `components/ui`).
   - Comportamento: mostra valor atual; ao abrir lista as opções existentes filtradas pelo texto; se o texto digitado não bate com nenhuma, mostra "+ Criar '<texto>'" como item selecionável.
   - Onchange devolve string (existente ou nova).
   - Mantém tamanho compacto (`h-8 text-xs`) para caber na tabela.

3. **Cascata Justificativa por Classificação (opcional, mas o `ExpenseForm` provavelmente faz isso)**: vou verificar `ExpenseForm.tsx` antes para replicar o mesmo padrão de filtragem (ex: justificativas filtradas pela classificação selecionada). Se for o caso, aplico o mesmo aqui.

4. **Sem mudanças em `Index.tsx`** — `allExpenses` já é passado.

### Escopo fora

Sem mexer em parsers, sem mexer em hooks, sem mexer no schema.

