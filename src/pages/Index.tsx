import { useState, useMemo, useEffect } from "react";
import { useExpenses, type Expense } from "@/hooks/useExpenses";
import { ExpenseForm } from "@/components/ExpenseForm";
import { SummaryCards } from "@/components/SummaryCards";
import { RankedList } from "@/components/RankedList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Upload, ArrowUpDown, ArrowUp, ArrowDown, Target } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLORS = [
  "hsl(220,70%,50%)",
  "hsl(340,70%,50%)",
  "hsl(160,70%,40%)",
  "hsl(30,80%,50%)",
  "hsl(270,60%,50%)",
  "hsl(190,70%,45%)",
  "hsl(0,70%,50%)",
  "hsl(50,80%,45%)",
  "hsl(120,50%,40%)",
  "hsl(300,50%,50%)",
];

const BADGE_COLORS: Record<string, string> = {
  Estudos: "bg-blue-100 text-blue-800",
  Saúde: "bg-red-100 text-red-800",
  Lazer: "bg-purple-100 text-purple-800",
  Alimentação: "bg-orange-100 text-orange-800",
  Compras: "bg-pink-100 text-pink-800",
  Transporte: "bg-green-100 text-green-800",
  Assinatura: "bg-indigo-100 text-indigo-800",
  Presente: "bg-yellow-100 text-yellow-800",
};

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string | null) => {
  if (!d) return "-";
  try {
    return format(new Date(d + "T12:00:00"), "dd/MM/yyyy");
  } catch {
    return d;
  }
};

const formatFatura = (d: string | null) => {
  if (!d) return "-";
  try {
    return format(new Date(d + "T12:00:00"), "MMM/yyyy", { locale: ptBR });
  } catch {
    return d;
  }
};

interface Filters {
  search: string;
  fatura: string;
  banco: string;
  cartao: string;
  classificacao: string;
}

interface SortConfig {
  key: keyof Expense | null;
  direction: "asc" | "desc";
}

