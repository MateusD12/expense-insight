

## Problema

Total PDF R$ 3.460,91 (real: R$ 3.326,53) e soma selecionada R$ 6.864,61 = ~2x. Há **duplicação de transações** e **detecção do total errada**.

## Causas

1. **Fallback permissivo duplica**: o modo permissivo roda em cima do mesmo texto e re-captura as transações já encontradas no modo seção. O dedup por `data|estabelecimento|valor` falha porque a mesma transação aparece com pequenas variações de espaçamento/ordem após reconstrução por Y. Resultado: ~2x o valor real.

2. **Total da fatura pega valor errado**: o regex pega o **maior** valor entre candidatos. Em faturas Itaú, "Total dos lançamentos atuais" (apenas compras do mês) ou "Saldo total" (com saldo anterior somado) podem ser maiores que "Total desta fatura". 

3. **Linha quebrada gera transação fantasma**: a tolerância Y de ±2px pode estar juntando linhas adjacentes em alguns casos e separando em outros, criando variações da mesma transação.

## Plano de correção

**Arquivo único: `src/lib/parseItauPdf.ts`**

1. **Não rodar fallback se modo seção já capturou bem**: trocar o critério. Em vez de "ratio < 0.5 → fallback", usar:
   - Modo seção é o **padrão**. 
   - Fallback só ativa se modo seção retornar **0 transações** (parsing realmente quebrou).
   - Nunca **mesclar** os dois — escolher um.

2. **Dedup mais robusto (em ambos os modos, defensivo)**: normalizar chave removendo todos os não-alfanuméricos do estabelecimento + lowercase: `data|estabNormalizado|valor.toFixed(2)`. Garante que "PETZ RA DIAL LESTE" e "PETZRADIALLESTE" colapsem.

3. **Total da fatura — priorizar o rótulo correto**:
   - Buscar **especificamente** "O total da sua fatura é" seguido de `R$ X` (esse é o rótulo canônico do Itaú, visível no screenshot do usuário).
   - Se não encontrar, cair para "Total desta fatura".
   - **Remover** o `Math.max` — pegar o **primeiro match** do regex mais específico. Ordem de prioridade:
     1. `O total da sua fatura é\s*R\$\s*VALOR`
     2. `Total desta fatura\s*R\$?\s*VALOR`  
     3. `Com vencimento em.*?R\$\s*VALOR` (próximo ao vencimento)
   - Para cada um, parar no primeiro match válido.

4. **Logs já existentes ajudam** — manter os `console.log` para confirmar.

### Resultado esperado

- Total PDF: R$ 3.326,53 (bate com a fatura)
- Sem duplicatas → soma das transações ≈ R$ 3.326,53
- Número de transações ≈ 60+

