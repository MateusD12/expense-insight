import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Subscription = Tables<"subscriptions">;
export type SubscriptionInsert = TablesInsert<"subscriptions">;
export type SubscriptionUpdate = TablesUpdate<"subscriptions"> & { id: string };

export function useSubscriptions() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addSubscription = useMutation({
    mutationFn: async (sub: SubscriptionInsert) => {
      const { error } = await supabase.from("subscriptions").insert(sub);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  const updateSubscription = useMutation({
    mutationFn: async ({ id, ...sub }: SubscriptionUpdate) => {
      const { error } = await supabase.from("subscriptions").update(sub).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  const deleteSubscription = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  const togglePause = useMutation({
    mutationFn: async ({ id, paused }: { id: string; paused: boolean }) => {
      const { error } = await supabase.from("subscriptions").update({ paused }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  return { ...query, addSubscription, updateSubscription, deleteSubscription, togglePause };
}