export default function Index() {
  const { data: allExpenses = [], isLoading, addExpense, updateExpense, deleteExpense } = useExpenses();
  const [filters, setFilters] = useState<Filters>({
    search: "",
    fatura: "all",
    banco: "all",
    cartao: "all",
    classificacao: "all",
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "data", direction: "desc" });

  // --- Lógica do Teto de Gastos ---
  const [budget, setBudget] = useState<number>(() => {
    const saved = localStorage.getItem("expense-budget");
    return saved ? Number(saved) : 3000;
  });

  useEffect(() => {
    localStorage.setItem("expense-budget", budget.toString());
  }, [budget]);

  const filteredAndSorted = useMemo(() => {
    let result = allExpenses.filter((e) => {
      if (filters.fatura !== "all" && e.fatura !== filters.fatura) return false;
      if (filters.banco !== "all" && e.banco !== filters.banco) return false;
      if (filters.cartao !== "all" && e.cartao !== filters.cartao) return false;
      if (filters.classificacao !== "all" && e.classificacao !== filters.classificacao) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (
          !(
            e.despesa?.toLowerCase().includes(s) ||
            e.justificativa?.toLowerCase().includes(s) ||
            e.classificacao?.toLowerCase().includes(s)
          )
        )
          return false;
      }
      return true;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];
        if (aValue === bValue) return 0;
        const reverse = sortConfig.direction === "asc" ? 1 : -1;
        if (aValue === null || aValue === undefined) return 1 * reverse;
        if (bValue === null || bValue === undefined) return -1 * reverse;
        return aValue < bValue ? -1 * reverse : 1 * reverse;
      });
    }
    return result;
  }, [allExpenses, filters, sortConfig]);

  const totalSpent = useMemo(() => {
    return filteredAndSorted.reduce((acc, e) => acc + Number(e.valor), 0);
  }, [filteredAndSorted]);

  const remainingBudget = budget - totalSpent;

  // --- Handlers ---
  const handleSort = (key: keyof Expense) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortIcon = (key: keyof Expense) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="ml-2 h-3 w-3 text-blue-600" />
    ) : (
      <ArrowDown className="ml-2 h-3 w-3 text-blue-600" />
    );
  };

  const unique = (key: keyof Expense) =>
    [...new Set(allExpenses.map((e) => e[key]).filter(Boolean) as string[])].sort();

  const cartoes =
    filters.banco === "all"
      ? unique("cartao")
      : [...new Set(allExpenses.filter((e) => e.banco === filters.banco).map((e) => e.cartao))].sort();

  // --- Chart Data ---
  const areaData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAndSorted.forEach((e) => {
      if (e.fatura) map[e.fatura] = (map[e.fatura] || 0) + Number(e.valor);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([f, v]) => ({
        name: format(new Date(f + "T12:00:00"), "MMM/yy", { locale: ptBR }),
        valor: Math.round(v * 100) / 100,
      }));
  }, [filteredAndSorted]);

  const pieData = useMemo(() => {
    const map: Record<string, { valor: number; cartoes: Set<string> }> = {};
    filteredAndSorted.forEach((e) => {
      if (!map[e.banco]) map[e.banco] = { valor: 0, cartoes: new Set() };
      map[e.banco].valor += Number(e.valor);
      map[e.banco].cartoes.add(e.cartao);
    });
    const entries = Object.entries(map).map(([banco, { valor, cartoes }]) => ({
      name: banco,
      sub: [...cartoes].map((c) => `••${c}`).join(", "),
      valor: Math.round(valor * 100) / 100,
    }));
    const t = entries.reduce((s, e) => s + e.valor, 0);
    return entries.map((e) => ({ ...e, pct: t > 0 ? Math.round((e.valor / t) * 1000) / 10 : 0 }));
  }, [filteredAndSorted]);

  const topClassificacao = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAndSorted.forEach((e) => {
      if (e.classificacao) map[e.classificacao] = (map[e.classificacao] || 0) + Number(e.valor);
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, valor]) => ({ name, valor: Math.round(valor * 100) / 100 }));
  }, [filteredAndSorted]);

  if (isLoading)
    return <div className="flex items-center justify-center h-screen text-muted-foreground">Carregando...</div>;

  return (
    <div className="min-h-screen bg-muted/30 pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">💳 Controle de Gastos</h1>
              <p className="text-blue-100 text-sm mt-1">Gerencie seus gastos de cartão de crédito</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Upload className="mr-1 h-4 w-4" /> Importar Planilha
              </Button>
              <Button
                className="bg-white text-blue-700 hover:bg-blue-50"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Novo Gasto
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 space-y-6">
        {/* FILTROS E TETO DE GASTOS */}
        <div className="grid gap-4 md:grid-cols-12 items-start">
          {/* Card do Teto de Gastos */}
          <div className="md:col-span-3 rounded-xl border bg-card p-4 shadow-sm border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                <Target size={14} className="text-blue-500" /> Teto do Mês
              </div>
              <Input
                type="number"
                className="w-20 h-7 text-xs font-bold bg-muted/50 border-none focus-visible:ring-blue-500"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <h2
                className={cn(
                  "text-2xl font-black tracking-tighter",
                  remainingBudget < 0 ? "text-red-600" : "text-emerald-600",
                )}
              >
                {formatCurrency(remainingBudget)}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                {remainingBudget < 0 ? "⚠️ ORÇAMENTO ESTOURADO!" : "✅ DISPONÍVEL PARA GASTAR"}
              </p>
            </div>
          </div>

          {/* Barra de Filtros */}
          <div className="md:col-span-9 flex flex-wrap gap-2 items-center bg-white p-4 rounded-xl border shadow-sm self-stretch">
            <div className="relative flex-1 min-w-[150px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar despesa..."
                className="pl-9 bg-muted/20 border-none h-10"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            <Select value={filters.banco} onValueChange={(v) => setFilters((f) => ({ ...f, banco: v, cartao: "all" }))}>
              <SelectTrigger className="w-[130px] h-10 border-none bg-muted/20">
                <SelectValue placeholder="Banco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Bancos</SelectItem>
                {unique("banco").map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.cartao} onValueChange={(v) => setFilters((f) => ({ ...f, cartao: v }))}>
              <SelectTrigger className="w-[130px] h-10 border-none bg-muted/20">
                <SelectValue placeholder="Cartão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Cartões</SelectItem>
                {cartoes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.classificacao}
              onValueChange={(v) => setFilters((f) => ({ ...f, classificacao: v }))}
            >
              <SelectTrigger className="w-[140px] h-10 border-none bg-muted/20">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Categorias</SelectItem>
                {unique("classificacao").map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Resumo Geral */}
        <SummaryCards expenses={filteredAndSorted} />

        {/* Tabs Principais */}
        <Tabs defaultValue="tabela" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="dashboard">Insights & Gráficos</TabsTrigger>
            <TabsTrigger value="tabela">Lista Detalhada</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-widest text-muted-foreground">
                  Gastos por Banco
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="valor"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-widest text-muted-foreground">
                  Evolução Mensal
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={areaData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" className="text-[10px]" axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `R$${v}`} className="text-[10px]" axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="hsl(220,70%,50%)"
                      fill="hsl(220,70%,50%)"
                      fillOpacity={0.1}
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <RankedList data={topClassificacao} title="Maiores Gastos por Categoria" />
            </div>
          </TabsContent>

          <TabsContent value="tabela" className="mt-6">
            <div className="rounded-xl border bg-white shadow-md overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="cursor-pointer font-bold" onClick={() => handleSort("banco")}>
                      <div className="flex items-center">BANCO {getSortIcon("banco")}</div>
                    </TableHead>
                    <TableHead className="cursor-pointer font-bold" onClick={() => handleSort("cartao")}>
                      <div className="flex items-center">CARTÃO {getSortIcon("cartao")}</div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer font-bold" onClick={() => handleSort("valor")}>
                      <div className="flex items-center justify-end">VALOR {getSortIcon("valor")}</div>
                    </TableHead>
                    <TableHead className="cursor-pointer font-bold" onClick={() => handleSort("data")}>
                      <div className="flex items-center">DATA {getSortIcon("data")}</div>
                    </TableHead>
                    <TableHead className="font-bold">PARCELA</TableHead>
                    <TableHead className="cursor-pointer font-bold" onClick={() => handleSort("despesa")}>
                      <div className="flex items-center">DESPESA {getSortIcon("despesa")}</div>
                    </TableHead>
                    <TableHead className="font-bold">CATEGORIA</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-20 text-muted-foreground">
                        Nenhum gasto encontrado com esses filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSorted.map((e) => (
                      <TableRow key={e.id} className="hover:bg-muted/20">
                        <TableCell className="font-semibold">{e.banco}</TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">••{e.cartao}</TableCell>
                        <TableCell className="text-right font-bold text-blue-600">
                          {formatCurrency(Number(e.valor))}
                        </TableCell>
                        <TableCell>{formatDate(e.data)}</TableCell>
                        <TableCell className="text-xs">
                          {e.parcela > 0 ? `${e.parcela}/${e.total_parcela}` : "À vista"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{e.despesa || "-"}</span>
                            <span className="text-[10px] text-muted-foreground italic truncate max-w-[150px]">
                              {e.justificativa}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              BADGE_COLORS[e.classificacao] || "bg-gray-100 text-gray-800",
                              "border-none shadow-none text-[10px]",
                            )}
                          >
                            {e.classificacao}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600"
                              onClick={() => {
                                setEditing(e);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                              onClick={() => setDeleting(e.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editing}
        onSubmit={(data) => {
          if (editing) {
            updateExpense.mutate(
              { id: editing.id, ...data },
              {
                onSuccess: () => toast.success("Gasto atualizado!"),
              },
            );
          } else {
            addExpense.mutate(data, {
              onSuccess: () => toast.success("Gasto adicionado!"),
            });
          }
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>Esta despesa será removida do seu controle financeiro.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleting)
                  deleteExpense.mutate(deleting, {
                    onSuccess: () => {
                      toast.success("Excluído com sucesso!");
                      setDeleting(null);
                    },
                  });
              }}
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
