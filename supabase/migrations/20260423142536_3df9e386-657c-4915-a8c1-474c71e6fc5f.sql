CREATE TABLE public.invoice_cutoffs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  banco TEXT NOT NULL,
  cartao TEXT NOT NULL,
  fatura DATE NOT NULL,
  data_corte DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, banco, cartao, fatura)
);

ALTER TABLE public.invoice_cutoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cutoffs" ON public.invoice_cutoffs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cutoffs" ON public.invoice_cutoffs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cutoffs" ON public.invoice_cutoffs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cutoffs" ON public.invoice_cutoffs
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_invoice_cutoffs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_invoice_cutoffs_updated_at
BEFORE UPDATE ON public.invoice_cutoffs
FOR EACH ROW EXECUTE FUNCTION public.update_invoice_cutoffs_updated_at();

CREATE INDEX idx_invoice_cutoffs_user_card ON public.invoice_cutoffs(user_id, banco, cartao, data_corte);