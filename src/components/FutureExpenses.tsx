import { useEffect, useMemo, useRef, useState } from "react";
import { type Expense, useExpenses } from "@/hooks/useExpenses";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { useVirtualExpenses, type VirtualInstallment, type SubscriptionVirtual } from "@/hooks/useVirtualExpenses";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Undo2, FastForward, Sparkles, Repeat, Pencil, CalendarX } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { resolveFatura, getFaturaAtual, type InvoiceCutoff } from "@/lib/faturaResolver";
import { ExpenseForm } from "@/components/ExpenseForm";
import { supabase } from "@/integrations/supabase/client";

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function FutureExpenses({ expenses, cutoffs = [] }: { expenses: Expense[]; cutoffs?: InvoiceCutoff[] }) {
  const { data: subscriptions = [] } = useSubscriptions();
  const { advanceInstallment, revertInstallment, addExpense, bulkAddExpenses } = useExpenses();
  const [faturaFilter, setFaturaFilter] = useState("all");
  const [despesaFilter, setDespesaFilter] = useState("all");
  const [editingVirtual, setEditingVirtual] = useState<VirtualInstallment | null>(null);
  const materializedRef = useRef<Set<string>>(new Set());

  const { virtualInstallments, subscriptionVirtuals: subVirtuals } = useVirtualExpenses(expenses, subscriptions, cutoffs);

  const futureExpenses = useMemo(() => {
    const advanced = expenses.filter((e) => e.fatura_original);
    return [...virtualInstallments, ...subVirtuals, ...advanced].sort(
      (a, b) => (a.fatura || "").localeCompare(b.fatura || ""),
    );
  }, [virtualInstallments, subVirtuals, expenses]);

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

  useEffect(() => {
    const faturaFoco = getFaturaAtual(cutoffs).slice(0, 7);
    const toMaterialize = virtualInstallments.filter(
      (e) => e.fatura && e.fatura.slice(0, 7) <= faturaFoco,
    );
    if (toMaterialize.length === 0) return;

    const fresh = toMaterialize.filter((e) => !materializedRef.current.has(e.id));
    if (fresh.length === 0) return;

    fresh.forEach((e) => materializedRef.current.add(e.id));

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const payloads = fresh
        .map((e) => {
          const source = expenses.find((exp) => exp.id === e.sourceExpenseId);
          if (!source) return null;
          return {
            banco: source.banco,
            cartao: source.cartao,
            valor: source.valor,
            data: source.data,
            parcela: e.parcela,
            total_parcela: e.total_parcela,
            despesa: source.despesa,
            justificativa: source.justificativa,
            classificacao: source.classificacao,
            fatura: e.fatura,
            fatura_original: null,
            user_id: user.id,
          } as any;
        })
        .filter(Boolean) as any[];
      if (payloads.length > 0) bulkAddExpenses.mutate(payloads);
    })();
  }, [virtualInstallments, cutoffs, expenses, bulkAddExpenses]);

  const handleAdvanceVirtual = (e: VirtualInstallment, targetFatura: string) => {
    const source = expenses.find((exp) => exp.id === e.sourceExpenseId);
    if (!source) return;
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
      fatura: targetFatura,
      fatura_original: e.fatura,
    });
  };

  // Materializar uma parcela virtual com edições do usuário (data/fatura/valor/etc).
  const handleSaveEditedVirtual = async (data: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    addExpense.mutate(
      {
        banco: data.banco,
        cartao: data.cartao,
        valor: Number(data.valor),
        data: data.data,
        parcela: data.parcela,
        total_parcela: data.total_parcela,
        despesa: data.despesa,
        justificativa: data.justificativa,
        classificacao: data.classificacao,
        fatura: data.fatura ? (data.fatura.length === 7 ? `${data.fatura}-01` : data.fatura) : null,
        fatura_original: null,
        user_id: user.id,
      } as any,
      { onSuccess: () => setEditingVirtual(null) },
    );
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
                <TableCell colSpan={5}>
                  <EmptyState
                    icon={CalendarX}
                    title="Nenhuma parcela futura"
                    description="Suas compras parceladas e assinaturas ativas aparecerão aqui"
                    iconClassName="bg-purple-50"
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => {
                const item = e as any;
                const isVirtual = !!item.isVirtual;
                const isSubscription = !!item.isSubscription;
                const hasOriginal = !!e.fatura_original;
                return (
                <TableRow
                  key={e.id}
                  className={cn(
                    "hover:bg-blue-50/50 transition-colors",
                    hasOriginal && "bg-amber-50/50",
                    isVirtual && !isSubscription && "bg-slate-50/30",
                    isSubscription && "bg-indigo-50/30",
                  )}
                >
                  <TableCell className="font-bold text-sm">
                    <div className="flex items-center gap-1.5">
                      {isSubscription ? (
                        <Repeat size={12} className="text-indigo-500" />
                      ) : isVirtual ? (
                        <Sparkles size={12} className="text-purple-400" />
                      ) : null}
                      {e.despesa}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-black text-blue-600">{formatCurrency(e.valor)}</TableCell>
                  <TableCell className="text-center text-xs font-bold">
                    {isSubscription ? (
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
                    {isSubscription ? (
                      <span className="text-[10px] font-bold text-indigo-400 italic">Recorrente</span>
                    ) : hasOriginal ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-amber-600 font-bold text-xs h-8"
                        onClick={() => revertInstallment.mutate({ id: e.id, faturaOriginal: e.fatura_original! })}
                      >
                        <Undo2 size={14} className="mr-1" /> Reverter
                      </Button>
                    ) : isVirtual && item.sourceExpenseId ? (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-purple-600 font-bold text-xs h-8"
                          onClick={() => handleAdvanceVirtual(item as VirtualInstallment, getFaturaAtual(cutoffs))}
                        >
                          <FastForward size={14} className="mr-1" /> Adiantar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-600 font-bold text-xs h-8 px-2"
                          onClick={() => setEditingVirtual(item as VirtualInstallment)}
                          title="Editar parcela futura"
                        >
                          <Pencil size={14} />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 font-bold text-xs h-8"
                        onClick={() => advanceInstallment.mutate({ id: e.id, currentFatura: e.fatura!, targetFatura: getFaturaAtual(cutoffs) })}
                      >
                        <FastForward size={14} className="mr-1" /> Adiantar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {editingVirtual && (
        <ExpenseForm
          open={!!editingVirtual}
          onOpenChange={(o) => !o && setEditingVirtual(null)}
          initialData={
            {
              ...editingVirtual,
              // garantir formatos esperados pelo form
              data: editingVirtual.data || new Date().toISOString().slice(0, 10),
              fatura: editingVirtual.fatura,
            } as any
          }
          onSubmit={handleSaveEditedVirtual}
        />
      )}
    </div>
  );
}
