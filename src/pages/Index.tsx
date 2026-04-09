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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Target, Wallet, Calendar as CalendarIcon, Filter } from "lucide-react";
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

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function Index() {
  const { data: allExpenses = [], isLoading, addExpense, updateExpense, deleteExpense } = useExpenses();

  // Estados de Filtro
  const [filters, setFilters] = useState({
    search: "",
    banco: "all",
    cartao: "all",
    classificacao: "all",
    justificativa: "all",
    dataInicio: "",
    dataFim: "",
  });

  const [formOpen, setFormOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Teto de Gastos com Persistência
  const [budget, setBudget] = useState<number>(() => {
    const saved = localStorage.getItem("expense-budget");
    return saved ? Number(saved) : 3000;
  });
  const [tempBudget, setTempBudget] = useState(budget);

  // Lógica de Filtragem
  const filteredData = useMemo(() => {
    return allExpenses.filter((e) => {
      const matchSearch =
        e.despesa?.toLowerCase().includes(filters.search.toLowerCase()) ||
        e.justificativa?.toLowerCase().includes(filters.search.toLowerCase());
      const matchBanco = filters.banco === "all" || e.banco === filters.banco;
      const matchCartao = filters.cartao === "all" || e.cartao === filters.cartao;
      const matchCat = filters.classificacao === "all" || e.classificacao === filters.classificacao;
      const matchJust = filters.justificativa === "all" || e.justificativa === filters.justificativa;

      // Filtro de Período
      let matchDate = true;
      if (filters.dataInicio && filters.dataFim && e.data) {
        const date = parseISO(e.data);
        matchDate = isWithinInterval(date, {
          start: parseISO(filters.dataInicio),
          end: parseISO(filters.dataFim),
        });
      }

      return matchSearch && matchBanco && matchCartao && matchCat && matchJust && matchDate;
    });
  }, [allExpenses, filters]);

  const totalSpent = useMemo(() => filteredData.reduce((acc, e) => acc + Number(e.valor), 0), [filteredData]);
  const remainingBudget = budget - totalSpent;

  const handleSaveBudget = () => {
    setBudget(tempBudget);
    localStorage.setItem("expense-budget", tempBudget.toString());
    setBudgetDialogOpen(false);
    toast.success("Teto de gastos atualizado!");
  };

  const unique = (key: keyof Expense) =>
    [...new Set(allExpenses.map((e) => e[key]).filter(Boolean) as string[])].sort();

  if (isLoading) return <div className="flex items-center justify-center h-screen font-mono">CARREGANDO DADOS...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-10">
      {/* Header */}
      <div className="bg-[#2563eb] text-white px-6 py-8 shadow-md">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2 italic">
              <Wallet size={32} /> CONTROLE DE GASTOS
            </h1>
            <p className="text-blue-100 text-sm font-medium opacity-80">GESTÃO FINANCEIRA PESSOAL v2.0</p>
          </div>
          <Button
            className="bg-white text-[#2563eb] hover:bg-blue-50 font-bold shadow-lg"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-5 w-5" /> NOVO GASTO
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 -mt-8 space-y-6">
        {/* INDICADORES DE ORÇAMENTO (CARDS GRANDES) */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Card Total Gasto */}
          <div className="rounded-2xl border-none bg-white p-6 shadow-xl flex flex-col justify-center min-h-[140px]">
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Consumido</p>
            <h2 className="text-4xl font-black text-slate-800 tracking-tighter">{formatCurrency(totalSpent)}</h2>
          </div>

          {/* Card Teto/Disponível - Clicável */}
          <div
            className={cn(
              "rounded-2xl border-none p-6 shadow-xl flex flex-col justify-center min-h-[140px] cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]",
              remainingBudget < 0 ? "bg-red-600 text-white" : "bg-emerald-500 text-white",
            )}
            onClick={() => {
              setTempBudget(budget);
              setBudgetDialogOpen(true);
            }}
          >
            <div className="flex justify-between items-start">
              <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80 mb-1">
                {remainingBudget < 0 ? "Orçamento Estourado" : "Saldo Disponível"}
              </p>
              <Target size={20} className="opacity-50" />
            </div>
            <h2 className="text-4xl font-black tracking-tighter">
              {remainingBudget < 0 ? `- ${formatCurrency(Math.abs(remainingBudget))}` : formatCurrency(remainingBudget)}
            </h2>
            <p className="text-[10px] font-bold mt-1 opacity-70">
              CLIQUE PARA AJUSTAR O TETO (ATUAL: {formatCurrency(budget)})
            </p>
          </div>
        </div>

        {/* BARRA DE FILTROS REFEITA */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm mb-2">
            <Filter size={16} /> FILTRAR RESULTADOS
          </div>

          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7 items-end">
            {/* Busca e Período nas colunas maiores */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Descrição / Justificativa</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9 bg-slate-50 border-slate-200"
                  placeholder="Ex: Mercado..."
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">De:</label>
              <Input
                type="date"
                className="bg-slate-50"
                value={filters.dataInicio}
                onChange={(e) => setFilters((f) => ({ ...f, dataInicio: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Até:</label>
              <Input
                type="date"
                className="bg-slate-50"
                value={filters.dataFim}
                onChange={(e) => setFilters((f) => ({ ...f, dataFim: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Banco</label>
              <Select value={filters.banco} onValueChange={(v) => setFilters((f) => ({ ...f, banco: v }))}>
                <SelectTrigger className="bg-slate-50">
                  <SelectValue placeholder="Banco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {unique("banco").map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Categoria</label>
              <Select
                value={filters.classificacao}
                onValueChange={(v) => setFilters((f) => ({ ...f, classificacao: v }))}
              >
                <SelectTrigger className="bg-slate-50">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {unique("classificacao").map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              className="text-xs font-bold text-red-500"
              onClick={() =>
                setFilters({
                  search: "",
                  banco: "all",
                  cartao: "all",
                  classificacao: "all",
                  justificativa: "all",
                  dataInicio: "",
                  dataFim: "",
                })
              }
            >
              LIMPAR
            </Button>
          </div>
        </div>

        {/* Resumo Secundário */}
        <SummaryCards expenses={filteredData} />

        {/* Listagem */}
        <Tabs defaultValue="tabela" className="w-full">
          <TabsList className="bg-slate-200/50 p-1 rounded-xl">
            <TabsTrigger value="dashboard" className="rounded-lg font-bold">
              DASHBOARD
            </TabsTrigger>
            <TabsTrigger value="tabela" className="rounded-lg font-bold">
              TABELA DE GASTOS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tabela" className="mt-6">
            <div className="rounded-2xl border-none bg-white shadow-xl overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-800">
                  <TableRow className="hover:bg-slate-800 border-none">
                    <TableHead className="text-white font-black text-[10px] uppercase">Banco</TableHead>
                    <TableHead className="text-right text-white font-black text-[10px] uppercase">Valor</TableHead>
                    <TableHead className="text-white font-black text-[10px] uppercase">Data</TableHead>
                    <TableHead className="text-white font-black text-[10px] uppercase">Despesa</TableHead>
                    <TableHead className="text-white font-black text-[10px] uppercase">Categoria</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((e) => (
                    <TableRow key={e.id} className="border-slate-100 hover:bg-slate-50 transition-colors">
                      <TableCell className="font-bold text-slate-700">{e.banco}</TableCell>
                      <TableCell className="text-right font-black text-blue-600">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(e.valor))}
                      </TableCell>
                      <TableCell className="text-slate-500 font-medium">
                        {format(parseISO(e.data), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-sm">{e.despesa}</span>
                          <span className="text-[10px] text-slate-400 italic">{e.justificativa}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none font-bold text-[10px]">
                          {e.classificacao}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-blue-50 text-blue-400"
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
                            className="h-8 w-8 hover:bg-red-50 text-red-400"
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

      {/* Popups */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent className="rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-2xl tracking-tighter">CONFIGURAR TETO</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400">Limite Mensal Desejado</label>
              <Input
                type="number"
                value={tempBudget}
                onChange={(e) => setTempBudget(Number(e.target.value))}
                className="text-3xl font-black h-16 bg-slate-50 border-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveBudget} className="w-full h-12 bg-blue-600 font-black rounded-xl">
              SALVAR ALTERAÇÕES
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExpenseForm open={formOpen} onOpenChange={setFormOpen} initialData={editing} onSubmit={() => {}} />
    </div>
  );
}
