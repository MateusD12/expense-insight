import { useState, useMemo, useEffect } from "react";
import { useExpenses, type Expense } from "@/hooks/useExpenses";
import { ExpenseForm } from "@/components/ExpenseForm";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Target,
  Wallet,
  Filter,
  CreditCard,
  Building2,
  Tags,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
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
import { format, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLORS = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed", "#0891b2"];

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function Index() {
  const { data: allExpenses = [], isLoading, addExpense, updateExpense, deleteExpense } = useExpenses();

  const [filters, setFilters] = useState({
    search: "",
    banco: "all",
    cartao: "all",
    classificacao: "all",
    dataInicio: "",
    dataFim: "",
  });

  const [formOpen, setFormOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense; direction: "asc" | "desc" }>({
    key: "data",
    direction: "desc",
  });

  const [budget, setBudget] = useState<number>(() => {
    const saved = localStorage.getItem("expense-budget");
    return saved ? Number(saved) : 3000;
  });
  const [tempBudget, setTempBudget] = useState(budget);

  const filteredAndSorted = useMemo(() => {
    let result = allExpenses.filter((e) => {
      const matchSearch =
        e.despesa?.toLowerCase().includes(filters.search.toLowerCase()) ||
        e.justificativa?.toLowerCase().includes(filters.search.toLowerCase());
      const matchBanco = filters.banco === "all" || e.banco === filters.banco;
      const matchCat = filters.classificacao === "all" || e.classificacao === filters.classificacao;

      let matchDate = true;
      if (filters.dataInicio && filters.dataFim && e.data) {
        const date = parseISO(e.data);
        matchDate = isWithinInterval(date, {
          start: parseISO(filters.dataInicio),
          end: parseISO(filters.dataFim),
        });
      }
      return matchSearch && matchBanco && matchCat && matchDate;
    });

    result.sort((a, b) => {
      const aVal = a[sortConfig.key] ?? "";
      const bVal = b[sortConfig.key] ?? "";
      const rev = sortConfig.direction === "asc" ? 1 : -1;
      return aVal < bVal ? -1 * rev : 1 * rev;
    });

    return result;
  }, [allExpenses, filters, sortConfig]);

  const totalSpent = useMemo(() => filteredAndSorted.reduce((acc, e) => acc + Number(e.valor), 0), [filteredAndSorted]);
  const uniqueBancos = useMemo(() => new Set(filteredAndSorted.map((e) => e.banco)).size, [filteredAndSorted]);
  const uniqueCats = useMemo(() => new Set(filteredAndSorted.map((e) => e.classificacao)).size, [filteredAndSorted]);
  const remainingBudget = budget - totalSpent;

  // Gráficos
  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAndSorted.forEach((e) => {
      map[e.banco] = (map[e.banco] || 0) + Number(e.valor);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredAndSorted]);

  const areaData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAndSorted.forEach((e) => {
      if (e.fatura) map[e.fatura] = (map[e.fatura] || 0) + Number(e.valor);
    });
    return Object.entries(map)
      .sort()
      .map(([name, valor]) => ({ name, valor }));
  }, [filteredAndSorted]);

  const handleSort = (key: keyof Expense) => {
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  };

  const getSortIcon = (key: keyof Expense) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={12} className="ml-1 opacity-30" />;
    return sortConfig.direction === "asc" ? (
      <ArrowUp size={12} className="ml-1" />
    ) : (
      <ArrowDown size={12} className="ml-1" />
    );
  };

  if (isLoading)
    return <div className="h-screen flex items-center justify-center font-bold text-blue-600">CARREGANDO...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-blue-600 text-white px-6 py-10 shadow-lg">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2 italic">
              <Wallet size={32} /> CONTROLE DE GASTOS
            </h1>
            <p className="text-blue-100 text-xs font-bold opacity-70">SISTEMA DE GESTÃO v2.0</p>
          </div>
          <Button
            className="bg-white text-blue-600 hover:bg-blue-50 font-black px-6"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-5 w-5" /> NOVO GASTO
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 -mt-10 space-y-6">
        {/* GRID DE INDICADORES UNIFICADO */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2 rounded-2xl bg-white p-6 shadow-xl flex flex-col justify-center border-b-4 border-blue-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Consumido</p>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter">{formatCurrency(totalSpent)}</h2>
          </div>

          <div
            className={cn(
              "lg:col-span-1 rounded-2xl p-6 shadow-xl flex flex-col justify-center cursor-pointer transition-all hover:brightness-110",
              remainingBudget < 0 ? "bg-red-600 text-white" : "bg-emerald-500 text-white",
            )}
            onClick={() => {
              setTempBudget(budget);
              setBudgetDialogOpen(true);
            }}
          >
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Saldo do Teto</p>
            <h2 className="text-2xl font-black tracking-tighter">{formatCurrency(remainingBudget)}</h2>
            <p className="text-[8px] mt-1 font-bold opacity-60 italic">CLIQUE P/ AJUSTAR</p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-xl flex flex-col justify-center border-b-4 border-emerald-400">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <CreditCard size={14} />
              <p className="text-[10px] font-black uppercase tracking-widest">Transações</p>
            </div>
            <h2 className="text-2xl font-black text-slate-800">{filteredAndSorted.length}</h2>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-xl flex flex-col justify-center border-b-4 border-orange-500">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Tags size={14} />
              <p className="text-[10px] font-black uppercase tracking-widest">Categorias</p>
            </div>
            <h2 className="text-2xl font-black text-slate-800">{uniqueCats}</h2>
          </div>
        </div>

        {/* FILTROS */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
          <div className="grid gap-4 md:grid-cols-6 lg:grid-cols-12 items-end">
            <div className="md:col-span-3 lg:col-span-4 space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Pesquisar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9 bg-slate-50 border-none"
                  placeholder="O que você procura?"
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                />
              </div>
            </div>
            <div className="lg:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Início</label>
              <Input
                type="date"
                className="bg-slate-50 border-none"
                value={filters.dataInicio}
                onChange={(e) => setFilters((f) => ({ ...f, dataInicio: e.target.value }))}
              />
            </div>
            <div className="lg:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Fim</label>
              <Input
                type="date"
                className="bg-slate-50 border-none"
                value={filters.dataFim}
                onChange={(e) => setFilters((f) => ({ ...f, dataFim: e.target.value }))}
              />
            </div>
            <div className="lg:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Banco</label>
              <Select value={filters.banco} onValueChange={(v) => setFilters((f) => ({ ...f, banco: v }))}>
                <SelectTrigger className="bg-slate-50 border-none">
                  <SelectValue placeholder="Bancos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {[...new Set(allExpenses.map((e) => e.banco))].map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2 flex items-center justify-center">
              <Button
                variant="ghost"
                className="text-xs font-bold text-red-500"
                onClick={() =>
                  setFilters({
                    search: "",
                    banco: "all",
                    cartao: "all",
                    classificacao: "all",
                    dataInicio: "",
                    dataFim: "",
                  })
                }
              >
                LIMPAR
              </Button>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO E CONTEÚDO */}
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="bg-slate-200/60 p-1 rounded-xl mb-6">
            <TabsTrigger value="dashboard" className="rounded-lg font-black text-xs uppercase px-6">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="tabela" className="rounded-lg font-black text-xs uppercase px-6">
              Tabela de Gastos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
                <h3 className="text-xs font-black text-slate-400 uppercase mb-6 tracking-widest">Gastos por Banco</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={8}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
                <h3 className="text-xs font-black text-slate-400 uppercase mb-6 tracking-widest">Evolução Mensal</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={areaData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-[10px] font-bold" />
                    <YAxis axisLine={false} tickLine={false} className="text-[10px] font-bold" />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="#2563eb"
                      fill="#2563eb"
                      fillOpacity={0.1}
                      strokeWidth={4}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tabela">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-900">
                  <TableRow className="hover:bg-slate-900 border-none">
                    <TableHead
                      className="text-white font-black text-[10px] cursor-pointer"
                      onClick={() => handleSort("banco")}
                    >
                      BANCO {getSortIcon("banco")}
                    </TableHead>
                    <TableHead
                      className="text-white font-black text-[10px] text-right cursor-pointer"
                      onClick={() => handleSort("valor")}
                    >
                      VALOR {getSortIcon("valor")}
                    </TableHead>
                    <TableHead
                      className="text-white font-black text-[10px] cursor-pointer"
                      onClick={() => handleSort("data")}
                    >
                      DATA {getSortIcon("data")}
                    </TableHead>
                    <TableHead className="text-white font-black text-[10px]">DESPESA</TableHead>
                    <TableHead className="text-white font-black text-[10px]">CATEGORIA</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((e) => (
                    <TableRow key={e.id} className="hover:bg-slate-50 transition-colors border-slate-100">
                      <TableCell className="font-bold text-slate-700">{e.banco}</TableCell>
                      <TableCell className="text-right font-black text-blue-600">
                        {formatCurrency(Number(e.valor))}
                      </TableCell>
                      <TableCell className="text-slate-400 font-medium">
                        {format(parseISO(e.data), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="font-bold text-slate-800">{e.despesa}</TableCell>
                      <TableCell>
                        <Badge className="bg-slate-100 text-slate-500 border-none font-black text-[9px] uppercase">
                          {e.classificacao}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-400"
                            onClick={() => {
                              setEditing(e);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400"
                            onClick={() => setDeleting(e.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent className="rounded-3xl border-none">
          <DialogHeader>
            <DialogTitle className="font-black text-2xl italic tracking-tighter">AJUSTAR TETO</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <Input
              type="number"
              value={tempBudget}
              onChange={(e) => setTempBudget(Number(e.target.value))}
              className="text-4xl font-black h-20 bg-slate-50 border-none text-center"
            />
          </div>
          <Button
            onClick={() => {
              setBudget(tempBudget);
              localStorage.setItem("expense-budget", tempBudget.toString());
              setBudgetDialogOpen(false);
              toast.success("TETO ATUALIZADO!");
            }}
            className="bg-blue-600 font-black h-12 rounded-xl w-full"
          >
            SALVAR NOVO LIMITE
          </Button>
        </DialogContent>
      </Dialog>
      <ExpenseForm open={formOpen} onOpenChange={setFormOpen} initialData={editing} onSubmit={() => {}} />
    </div>
  );
}
