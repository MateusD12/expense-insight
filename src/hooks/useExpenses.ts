import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Expense {
  id: string;
  banco: string;
  cartao: string;
  valor: number;
  data: string | null;
  parcela: number;
  total_parcela: number;
  despesa: string | null;
  justificativa: string | null;
  classificacao: string | null;
  fatura: string | null;
  created_at: string;
}

export type ExpenseInsert = Omit<Expense, "id" | "created_at">;

export function useExpenses() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("fatura", { ascending: false })
        .order("data", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });

  const addExpense = useMutation({
    mutationFn: async (expense: ExpenseInsert) => {
      const { error } = await supabase.from("expenses").insert(expense);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, ...expense }: Partial<Expense> & { id: string }) => {
      const { error } = await supabase.from("expenses").update(expense).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  return { ...query, addExpense, updateExpense, deleteExpense };
}
