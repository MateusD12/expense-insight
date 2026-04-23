import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { InvoiceCutoff } from "@/lib/faturaResolver";

export type InvoiceCutoffInsert = Omit<InvoiceCutoff, "id"> & { user_id: string };

export function useInvoiceCutoffs() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["invoice_cutoffs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_cutoffs" as any)
        .select("*")
        .order("data_corte", { ascending: true });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        id: r.id,
        banco: r.banco,
        cartao: r.cartao,
        fatura: r.fatura,
        data_corte: r.data_corte,
        data_vencimento: r.data_vencimento,
      })) as InvoiceCutoff[];
    },
  });

  const upsertCutoff = useMutation({
    mutationFn: async (payload: InvoiceCutoffInsert) => {
      const { error } = await supabase
        .from("invoice_cutoffs" as any)
        .upsert(payload as any, { onConflict: "user_id,banco,cartao,fatura" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice_cutoffs"] }),
  });

  const deleteCutoff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoice_cutoffs" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice_cutoffs"] }),
  });

  return { ...query, upsertCutoff, deleteCutoff };
}
