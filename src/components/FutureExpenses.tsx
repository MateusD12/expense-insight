import { useMemo, useState } from "react";
import { type Expense, useExpenses } from "@/hooks/useExpenses";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Undo2, FastForward } from "lucide-react";
import { cn } from "@/lib/utils";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatFatura = (d: string | null) => {
  if (!d) return "-";
  try {
    return format(new Date(d.substring(0, 7) + "-01T12:00:00"), "MMM/yy", { locale: ptBR });
  } catch {
    return d;
  }
};

interface FutureExpensesProps {
  expenses: Expense[];
}

export function FutureExpenses({ expenses }: FutureExpensesProps) {
  const { advanceInstallment, revertInstallment } = useExpenses();
  const [faturaFilter, setFaturaFilter] = useState("all");
  const [despesaFilter, setDespesaFilter] = useState("all");

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const futureExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!e.fatura) return false;
      const faturaMonth = e.fatura.substring(0, 7);
      // Show future OR those that were advanced (have fatura_original)
      const isFuture = faturaMonth > currentMonth;
      const wasAdvanced = !!e.fatura_original;
      return isFuture || wasAdvanced;
    });
  }, [expenses, currentMonth]);

  const uniqueFaturas = useMemo(() => {
    const set = new Set<string>();
    futureExpenses.forEach((e) => {
      if (e.fatura) set.add(e.fatura.substring(0, 7));
      if (e.fatura_original) set.add(e.fatura_original.substring(0, 7));
    });
    return [...set].sort();
  }, [futureExpenses]);

  const uniqueDespesas = useMemo(() => {
    return [...new Set(futureExpenses.map((e) => e.despesa).filter(Boolean))] as string[];
  }, [futureExpenses]);

  const filtered = useMemo(() => {
    return futureExpenses.filter((e) => {
      const matchFatura =
        faturaFilter === "all" ||
        e.fatura?.substring(0, 7) === faturaFilter ||
        e.fatura_original?.substring(0, 7) === faturaFilter;
      const matchDespesa = despesaFilter === "all" || e.despesa === despesaFilter;
      return matchFatura && matchDespesa;
    });
  }, [futureExpenses, faturaFilter, despesaFilter]);

  const handleAdvance = (e: Expense) => {
    if (!e.fatura) return;
    advanceInstallment.mutate(
      { id: e.id, currentFatura: e.fatura },
      { onSuccess: () => toast.success("Parcela adiantada para a fatura atual!") },
    );
  };

  const handleRevert = (e: Expense) => {
    if (!e.fatura_original) return;
    revertInstallment.mutate(
      { id: e.id, faturaOriginal: e.fatura_original },
      { onSuccess: () => toast.success("Parcela revertida para a fatura original!") },
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-3">
        <Select value={faturaFilter} onValueChange={setFaturaFilter}>
          <SelectTrigger className="w-full sm:w-[200px] h-10 bg-slate-50 border-none font-bold text-xs">
            <SelectValue placeholder="Filtrar por Fatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Faturas</SelectItem>
            {uniqueFaturas.map((f) => (
              <SelectItem key={f} value={f}>
                {formatFatura(f)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={despesaFilter} onValueChange={setDespesaFilter}>
          <SelectTrigger className="w-full sm:w-[200px] h-10 bg-slate-50 border-none font-bold text-xs">
            <SelectValue placeholder="Filtrar por Despesa" />
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

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-black text-[10px] py-4">Despesa</TableHead>
                <TableHead className="font-black text-[10px]">Banco</TableHead>
                <TableHead className="font-black text-[10px] text-right">Valor</TableHead>
                <TableHead className="font-black text-[10px] text-center">Parcela</TableHead>
                <TableHead className="font-black text-[10px]">Fatura</TableHead>
                <TableHead className="font-black text-[10px] text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-slate-400 font-bold">
                    Nenhuma parcela futura encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => {
                  const isAdvanced = !!e.fatura_original;
                  return (
                    <TableRow key={e.id} className={cn("hover:bg-blue-50/50 transition-colors", isAdvanced && "bg-amber-50/50")}>
                      <TableCell className="font-bold text-sm">{e.despesa || "-"}</TableCell>
                      <TableCell className="font-bold text-xs">{e.banco}</TableCell>
                      <TableCell className="text-right font-black text-blue-600">
                        {formatCurrency(Number(e.valor))}
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs text-slate-500">
                        {e.parcela}/{e.total_parcela}
                      </TableCell>
                      <TableCell className="font-bold text-xs">
                        <span className={cn(isAdvanced && "text-amber-600")}>
                          {formatFatura(e.fatura)}
                        </span>
                        {isAdvanced && (
                          <span className="text-[9px] text-slate-400 ml-1">
                            (era {formatFatura(e.fatura_original)})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isAdvanced ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 font-bold text-xs h-8 gap-1"
                            onClick={() => handleRevert(e)}
                          >
                            <Undo2 size={14} /> Reverter
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold text-xs h-8 gap-1"
                            onClick={() => handleAdvance(e)}
                          >
                            <FastForward size={14} /> Adiantar
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
      </div>

      {filtered.length > 0 && (
        <div className="text-center text-xs text-slate-400 font-bold">
          {filtered.length} parcela{filtered.length !== 1 ? "s" : ""} futura{filtered.length !== 1 ? "s" : ""} •{" "}
          Total: {formatCurrency(filtered.reduce((acc, e) => acc + Number(e.valor), 0))}
        </div>
      )}
    </div>
  );
}
