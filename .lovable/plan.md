

## Problema identificado

O parser do Itaú já percorre `pdf.numPages`, então ele não está ignorando a segunda página por falta de loop. O problema mais provável é outro: ele junta o texto de todas as páginas em `fullText` e depois aplica um `hardStopped = true` global quando encontra `"próximas faturas"` ou `"parcelas a vencer"`. Se esse bloco aparece no fim da página 1, o parser para de considerar tudo que vem depois — inclusive as transações reais da página 2.

Isso bate com o sintoma atual: importar só ~35 despesas, como se estivesse lendo só a primeira página.

## O que será corrigido

### 1) Ajustar o parser para tratar cada página separadamente
Arquivo: `src/lib/parseItauPdf.ts`

- Parar de depender de um único `fullText.split("\n")` para parsear transações.
- Processar as linhas por página, preservando:
  - `pageNumber`
  - `lines[]` daquela página
- Aplicar abertura/fechamento de seção por página, sem deixar um `hardStopped` de uma página bloquear as próximas.

### 2) Trocar o “hard stop global” por fechamento local de bloco
Hoje:
- `"próximas faturas"` / `"parcelas a vencer"` desligam o parser para sempre.

Novo comportamento:
- essas labels fecham a captura da seção atual naquela região;
- na página seguinte, se aparecer novo cabeçalho válido (`"lançamentos"`, `"compras nacionais"`, etc.), a captura pode reabrir normalmente.

Isso evita perder a continuação da fatura em PDFs com 2 páginas.

### 3) Melhorar a lógica de reabertura entre páginas
- Ao finalizar cada página, o parser não deve assumir que a leitura acabou.
- Na página seguinte:
  - se houver seção de lançamentos, reabre;
  - se houver transações válidas logo no começo com o mesmo padrão `DD/MM ... valor`, também pode entrar em modo de captura defensivo.

Isso cobre layouts em que a segunda página continua a tabela sem repetir exatamente o mesmo cabeçalho.

### 4) Manter a exclusão de “próximas faturas” sem cortar despesas válidas
- Continuar ignorando parcelas futuras e blocos de resumo.
- Mas fazer isso com escopo local de bloco/página, não como trava permanente do documento inteiro.

### 5) Adicionar diagnóstico mais claro no console
Arquivo: `src/lib/parseItauPdf.ts`

Adicionar logs como:
- páginas detectadas
- quantidade de linhas por página
- quantas transações foram extraídas por página
- em qual página a seção abriu/fechou
- quantas transações finais vieram do documento

Exemplo de objetivo:
```text
[parseItauPdf] página 1: 35 transações
[parseItauPdf] página 2: 28 transações
[parseItauPdf] total final: 63 transações
```

Isso facilita validar rapidamente se a segunda página voltou a ser lida.

## Ajuste pequeno na tela de revisão
Arquivo: `src/components/InvoiceImport.tsx`

Sem mudar a estrutura principal, vou alinhar a UI ao novo volume importado:
- manter a separação entre pendentes e classificadas;
- manter busca e filtros por valor/status;
- garantir que o contador inferior reflita corretamente o total vindo do parser corrigido.

## Resultado esperado

Depois da correção:
- a importação deve trazer as duas páginas da fatura;
- o total de despesas deve subir de ~35 para algo próximo de 60+;
- a soma selecionada deve ficar coerente com a fatura real;
- “próximas faturas” continuará fora da importação, sem matar a leitura da página seguinte.

## Detalhes técnicos

Arquivos envolvidos:
- `src/lib/parseItauPdf.ts`
- possível ajuste leve em `src/components/InvoiceImport.tsx`

Mudança principal no parser:
```text
ANTES
PDF inteiro -> fullText -> split("\n") -> hard stop global

DEPOIS
Página 1 -> linhas -> parse local
Página 2 -> linhas -> parse local
...
Combina transações de todas as páginas -> dedup final
```

Critérios preservados:
- deduplicação normalizada por data + estabelecimento + valor
- total da fatura via regex priorizado
- regex estrita para transações com valor no fim da linha

Fora de escopo:
- OCR/Vision API
- mudanças no schema
- mudanças no parser Nubank

