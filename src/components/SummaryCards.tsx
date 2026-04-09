import type { Expense } from "@/hooks/useExpenses";
import { DollarSign, Receipt, Building2, Tags } from "lucide-react";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  expenses: Expense[];
}

const cards = [
  { key: "total", label: "Total em Gastos", icon: DollarSign, bg: "bg-blue-500", getValue: (e: Expense[]) => formatCurrency(e.reduce((s, x) => s + Number(x.valor), 0)) },
  { key: "count", label: "Transações", icon: Receipt, bg: "bg-emerald-500", getValue: (e: Expense[]) => String(e.length) },
  { key: "bancos", label: "Bancos", icon: Building2, bg: "bg-teal-500", getValue: (e: Expense[]) => String(new Set(e.map((x) => x.banco)).size) },
  { key: "cats", label: "Categorias", icon: Tags, bg: "bg-orange-500", getValue: (e: Expense[]) => String(new Set(e.map((x) => x.classificacao).filter(Boolean)).size) },
] as const;

export function SummaryCards({ expenses }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(({ key, label, icon: Icon, bg, getValue }) => (
        <div key={key} className={`${bg} rounded-xl p-4 text-white shadow-md`}>
          <div className="flex items-center gap-2 mb-1">
            <Icon className="h-4 w-4 opacity-80" />
            <span className="text-xs font-medium opacity-90">{label}</span>
          </div>
          <p className="text-xl font-bold">{getValue(expenses)}</p>
        </div>
      ))}
    </div>
  );
}
