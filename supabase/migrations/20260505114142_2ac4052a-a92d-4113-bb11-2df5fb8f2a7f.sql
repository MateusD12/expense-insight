WITH bad AS (
  SELECT e.id, e.user_id, e.banco, e.cartao, e.data, e.fatura
  FROM public.expenses e
  JOIN public.invoice_cutoffs c
    ON c.user_id = e.user_id
   AND c.banco = e.banco
   AND c.cartao = e.cartao
   AND date_trunc('month', c.fatura) = date_trunc('month', e.fatura)
  WHERE COALESCE(e.total_parcela, 1) <= 1
    AND e.data > c.data_corte
),
nextc AS (
  SELECT b.id,
         (
           SELECT c2.fatura
           FROM public.invoice_cutoffs c2
           WHERE c2.user_id = b.user_id
             AND c2.banco = b.banco
             AND c2.cartao = b.cartao
             AND c2.data_corte >= b.data
           ORDER BY c2.data_corte ASC
           LIMIT 1
         ) AS new_fatura
  FROM bad b
)
UPDATE public.expenses e
SET fatura = n.new_fatura
FROM nextc n
WHERE e.id = n.id
  AND n.new_fatura IS NOT NULL
  AND n.new_fatura <> e.fatura;