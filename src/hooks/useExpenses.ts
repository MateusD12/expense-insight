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
  fatura_original: string | null;
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
      const { error } = await supabase.from("expenses").insert(expense as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const bulkAddExpenses = useMutation({
    mutationFn: async (expenses: ExpenseInsert[]) => {
      const { error } = await supabase.from("expenses").insert(expenses as any[]);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, ...expense }: Partial<Expense> & { id: string }) => {
      const { error } = await supabase.from("expenses").update(expense as any).eq("id", id);
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
    mutationFn: async ({ id, currentFatura }: { id: string; currentFatura: string }) => {
      // "Fatura atual" no app é a próxima do mês corrente (ex: estamos em abril → fatura mai/26)
      const now = new Date();
      const target = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const currentMonthFatura = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-01`;
      const { error } = await supabase
        .from("expenses")
        .update({ fatura: currentMonthFatura, fatura_original: currentFatura } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const revertInstallment = useMutation({
    mutationFn: async ({ id, faturaOriginal }: { id: string; faturaOriginal: string }) => {
      const { error } = await supabase
        .from("expenses")
        .update({ fatura: faturaOriginal, fatura_original: null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  return { ...query, addExpense, bulkAddExpenses, updateExpense, deleteExpense, advanceInstallment, revertInstallment };
}
