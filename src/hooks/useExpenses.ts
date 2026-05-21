import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Expense = Tables<"expenses">;
export type ExpenseInsert = TablesInsert<"expenses">;
export type ExpenseUpdate = TablesUpdate<"expenses"> & { id: string };

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
      return data;
    },
  });

  const addExpense = useMutation({
    mutationFn: async (expense: ExpenseInsert) => {
      const { error } = await supabase.from("expenses").insert(expense);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const bulkAddExpenses = useMutation({
    mutationFn: async (expenses: ExpenseInsert[]) => {
      const { error } = await supabase.from("expenses").insert(expenses);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, ...expense }: ExpenseUpdate) => {
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

  const advanceInstallment = useMutation({
    mutationFn: async ({ id, currentFatura, targetFatura }: { id: string; currentFatura: string; targetFatura: string }) => {
      const { error } = await supabase
        .from("expenses")
        .update({ fatura: targetFatura, fatura_original: currentFatura })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const revertInstallment = useMutation({
    mutationFn: async ({ id, faturaOriginal }: { id: string; faturaOriginal: string }) => {
      const { error } = await supabase
        .from("expenses")
        .update({ fatura: faturaOriginal, fatura_original: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  return { ...query, addExpense, bulkAddExpenses, updateExpense, deleteExpense, advanceInstallment, revertInstallment };
}
