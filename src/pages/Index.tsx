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
import { Plus, Pencil, Trash2, Search, Upload, ArrowUpDown, ArrowUp, ArrowDown, Target, Settings2 } from "lucide-react";
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

const COLORS = ["hsl(220,70%,50%)", "hsl(340,70%,50%)", "hsl(160,70%,40%)", "hsl(30,80%,50%)"];

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string | null) => {
  if (!d) return "-";
  try {
    return format(new Date(d + "T12:00:00"), "dd/MM/yyyy");
  } catch {
    return d;
  }
};

export default function Index() {
  const { data: allExpenses = [], isLoading, addExpense, updateExpense, deleteExpense } = useExpenses();
  const [filters, setFilters] = useState({
    search: "",
    fatura: "all",
    banco: "all",
    cartao: "all",
    classificacao: "all",
  });
  const [formOpen, setFormOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense | null; direction: "asc" | "desc" }>({
    key: "data",
    direction: "desc",
  });

  // Teto de Gastos
  const [budget, setBudget] = useState<number>(() => {
    const saved = localStorage.getItem("expense-budget");
    return saved ? Number(saved) : 3000;
  });
  const [tempBudget, setTempBudget] = useState(budget);

  const filteredAndSorted = useMemo(() => {
    let result = allExpenses.filter((e) => {
      if (filters.fatura !== "all" && e.fatura !== filters.fatura) return false;
      if (filters.banco !== "all" && e.banco !== filters.banco) return false;
      if (filters.cartao !== "all" && e.cartao !== filters.cartao) return false;
      if (filters.classificacao !== "all" && e.classificacao !== filters.classificacao) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        return e.despesa?.toLowerCase().includes(s) || e.justificativa?.toLowerCase().includes(s);
      }
      return true;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key!];
        const bVal = b[sortConfig.key!];
        const rev = sortConfig.direction === "asc" ? 1 : -1;
        return aVal < bVal ? -1 * rev : 1 * rev;
      });
    }
    return result;
  }, [allExpenses, filters, sortConfig]);

  const totalSpent = useMemo(() => filteredAndSorted.reduce((acc, e) => acc + Number(e.valor), 0), [filteredAndSorted]);
  const remainingBudget = budget - totalSpent;

  const handleSaveBudget = () => {
    setBudget(tempBudget);
    localStorage.setItem("expense-budget", tempBudget.toString());
    setBudgetDialogOpen(false);
    toast.success("Teto de gastos atualizado!");
  };

  if (isLoading) return <div className="flex items-center justify-center h-screen">Carregando...</div>;

  return (
    <div className="min-h-screen bg-muted/30 pb-10">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-6 shadow-lg">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">💳 Controle de Gastos</h1>
            <p className="text-blue-100 text-sm">Gerencie suas finanças com precisão</p>
          </div>
          <div className="flex gap-2">
            <Button
              className="bg-white text-blue-600 hover:bg-blue-50"
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

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Superior: Teto e Filtros */}
        <div className="grid gap-4 md:grid-cols-12">
          {/* Card de Teto - Clicável */}
          <div
            className="md:col-span-4 rounded-xl border bg-white p-5 shadow-sm cursor-pointer hover:border-blue-400 transition-all group"
            onClick={() => {
              setTempBudget(budget);
              setBudgetDialogOpen(true);
            }}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                <Target size={12} /> Resumo do Orçamento
              </span>
              <Settings2
                size={14}
                className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Total Gasto</p>
                <p className="text-xl font-bold text-slate-800">{formatCurrency(totalSpent)}</p>
              </div>

              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground">Disponível (Teto: {formatCurrency(budget)})</p>
                <p
                  className={cn(
                    "text-2xl font-black tracking-tighter",
                    remainingBudget < 0 ? "text-red-600" : "text-emerald-600",
                  )}
                >
                  {remainingBudget < 0
                    ? `-${formatCurrency(Math.abs(remainingBudget))}`
                    : formatCurrency(remainingBudget)}
                </p>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="md:col-span-8 bg-white p-5 rounded-xl border shadow-sm flex flex-col justify-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar despesa ou justificativa..."
                className="pl-9 bg-muted/30 border-none"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filters.banco} onValueChange={(v) => setFilters((f) => ({ ...f, banco: v }))}>
                <SelectTrigger className="w-[140px] bg-muted/30 border-none">
                  <SelectValue placeholder="Banco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Bancos</SelectItem>
                  {/* unique values here */}
                </SelectContent>
              </Select>
              <Select
                value={filters.classificacao}
                onValueChange={(v) => setFilters((f) => ({ ...f, classificacao: v }))}
              >
                <SelectTrigger className="w-[140px] bg-muted/30 border-none">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Categorias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <SummaryCards expenses={filteredAndSorted} />

        <Tabs defaultValue="tabela">
          <TabsList className="bg-white border">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="tabela">Tabela de Gastos</TabsTrigger>
          </TabsList>

          <TabsContent value="tabela" className="mt-4">
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">BANCO</TableHead>
                    <TableHead className="text-right font-bold">VALOR</TableHead>
                    <TableHead className="font-bold">DATA</TableHead>
                    <TableHead className="font-bold">DESPESA</TableHead>
                    <TableHead className="font-bold">CATEGORIA</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.banco}</TableCell>
                      <TableCell className="text-right font-bold text-blue-600">
                        {formatCurrency(Number(e.valor))}
                      </TableCell>
                      <TableCell>{formatDate(e.data)}</TableCell>
                      <TableCell>{e.despesa}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {e.classificacao}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
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
                            className="h-8 w-8 text-red-500"
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

      {/* Popup para Definir Teto */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Configurar Teto de Gastos</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Limite Mensal Desejado</label>
              <Input
                type="number"
                value={tempBudget}
                onChange={(e) => setTempBudget(Number(e.target.value))}
                placeholder="Ex: 3000"
                className="text-lg font-bold"
              />
            </div>
            <p className="text-xs text-muted-foreground italic">
              Este valor será usado para calcular o quanto ainda resta do seu orçamento no card principal.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveBudget} className="bg-blue-600">
              Salvar Novo Teto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExpenseForm open={formOpen} onOpenChange={setFormOpen} initialData={editing} onSubmit={(data) => {}} />
    </div>
  );
}
