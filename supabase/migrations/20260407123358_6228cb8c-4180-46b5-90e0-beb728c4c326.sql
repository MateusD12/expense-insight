
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  banco TEXT NOT NULL,
  cartao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  data DATE,
  parcela INTEGER NOT NULL DEFAULT 0,
  total_parcela INTEGER NOT NULL DEFAULT 0,
  despesa TEXT,
  justificativa TEXT,
  classificacao TEXT,
  fatura DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.expenses FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.expenses FOR DELETE USING (true);
