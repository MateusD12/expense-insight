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

  const futureExpenses = useMemo(() => {
    const hoje = new Date();
    const currentDay = hoje.getDate(); // Ex: 10
    const currentInvoiceMonth = format(addMonths(hoje, 1), "yyyy-MM"); // Se hoje é Abril, atual é Maio (2026-05)

    return expenses.filter((e) => {
      if (!e.fatura) return false;
      if ((e.total_parcela || 0) <= 1) return false; // Ignora gastos à vista

      const faturaMes = e.fatura.substring(0, 7);
      const despesaDia = parseInt(e.data.substring(8, 10)); // Pega o dia da despesa (ex: 08)

      // É FUTURO SE:
      // 1. A fatura é de um mês lá na frente (Junho em diante)
      const isFaturaFutura = faturaMes > currentInvoiceMonth;
      // 2. É da fatura atual (Maio), mas o dia da despesa ainda não chegou
      const isMesmoMesMasDiaFuturo = faturaMes === currentInvoiceMonth && despesaDia > currentDay;
      // 3. Foi adiantado manualmente (exibimos para permitir o estorno)
      const wasAdvanced = !!e.fatura_original;

      return isFaturaFutura || isMesmoMesMasDiaFuturo || wasAdvanced;
    });
  }, [expenses]);

  // Filtros da aba Futuras
  const uniqueFaturas = useMemo(
    () => [...new Set(futureExpenses.map((e) => e.fatura?.substring(0, 7)))].filter(Boolean).sort() as string[],
    [futureExpenses],
  );
  const uniqueDespesas = useMemo(
    () => [...new Set(futureExpenses.map((e) => e.despesa))].filter(Boolean).sort() as string[],
    [futureExpenses],
  );

  const filtered = useMemo(() => {
    return futureExpenses.filter((e) => {
      const matchFatura = faturaFilter === "all" || e.fatura?.substring(0, 7) === faturaFilter;
      const matchDespesa = despesaFilter === "all" || e.despesa === despesaFilter;
      return matchFatura && matchDespesa;
    });
  }, [futureExpenses, faturaFilter, despesaFilter]);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-3">
        <Select value={faturaFilter} onValueChange={setFaturaFilter}>
          <SelectTrigger className="w-full sm:w-[200px] h-10 bg-slate-50 border-none font-bold text-xs">
            <SelectValue placeholder="Fatura" />
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

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-black text-[10px] py-4 uppercase">Despesa</TableHead>
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
              filtered.map((e) => {
                const isAdvanced = !!e.fatura_original;
                return (
                  <TableRow
                    key={e.id}
                    className={cn("hover:bg-blue-50/50 transition-colors", isAdvanced && "bg-amber-50/50")}
                  >
                    <TableCell className="font-bold text-sm">{e.despesa}</TableCell>
                    <TableCell className="text-right font-black text-blue-600">
                      {formatCurrency(Number(e.valor))}
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs text-slate-500">
                      {e.parcela}/{e.total_parcela}
                    </TableCell>
                    <TableCell className="font-bold text-xs">
                      <span className={cn(isAdvanced && "text-amber-600")}>{formatFatura(e.fatura)}</span>
                      {isAdvanced && (
                        <span className="text-[9px] text-slate-400 ml-1">(era {formatFatura(e.fatura_original)})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {isAdvanced ? (
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
