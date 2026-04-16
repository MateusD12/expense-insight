

## Plano: Importação de Fatura PDF do Itaú com Detecção de Duplicatas

### Resumo

Adicionar um botão "Importar Fatura" que aceita PDFs de faturas do Itaú. O sistema extrai as transações do PDF, cruza com as despesas já cadastradas para identificar possíveis duplicatas (especialmente parcelas), e apresenta uma tela de revisão antes de importar.

### Estrutura do PDF do Itaú (analisado)

- **Cabeçalho**: Cartão `4705.XXXX.XXXX.2596`, vencimento, valor total
- **Transações**: Tabelas com colunas DATA | ESTABELECIMENTO | VALOR EM R$
- **Parcelas**: Aparecem como "A PETITOSA RAC 01/04" (parcela 1 de 4) no nome do estabelecimento
- **Fatura**: Derivada do vencimento (ex: vencimento 06/04/2026 → fatura 2026-04)

### Fluxo do Usuário

```text
1. Clica "Importar Fatura" → abre file picker (.pdf)
2. Sistema parseia o PDF e extrai transações
3. Tela de revisão mostra cada transação com status:
   - ✅ "Nova" — será adicionada
   - ⚠️ "Possível duplicata" — encontrou despesa similar no banco
     → Opções: "É a mesma (pular)" | "Identificar outra" | "Adicionar mesmo assim"
   - 🔗 "Parcela detectada" — ex: "A PETITOSA RAC 02/04"
     → Mostra a parcela anterior já cadastrada
     → Opções: "Confirmar vinculação" | "Adicionar como nova"
4. Usuário confirma → sistema importa apenas as selecionadas
```

### Arquivos a criar/modificar

**1. `src/lib/parseItauPdf.ts`** (novo)
- Usa `pdfjs-dist` para extrair texto do PDF
- Parser regex para extrair: data, estabelecimento, valor, parcela (XX/YY)
- Extrai info do cartão (últimos 4 dígitos) e data de vencimento
- Calcula a fatura (mês do vencimento)
- Retorna array de transações parseadas

**2. `src/components/InvoiceImport.tsx`** (novo)
- Dialog de revisão com tabela de transações extraídas
- Para cada transação, compara com `allExpenses` por:
  - Nome similar (fuzzy match por substring do estabelecimento)
  - Valor igual
  - Mesmo cartão
  - Parcela correspondente (se "RAC 02/04", busca "RAC 01/04" já cadastrada)
- Status visual: nova, duplicata, parcela vinculada
- Botões de ação por linha
- Botão "Importar Selecionadas" no footer

**3. `src/pages/Index.tsx`** (modificar)
- Adicionar botão "Importar Fatura" ao lado de "Adicionar Despesa"
- Estado para controlar o dialog de importação
- Integração com `bulkAddExpenses` para salvar

### Lógica de Detecção de Duplicatas

```text
Para cada transação do PDF:
  1. Buscar no banco despesas com:
     - Mesmo valor (±0.01)
     - Mesmo cartão (últimos 4 dígitos)
     - Mesma fatura
     - Nome similar (contains/substring)
  2. Se encontrar → marcar como "possível duplicata"
  
Para parcelas (ex: "PETITOSA RAC 02/04"):
  1. Extrair nome base + número da parcela
  2. Buscar despesa existente com mesmo nome base
     e parcela anterior (01/04)
  3. Se encontrar → marcar como "parcela detectada"
     e pré-vincular
```

### Dependência

- Instalar `pdfjs-dist` para parsing de PDF no browser

### Detalhes Técnicos

- O parsing é 100% client-side (sem edge function)
- O PDF do Itaú tem padrão consistente: tabelas com "DATA | ESTABELECIMENTO | VALOR EM R$"
- Parcelas são identificadas pelo padrão `XX/YY` no nome do estabelecimento
- O cartão é extraído do cabeçalho (`4705.XXXX.XXXX.2596` → cartão "2596")
- A classificação é inferida da categoria que aparece abaixo do estabelecimento (ex: "supermercado", "restaurante", "lazer")

