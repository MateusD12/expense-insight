import { useMemo, useState } from "react";
import { type Expense, useExpenses } from "@/hooks/useExpenses";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Undo2, FastForward } from "lucide-react";
import { cn } from "@/lib/utils";

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function FutureExpenses({ expenses }: { expenses: Expense[] }) {
  const { advanceInstallment, revertInstallment } = useExpenses();
  const [faturaFilter, setFaturaFilter] = useState("all");
  const [despesaFilter, setDespesaFilter] = useState("all");

  const futureExpenses = useMemo(() => {
    const hoje = new Date();
    const todayStr = format(hoje, "yyyy-MM-dd");
    const nextBillMonth = format(addMonths(hoje, 1), "yyyy-MM"); // Se Abril, a atual é Maio (2026-05)

    return expenses.filter((e) => {
      if (!e.fatura) return false;
      const isParcelamentoReal = (e.total_parcela || 0) > 1;
      if (!isParcelamentoReal) return false;

      const faturaMes = e.fatura.substring(0, 7);

      // REGRA:
      // 1. Faturas distantes (Junho/26 em diante) -> É FUTURO.
      const isVeryFuture = faturaMes > nextBillMonth;
      // 2. Fatura de Maio, mas o dia ainda não chegou -> É FUTURO.
      const isNextBillButDayNotReached = faturaMes === nextBillMonth && e.data > todayStr;

      const wasAdvanced = !!e.fatura_original;

      return isVeryFuture || isNextBillButDayNotReached || wasAdvanced;
    });
  }, [expenses]);

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
                  className={cn("hover:bg-blue-50/50 transition-colors", !!e.fatura_original && "bg-amber-50/50")}
                >
                  <TableCell className="font-bold text-sm">{e.despesa}</TableCell>
                  <TableCell className="text-right font-black text-blue-600">{formatCurrency(e.valor)}</TableCell>
                  <TableCell className="text-center text-xs text-slate-400 font-bold">
                    {e.parcela}/{e.total_parcela}
                  </TableCell>
                  <TableCell className="text-xs font-bold uppercase">
                    {format(new Date(e.fatura!.substring(0, 7) + "-01T12:00:00"), "MMM/yy", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-center">
                    {e.fatura_original ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-amber-600 font-bold text-xs h-8"
                        onClick={() => revertInstallment.mutate({ id: e.id, faturaOriginal: e.fatura_original! })}
                      >
                        <Undo2 size={14} className="mr-1" /> Reverter
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
