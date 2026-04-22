import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Subscription {
  id: string;
  user_id: string;
  nome: string;
  valor: number;
  dia_cobranca: number;
  banco: string | null;
  cartao: string | null;
  classificacao: string | null;
  justificativa: string | null;
  paused: boolean;
  last_generated_month: string | null;
  created_at: string;
  updated_at: string;
}

export type SubscriptionInsert = Omit<Subscription, "id" | "created_at" | "updated_at">;

export function useSubscriptions() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions" as any)
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Subscription[];
    },
  });

  const addSubscription = useMutation({
    mutationFn: async (sub: Partial<SubscriptionInsert>) => {
      const { error } = await supabase.from("subscriptions" as any).insert(sub as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  const updateSubscription = useMutation({
    mutationFn: async ({ id, ...sub }: Partial<Subscription> & { id: string }) => {
      const { error } = await supabase
        .from("subscriptions" as any)
        .update(sub as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  const deleteSubscription = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscriptions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  const togglePause = useMutation({
    mutationFn: async ({ id, paused }: { id: string; paused: boolean }) => {
      const { error } = await supabase
        .from("subscriptions" as any)
        .update({ paused } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  return { ...query, addSubscription, updateSubscription, deleteSubscription, togglePause };
}
