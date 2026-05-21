import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { InvoiceCutoff } from "@/lib/faturaResolver";
import type { TablesInsert } from "@/integrations/supabase/types";

export type InvoiceCutoffInsert = TablesInsert<"invoice_cutoffs">;

export function useInvoiceCutoffs() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["invoice_cutoffs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_cutoffs")
        .select("id, banco, cartao, fatura, data_corte, data_vencimento")
        .order("data_corte", { ascending: true });
      if (error) throw error;
      return (data || []) as InvoiceCutoff[];
    },
  });

  const upsertCutoff = useMutation({
    mutationFn: async (payload: InvoiceCutoffInsert) => {
      const { error } = await supabase
        .from("invoice_cutoffs")
        .upsert(payload, { onConflict: "user_id,banco,cartao,fatura" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice_cutoffs"] }),
  });

  const deleteCutoff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoice_cutoffs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice_cutoffs"] }),
  });

  return { ...query, upsertCutoff, deleteCutoff };
}
