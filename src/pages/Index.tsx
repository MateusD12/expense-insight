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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Upload, Target, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
  Legend,
} from "recharts";
import { format, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLORS = [
  "#7c3aed", // Roxo (Itaú ..2596)
  "#06b6d4", // Ciano (Itaú ..6466)
  "#10b981", // Verde (NuBank ..9531)
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
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
  Casa: "bg-emerald-100 text-emerald-800",
  Carro: "bg-slate-100 text-slate-800",
};

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatFatura = (d: string | null) => {
  if (!d) return "-";
  try {
    return format(new Date(d + "T12:00:00"), "MMM/yy", { locale: ptBR });
  } catch {
    return d;
  }
};

export default function Index() {
  const { data: allExpenses = [], isLoading, addExpense, updateExpense, deleteExpense } = useExpenses();

  const [filters, setFilters] = useState({
    search: "",
    banco: "all",
    cartao: "all",
    classificacao: "all",
    justificativa: "all",
    fatura: "all",
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
    return saved ? Number(saved) : 4000;
  });
  const [tempBudget, setTempBudget] = useState(budget);

  const filteredAndSorted = useMemo(() => {
    let result = allExpenses.filter((e) => {
      const matchSearch =
        e.despesa?.toLowerCase().includes(filters.search.toLowerCase()) ||
        e.justificativa?.toLowerCase().includes(filters.search.toLowerCase());
      const matchBanco = filters.banco === "all" || e.banco === filters.banco;
      const matchCartao = filters.cartao === "all" || e.cartao === filters.cartao;
      const matchCat = filters.classificacao === "all" || e.classificacao === filters.classificacao;
      const matchJust = filters.justificativa === "all" || e.justificativa === filters.justificativa;
      const matchFatura = filters.fatura === "all" || e.fatura === filters.fatura;

      let matchDate = true;
      if (filters.dataInicio && filters.dataFim && e.data) {
        const date = parseISO(e.data);
        matchDate = isWithinInterval(date, {
          start: parseISO(filters.dataInicio),
          end: parseISO(filters.dataFim),
        });
      }

      return matchSearch && matchBanco && matchCartao && matchCat && matchJust && matchFatura && matchDate;
    });

    result.sort((a, b) => {
      const aVal = a[sortConfig.key] ?? "";
      const bVal = b[sortConfig.key] ?? "";
      const rev = sortConfig.direction === "asc" ? 1 : -1;
      return aVal < bVal ? -1 * rev : 1 * rev;
    });

    return result;
  }, [allExpenses, filters, sortConfig]);

  const unique = (key: keyof Expense) =>
    [...new Set(allExpenses.map((e) => e[key]).filter(Boolean) as string[])].sort();
  const cartoes =
    filters.banco === "all"
      ? unique("cartao")
      : [...new Set(allExpenses.filter((e) => e.banco === filters.banco).map((e) => e.cartao))].sort();

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAndSorted.forEach((e) => {
      const key = `${e.banco} ••${e.cartao}`;
      map[key] = (map[key] || 0) + Number(e.valor);
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
      .map(([f, valor]) => ({
        name: format(new Date(f + "T12:00:00"), "MMM/yy", { locale: ptBR }),
        valor: Math.round(valor * 100) / 100,
      }));
  }, [filteredAndSorted]);

  const topClassificacao = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAndSorted.forEach((e) => {
      if (e.classificacao) map[e.classificacao] = (map[e.classificacao] || 0) + Number(e.valor);
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, valor]) => ({ name, valor }));
  }, [filteredAndSorted]);

  const topJustificativa = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAndSorted.forEach((e) => {
      if (e.justificativa) map[e.justificativa] = (map[e.justificativa] || 0) + Number(e.valor);
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, valor]) => ({ name, valor }));
  }, [filteredAndSorted]);

  const totalSpent = useMemo(() => filteredAndSorted.reduce((acc, e) => acc + Number(e.valor), 0), [filteredAndSorted]);
  const uniqueBancos = new Set(filteredAndSorted.map((e) => e.banco)).size;
  const uniqueCats = new Set(filteredAndSorted.map((e) => e.classificacao)).size;
  const remainingBudget = budget - totalSpent;

  const handleSort = (key: keyof Expense) => {
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  };

  const getSortIcon = (key: keyof Expense) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={12} className="ml-1 opacity-30 inline" />;
    return sortConfig.direction === "asc" ? (
      <ArrowUp size={12} className="ml-1 inline" />
    ) : (
      <ArrowDown size={12} className="ml-1 inline" />
    );
  };

  if (isLoading)
    return <div className="h-screen flex items-center justify-center font-bold text-slate-500">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-8">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">💳 Controle de Gastos</h1>
            <p className="text-blue-100 text-sm mt-1">Acompanhamento mensal dos gastos no cartão de crédito</p>
          </div>
          <div className="flex gap-2">
            <Button
              className="bg-white/20 hover:bg-white/30 text-white border-none"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Novo Gasto
            </Button>
            <Button className="bg-white/20 hover:bg-white/30 text-white border-none">
              <Upload className="mr-2 h-4 w-4" /> Importar Planilha
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 mt-6 space-y-6">
        {/* BARRA DE FILTROS COM JUSTIFICATIVA */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Input
              className="pl-4 h-10"
              placeholder="Buscar despesa..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          <Select value={filters.banco} onValueChange={(v) => setFilters((f) => ({ ...f, banco: v, cartao: "all" }))}>
            <SelectTrigger className="w-[140px] h-10">
              <SelectValue placeholder="Bancos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos bancos</SelectItem>
              {unique("banco").map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.cartao} onValueChange={(v) => setFilters((f) => ({ ...f, cartao: v }))}>
            <SelectTrigger className="w-[140px] h-10">
              <SelectValue placeholder="Cartões" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos cartões</SelectItem>
              {cartoes.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.classificacao} onValueChange={(v) => setFilters((f) => ({ ...f, classificacao: v }))}>
            <SelectTrigger className="w-[140px] h-10">
              <SelectValue placeholder="Categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {unique("classificacao").map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.justificativa} onValueChange={(v) => setFilters((f) => ({ ...f, justificativa: v }))}>
            <SelectTrigger className="w-[140px] h-10">
              <SelectValue placeholder="Justificativa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {unique("justificativa").map((j) => (
                <SelectItem key={j} value={j}>
                  {j}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.fatura} onValueChange={(v) => setFilters((f) => ({ ...f, fatura: v }))}>
            <SelectTrigger className="w-[140px] h-10">
              <SelectValue placeholder="Faturas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas faturas</SelectItem>
              {unique("fatura").map((f) => (
                <SelectItem key={f} value={f}>
                  {formatFatura(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* INDICADORES EM GRID */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-[#3b82f6] text-white rounded-xl p-5 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-medium opacity-90">Total em Gastos</p>
            <h2 className="text-2xl font-bold mt-1">{formatCurrency(totalSpent)}</h2>
          </div>

          <div
            className={cn(
              "text-white rounded-xl p-5 shadow-sm flex flex-col justify-center cursor-pointer hover:brightness-110 transition-all",
              remainingBudget < 0 ? "bg-red-500" : "bg-[#8b5cf6]",
            )}
            onClick={() => {
              setTempBudget(budget);
              setBudgetDialogOpen(true);
            }}
            title="Clique para ajustar o teto de gastos"
          >
            <div className="flex justify-between items-center opacity-90">
              <p className="text-sm font-medium">Saldo do Teto</p>
              <Target size={16} />
            </div>
            <h2 className="text-2xl font-bold mt-1">{formatCurrency(remainingBudget)}</h2>
          </div>

          <div className="bg-[#10b981] text-white rounded-xl p-5 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-medium opacity-90">Transações</p>
            <h2 className="text-2xl font-bold mt-1">{filteredAndSorted.length}</h2>
          </div>

          <div className="bg-[#14b8a6] text-white rounded-xl p-5 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-medium opacity-90">Bancos</p>
            <h2 className="text-2xl font-bold mt-1">{uniqueBancos}</h2>
          </div>

          <div className="bg-[#f97316] text-white rounded-xl p-5 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-medium opacity-90">Categorias</p>
            <h2 className="text-2xl font-bold mt-1">{uniqueCats}</h2>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="bg-transparent space-x-2 p-0 mb-6">
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg border border-slate-200"
            >
              ☷ Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="tabela"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg border border-slate-200"
            >
              ⊞ Tabela
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-600 mb-6 uppercase">Gastos por Banco / Cartão</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend iconType="square" wrapperStyle={{ fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-600 mb-6 uppercase">Evolução por Fatura</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={areaData}>
                    <defs>
                      <linearGradient id="colorPurple" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-xs text-slate-500" />
                    <YAxis
                      tickFormatter={(v) => `R$${v / 1000}k`}
                      axisLine={false}
                      tickLine={false}
                      className="text-xs text-slate-500"
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Area type="monotone" dataKey="valor" stroke="#8b5cf6" fill="url(#colorPurple)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <RankedList data={topClassificacao} title="Top 10 por Categoria" />
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <RankedList data={topJustificativa} title="Top 10 por Justificativa" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tabela">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="cursor-pointer font-medium" onClick={() => handleSort("banco")}>
                      Banco {getSortIcon("banco")}
                    </TableHead>
                    <TableHead className="cursor-pointer font-medium" onClick={() => handleSort("cartao")}>
                      Cartão {getSortIcon("cartao")}
                    </TableHead>
                    <TableHead className="cursor-pointer font-medium text-right" onClick={() => handleSort("valor")}>
                      Valor {getSortIcon("valor")}
                    </TableHead>
                    <TableHead className="cursor-pointer font-medium" onClick={() => handleSort("data")}>
                      Data {getSortIcon("data")}
                    </TableHead>
                    <TableHead className="font-medium">Parcela</TableHead>
                    <TableHead className="cursor-pointer font-medium" onClick={() => handleSort("despesa")}>
                      Despesa {getSortIcon("despesa")}
                    </TableHead>
                    <TableHead className="font-medium">Categoria</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.banco}</TableCell>
                      <TableCell className="text-slate-500 text-xs">••{e.cartao}</TableCell>
                      <TableCell className="text-right font-medium text-blue-600">
                        {formatCurrency(Number(e.valor))}
                      </TableCell>
                      <TableCell className="text-slate-600">{format(parseISO(e.data), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-slate-600">
                        {e.parcela > 0 ? `${e.parcela}/${e.total_parcela}` : "-"}
                      </TableCell>
                      <TableCell>{e.despesa}</TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            BADGE_COLORS[e.classificacao] || "bg-slate-100 text-slate-800",
                            "font-medium border-none",
                          )}
                        >
                          {e.classificacao}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-500"
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

      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Ajustar Teto Mensal</DialogTitle>
            <DialogDescription>Defina o valor máximo que você deseja gastar este mês.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              value={tempBudget}
              onChange={(e) => setTempBudget(Number(e.target.value))}
              className="text-2xl font-bold"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setBudget(tempBudget);
                localStorage.setItem("expense-budget", tempBudget.toString());
                setBudgetDialogOpen(false);
                toast.success("Teto atualizado!");
              }}
              className="bg-blue-600"
            >
              Salvar Novo Teto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o gasto do seu controle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) {
                  deleteExpense.mutate(deleting, {
                    onSuccess: () => {
                      toast.success("Gasto excluído com sucesso!");
                      setDeleting(null);
                    },
                    onError: (error) => {
                      console.error("Erro ao excluir:", error);
                      toast.error("Ocorreu um erro ao excluir o gasto.");
                    },
                  });
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExpenseForm 
        open={formOpen} 
        onOpenChange={setFormOpen} 
        initialData={editing} 
        onSubmit={(data) => {
          // 1. Criamos um objeto "limpo" EXATAMENTE com as colunas que vimos na sua tabela
          // Se alguma dessas colunas não existir no seu Supabase, você precisa removê-la daqui!
          const payloadLimpo = {
            banco: data.banco || "",
            cartao: data.cartao || "",
            valor: Number(data.valor) || 0,
            data: data.data || new Date().toISOString().split('T')[0],
            despesa: data.despesa || "",
            classificacao: data.classificacao || "",
            justificativa: data.justificativa || "",
            parcela: Number(data.parcela) || 0,
            total_parcela: Number(data.total_parcela) || 0,
            // A CORREÇÃO ESTÁ AQUI: garantindo o formato YYYY-MM-DD
            fatura: data.fatura && data.fatura.length === 7 ? `${data.fatura}-01` : data.fatura || "", 
          };

          if (editing) {
            updateExpense.mutate({ id: editing.id, ...payloadLimpo }, {
              onSuccess: () => toast.success("Gasto atualizado!"),
              onError: (error) => {
                 console.error("Erro UPDATE:", error);
                 toast.error("Erro ao atualizar o gasto. Verifique os tipos de dados.");
              },
            });
          } else {
            addExpense.mutate(payloadLimpo, {
              onSuccess: () => toast.success("Gasto adicionado!"),
              onError: (error) => {
                 console.error("Erro INSERT:", error);
                 // Adicionamos um alert temporário pra você ver o erro exato na tela se falhar de novo
                 alert("Erro do Supabase: Verifique se sua tabela 'expenses' tem TODAS essas colunas: banco, cartao, valor, data, despesa, classificacao, justificativa, parcela, total_parcela, fatura.");
                 toast.error("Erro ao adicionar o gasto.");
              },
            });
          }
        }} 
      />
