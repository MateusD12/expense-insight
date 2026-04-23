import { useMemo, useState } from "react";
import { type Expense, useExpenses } from "@/hooks/useExpenses";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Undo2, FastForward, Sparkles, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveFatura, type InvoiceCutoff } from "@/lib/faturaResolver";

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface VirtualExpense extends Expense {
  isVirtual?: boolean;
  isSubscription?: boolean;
  sourceExpenseId?: string;
}

const SUBSCRIPTION_PROJECTION_MONTHS = 6;

export function FutureExpenses({ expenses, cutoffs = [] }: { expenses: Expense[]; cutoffs?: InvoiceCutoff[] }) {
  const { data: subscriptions = [] } = useSubscriptions();
  const { advanceInstallment, revertInstallment, addExpense } = useExpenses();
  const [faturaFilter, setFaturaFilter] = useState("all");
  const [despesaFilter, setDespesaFilter] = useState("all");

  const futureExpenses = useMemo<VirtualExpense[]>(() => {
    const result: VirtualExpense[] = [];
    // Set of existing real expense keys to avoid duplicates: "sourceId_parcela"
    const existingKeys = new Set(expenses.map((e) => `${e.despesa}_${e.parcela}_${e.total_parcela}`));

    for (const e of expenses) {
      const totalParcelas = e.total_parcela || 0;
      if (totalParcelas <= 1) continue;
      if (!e.fatura) continue;

      const currentParcela = e.parcela || 0;
      const remainingCount = totalParcelas - currentParcela;
      if (remainingCount <= 0) continue;

      // Generate virtual entries for remaining installments
      const faturaDate = new Date(e.fatura.substring(0, 7) + "-01T12:00:00");

      for (let i = 1; i <= remainingCount; i++) {
        const futureParcela = currentParcela + i;
        const key = `${e.despesa}_${futureParcela}_${totalParcelas}`;

        // Skip if a real record already exists for this installment
        if (existingKeys.has(key)) continue;

        const futuraFatura = addMonths(faturaDate, i);
        const futuraFaturaStr = format(futuraFatura, "yyyy-MM-dd");

        result.push({
          ...e,
          id: `${e.id}_p${futureParcela}`,
          parcela: futureParcela,
          fatura: futuraFaturaStr,
          fatura_original: null,
          isVirtual: true,
          sourceExpenseId: e.id,
        });
      }
    }

    // Also include real future records that were advanced (have fatura_original)
    for (const e of expenses) {
      if (e.fatura_original) {
        result.push({ ...e, isVirtual: false });
      }
    }

    // Project active (non-paused) subscriptions for the next N months
    const today = new Date();
    const currentMonthKey = format(today, "yyyy-MM");
    for (const sub of subscriptions) {
      if (sub.paused) continue;
      const dia = Math.min(Math.max(sub.dia_cobranca || 1, 1), 28);

      for (let i = 0; i < SUBSCRIPTION_PROJECTION_MONTHS; i++) {
        const dataDate = addMonths(new Date(today.getFullYear(), today.getMonth(), 1), i);
        const monthKey = format(dataDate, "yyyy-MM");

        // Skip current month if already auto-generated
        if (monthKey === currentMonthKey && sub.last_generated_month === currentMonthKey) continue;

        // Skip if a real expense for this subscription already exists in this month
        const exists = expenses.some(
          (e) =>
            e.despesa?.toLowerCase().trim() === sub.nome.toLowerCase().trim() && e.data?.substring(0, 7) === monthKey,
        );
        if (exists) continue;

        const dataStr = `${monthKey}-${String(dia).padStart(2, "0")}`;
        const faturaStr = resolveFatura(sub.banco || "", sub.cartao || "", dataStr, cutoffs);

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
          classificacao: sub.classificacao || "Assinatura",
          fatura: faturaStr,
          fatura_original: null,
          created_at: "",
          isVirtual: true,
          isSubscription: true,
        });
      }
    }

    return result.sort((a, b) => (a.fatura || "").localeCompare(b.fatura || ""));
  }, [expenses, subscriptions]);

  const uniqueFaturas = useMemo(
    () => [...new Set(futureExpenses.map((e) => e.fatura?.substring(0, 7)))].filter(Boolean).sort() as string[],
    [futureExpenses],
  );
  const uniqueDespesas = useMemo(
    () => [...new Set(futureExpenses.map((e) => e.despesa))].filter(Boolean).sort() as string[],
    [futureExpenses],
  );

  const filtered = useMemo(() => {
    return futureExpenses.filter(
      (e) =>
        (faturaFilter === "all" || e.fatura?.startsWith(faturaFilter)) &&
        (despesaFilter === "all" || e.despesa === despesaFilter),
    );
  }, [futureExpenses, faturaFilter, despesaFilter]);

  const handleAdvanceVirtual = (e: VirtualExpense) => {
    // Find the source expense to copy all fields
    const source = expenses.find((exp) => exp.id === e.sourceExpenseId);
    if (!source) return;

    // "Fatura atual" no app é a próxima do mês corrente
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const currentMonthFatura = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-01`;

    addExpense.mutate({
      banco: source.banco,
      cartao: source.cartao,
      valor: source.valor,
      data: source.data,
      parcela: e.parcela,
      total_parcela: e.total_parcela,
      despesa: source.despesa,
      justificativa: source.justificativa,
      classificacao: source.classificacao,
      fatura: currentMonthFatura,
      fatura_original: e.fatura,
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border flex flex-col sm:flex-row gap-3">
        <Select value={faturaFilter} onValueChange={setFaturaFilter}>
          <SelectTrigger className="w-full sm:w-[200px] font-bold bg-slate-50 border-none">
            <SelectValue placeholder="Fatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Faturas</SelectItem>
            {uniqueFaturas.map((f) => (
              <SelectItem key={f} value={f}>
                {format(new Date(f + "-01T12:00:00"), "MMM/yy", { locale: ptBR })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={despesaFilter} onValueChange={setDespesaFilter}>
          <SelectTrigger className="w-full sm:w-[200px] font-bold bg-slate-50 border-none">
            <SelectValue placeholder="Despesa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Despesas</SelectItem>
            {uniqueDespesas.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-black text-[10px] uppercase py-4">Despesa</TableHead>
              <TableHead className="font-black text-[10px] uppercase text-right">Valor</TableHead>
              <TableHead className="font-black text-[10px] uppercase text-center">Parcela</TableHead>
              <TableHead className="font-black text-[10px] uppercase">Fatura</TableHead>
              <TableHead className="font-black text-[10px] uppercase text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-slate-400 font-bold italic">
                  Nenhuma parcela futura encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow
                  key={e.id}
                  className={cn(
                    "hover:bg-blue-50/50 transition-colors",
                    !!e.fatura_original && "bg-amber-50/50",
                    e.isVirtual && !e.isSubscription && "bg-slate-50/30",
                    e.isSubscription && "bg-indigo-50/30",
                  )}
                >
                  <TableCell className="font-bold text-sm">
                    <div className="flex items-center gap-1.5">
                      {e.isSubscription ? (
                        <Repeat size={12} className="text-indigo-500" />
                      ) : e.isVirtual ? (
                        <Sparkles size={12} className="text-purple-400" />
                      ) : null}
                      {e.despesa}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-black text-blue-600">{formatCurrency(e.valor)}</TableCell>
                  <TableCell className="text-center text-xs font-bold">
                    {e.isSubscription ? (
                      <Badge
                        variant="outline"
                        className="bg-indigo-50 text-indigo-700 border-indigo-200 font-black text-[9px]"
                      >
                        ASSINATURAS
                      </Badge>
                    ) : (
                      <span className="text-slate-400">
                        {e.parcela}/{e.total_parcela}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-bold uppercase">
                    {format(new Date(e.fatura!.substring(0, 7) + "-01T12:00:00"), "MMM/yy", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-center">
                    {e.isSubscription ? (
                      <span className="text-[10px] font-bold text-indigo-400 italic">Recorrente</span>
                    ) : e.fatura_original ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-amber-600 font-bold text-xs h-8"
                        onClick={() => revertInstallment.mutate({ id: e.id, faturaOriginal: e.fatura_original! })}
                      >
                        <Undo2 size={14} className="mr-1" /> Reverter
                      </Button>
                    ) : e.isVirtual ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-purple-600 font-bold text-xs h-8"
                        onClick={() => handleAdvanceVirtual(e)}
                      >
                        <FastForward size={14} className="mr-1" /> Adiantar
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 font-bold text-xs h-8"
                        onClick={() => advanceInstallment.mutate({ id: e.id, currentFatura: e.fatura! })}
                      >
                        <FastForward size={14} className="mr-1" /> Adiantar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
