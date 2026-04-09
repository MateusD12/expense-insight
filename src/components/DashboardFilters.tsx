import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Expense } from "@/hooks/useExpenses";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface Filters {
  fatura: string;
  banco: string;
  cartao: string;
  classificacao: string;
}

interface Props {
  expenses: Expense[];
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function DashboardFilters({ expenses, filters, onChange }: Props) {
  const unique = (key: keyof Expense) =>
    [...new Set(expenses.map((e) => e[key]).filter(Boolean) as string[])].sort();

  const faturas = unique("fatura");
  const bancos = unique("banco");
  const cartoes = filters.banco === "all"
    ? unique("cartao")
    : [...new Set(expenses.filter((e) => e.banco === filters.banco).map((e) => e.cartao))].sort();
  const classificacoes = unique("classificacao");

  const formatFatura = (f: string) => {
    try {
      return format(new Date(f + "T12:00:00"), "MMMM/yyyy", { locale: ptBR });
    } catch {
      return f;
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      <Select value={filters.fatura} onValueChange={(v) => onChange({ ...filters, fatura: v })}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Fatura" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas Faturas</SelectItem>
          {faturas.map((f) => <SelectItem key={f} value={f}>{formatFatura(f)}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.banco} onValueChange={(v) => onChange({ ...filters, banco: v, cartao: "all" })}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Banco" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos Bancos</SelectItem>
          {bancos.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.cartao} onValueChange={(v) => onChange({ ...filters, cartao: v })}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Cartão" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos Cartões</SelectItem>
          {cartoes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.classificacao} onValueChange={(v) => onChange({ ...filters, classificacao: v })}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Classificação" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas Classificações</SelectItem>
          {classificacoes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
