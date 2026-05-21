import { useMemo } from "react";
import { addMonths, format } from "date-fns";
import type { Expense } from "./useExpenses";
import type { Subscription } from "./useSubscriptions";
import { resolveFatura, type InvoiceCutoff } from "@/lib/faturaResolver";

export const VIRTUAL_PROJECTION_MONTHS = 12;

export type VirtualInstallment = Omit<Expense, "id"> & {
  id: string;
  isVirtual: true;
  isSubscription?: false;
  sourceExpenseId: string;
};

export type SubscriptionVirtual = Omit<Expense, "id"> & {
  id: string;
  isVirtual: true;
  isSubscription: true;
};

export function useVirtualExpenses(
  normalizedExpenses: Expense[],
  subscriptions: Subscription[],
  cutoffs: InvoiceCutoff[],
) {
  const virtualInstallments = useMemo<VirtualInstallment[]>(() => {
    const result: VirtualInstallment[] = [];
    const existingKeys = new Set(normalizedExpenses.map((e) => `${e.id}_${e.parcela}`));

    for (const e of normalizedExpenses) {
      const totalParcelas = e.total_parcela || 0;
      if (totalParcelas <= 1 || !e.fatura) continue;

      const currentParcela = e.parcela || 0;
      const remainingCount = totalParcelas - currentParcela;
      if (remainingCount <= 0) continue;

      const faturaDate = new Date(e.fatura.substring(0, 7) + "-01T12:00:00");

      for (let i = 1; i <= remainingCount; i++) {
        const futureParcela = currentParcela + i;
        const key = `${e.id}_${futureParcela}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);

        const futuraFatura = addMonths(faturaDate, i);
        result.push({
          ...e,
          id: `${e.id}_v${futureParcela}`,
          parcela: futureParcela,
          fatura: format(futuraFatura, "yyyy-MM-dd"),
          fatura_original: null,
          isVirtual: true,
          isSubscription: false,
          sourceExpenseId: e.id,
        });
      }
    }
    return result;
  }, [normalizedExpenses]);

  const subscriptionVirtuals = useMemo<SubscriptionVirtual[]>(() => {
    const result: SubscriptionVirtual[] = [];
    const today = new Date();
    const currentMonthKey = format(today, "yyyy-MM");

    for (const sub of subscriptions) {
      if (sub.paused) continue;
      const dia = Math.min(Math.max(sub.dia_cobranca || 1, 1), 28);

      for (let i = 0; i < VIRTUAL_PROJECTION_MONTHS; i++) {
        const dataDate = addMonths(new Date(today.getFullYear(), today.getMonth(), 1), i);
        const monthKey = format(dataDate, "yyyy-MM");

        if (monthKey === currentMonthKey && sub.last_generated_month === currentMonthKey) continue;

        const exists = normalizedExpenses.some(
          (e) =>
            e.despesa?.toLowerCase().trim() === sub.nome.toLowerCase().trim() &&
            e.data?.substring(0, 7) === monthKey,
        );
        if (exists) continue;

        const dataStr = `${monthKey}-${String(dia).padStart(2, "0")}`;
        const fatura = resolveFatura(sub.banco || "", sub.cartao || "", dataStr, cutoffs);
        if (!fatura) continue;

        result.push({
          id: `sub_${sub.id}_${monthKey}`,
          banco: sub.banco || "",
          cartao: sub.cartao || "",
          valor: Number(sub.valor),
          data: dataStr,
          parcela: 1,
          total_parcela: 1,
          despesa: sub.nome,
          justificativa: sub.justificativa,
          classificacao: sub.classificacao || "Assinaturas",
          fatura,
          fatura_original: null,
          created_at: "",
          isVirtual: true,
          isSubscription: true,
        });
      }
    }
    return result;
  }, [subscriptions, normalizedExpenses, cutoffs]);

  return { virtualInstallments, subscriptionVirtuals };
}
