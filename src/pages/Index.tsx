import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExpenses, type Expense } from "@/hooks/useExpenses";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Pencil, Trash2, LogOut, Wallet, CalendarClock, Zap, RotateCcw, Filter } from "lucide-react";
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
  BarChart,
  Bar,
} from "recharts";
import { format, parseISO, addMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLORS = ["#7c3aed", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];

const BADGE_COLORS: Record<string, string> = {
  Estudos: "bg-blue-100 text-blue-800 border-blue-200",
  Saúde: "bg-red-100 text-red-800 border-red-200",
  Lazer: "bg-purple-100 text-purple-800 border-purple-200",
  Alimentação: "bg-orange-100 text-orange-800 border-orange-200",
  Compras: "bg-pink-100 text-pink-800 border-pink-200",
  Transporte: "bg-green-100 text-green-800 border-green-200",
  Assinatura: "bg-indigo-100 text-indigo-800 border-indigo-200",
  Presente: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Casa: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Carro: "bg-cyan-100 text-cyan-800 border-cyan-200",
  "Vida Pessoal": "bg-rose-100 text-rose-800 border-rose-200",
};

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatFatura = (d: string | null) => {
  if (!d) return "-";
  try {
    return format(new Date(d.substring(0, 7) + "-01T12:00:00"), "MMM/yy", { locale: ptBR });
  } catch {
    return d;
  }
};

export default function Index() {
  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [viewMode, setViewMode] = useState<"current" | "future">("current");

  const [budget, setBudget] = useState<number | null>(null);
  const [tempBudget, setTempBudget] = useState<number>(0);

  const { data: allExpenses = [], addExpense, updateExpense, deleteExpense } = useExpenses();

  const [filters, setFilters] = useState({ search: "", banco: "all", fatura: "all" });
  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense; direction: "asc" | "desc" }>({
    key: "data",
    direction: "desc",
  });
  const [formOpen, setFormOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      setIsCheckingAuth(false);
    });
  }, []);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase
      .from("profiles" as any)
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (data) setBudget(Number((data as any).budget));
  };

  const handleSaveBudget = async () => {
    if (!session?.user?.id) return;
    await supabase.from("profiles" as any).upsert({ id: session.user.id, budget: tempBudget } as any);
    setBudget(tempBudget);
    setBudgetDialogOpen(false);
    toast.success("Teto atualizado!");
  };

  // --- LÓGICA DE PROJEÇÃO DE PARCELAS ---
  const processedExpenses = useMemo(() => {
    const today = new Date();
    let list: any[] = [];

    allExpenses.forEach((exp) => {
      list.push({ ...exp, isProjecao: false });
      if (exp.total_parcela && exp.total_parcela > 1 && viewMode === "future") {
        const dataOriginal = new Date(exp.data);
        for (let i = 1; i <= exp.total_parcela - exp.parcela; i++) {
          list.push({
            ...exp,
            id: `${exp.id}-virtual-${i}`,
            parcela: exp.parcela + i,
            data: format(addMonths(dataOriginal, i), "yyyy-MM-dd"),
            fatura: exp.fatura ? format(addMonths(new Date(exp.fatura), i), "yyyy-MM-dd") : null,
            isProjecao: true,
          });
        }
      }
    });

    if (viewMode === "current") {
      const monthStr = format(today, "yyyy-MM");
      return list.filter((e) => !e.isProjecao && (e.fatura?.startsWith(monthStr) || e.data.startsWith(monthStr)));
    }
    return list;
  }, [allExpenses, viewMode]);

  const filteredAndSorted = useMemo(() => {
    let result = processedExpenses.filter((e) => {
      const matchSearch =
        e.despesa?.toLowerCase().includes(filters.search.toLowerCase()) ||
        e.justificativa?.toLowerCase().includes(filters.search.toLowerCase());
      const matchBanco = filters.banco === "all" || e.banco === filters.banco;
      const matchFatura = filters.fatura === "all" || (e.fatura ? e.fatura.slice(0, 7) : "all") === filters.fatura;
      return matchSearch && matchBanco && matchFatura;
    });

    result.sort((a: any, b: any) => {
      if (sortConfig.key === "valor") return sortConfig.direction === "asc" ? a.valor - b.valor : b.valor - a.valor;
      return sortConfig.direction === "asc"
        ? String(a[sortConfig.key]).localeCompare(String(b[sortConfig.key]))
        : String(b[sortConfig.key]).localeCompare(String(a[sortConfig.key]));
    });
    return result;
  }, [processedExpenses, filters, sortConfig]);

  const chartData = useMemo(() => {
    const banks: Record<string, number> = {};
    const temporal: Record<string, number> = {};
    const cats: Record<string, number> = {};
    const justs: Record<string, number> = {};

    filteredAndSorted.forEach((e) => {
      const val = Number(e.valor);
      const bankKey = e.banco ? `${e.banco}${e.cartao ? " ••" + e.cartao : ""}` : "Desconhecido";
      banks[bankKey] = (banks[bankKey] || 0) + val;
      cats[e.classificacao || "Outros"] = (cats[e.classificacao || "Outros"] || 0) + val;
      justs[e.justificativa || "Sem Justificativa"] = (justs[e.justificativa || "Sem Justificativa"] || 0) + val;
      if (e.fatura) {
        const f = e.fatura.slice(0, 7);
        temporal[f] = (temporal[f] || 0) + val;
      }
    });

    return {
      banks: Object.entries(banks).map(([name, value]) => ({ name, value })),
      cats: Object.entries(cats)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value })),
      justs: Object.entries(justs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, value]) => ({ name, value })),
      temporal: Object.entries(temporal)
        .sort()
        .map(([f, valor]) => ({
          name: format(new Date(f + "-01T12:00:00"), "MMM/yy", { locale: ptBR }),
          valor,
        })),
    };
  }, [filteredAndSorted]);

  const totalSpent = useMemo(() => filteredAndSorted.reduce((acc, e) => acc + Number(e.valor), 0), [filteredAndSorted]);

  const handleAntecipar = async (expense: Expense) => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const novaJustificativa = `[ANTECIPADO original:${expense.data}] ${expense.justificativa || ""}`;
    await updateExpense.mutateAsync({
      id: expense.id,
      data: todayStr,
      fatura: todayStr,
      justificativa: novaJustificativa,
    });
    toast.success("Parcela antecipada!");
  };

  const handleEstornarAntecipacao = async (expense: Expense) => {
    const match = expense.justificativa?.match(/original:(\d{4}-\d{2}-\d{2})/);
    if (match) {
      const dataOriginal = match[1];
      const limpaJustificativa = expense.justificativa?.replace(/\[ANTECIPADO original:.*?\] /, "");
      await updateExpense.mutateAsync({
        id: expense.id,
        data: dataOriginal,
        fatura: dataOriginal,
        justificativa: limpaJustificativa,
      });
      toast.info("Retornado ao cronograma original.");
    }
  };

  const truncate = (str: string) => (str.length > 15 ? str.substring(0, 15) + "..." : str);

  if (isCheckingAuth)
    return (
      <div className="h-screen flex items-center justify-center font-bold text-slate-400 italic">Carregando...</div>
    );

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-900 text-white px-4 py-6 shadow-lg">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-white/20">
              <AvatarFallback className="bg-blue-900 font-bold">M</AvatarFallback>
            </Avatar>
            <h1 className="text-lg font-black uppercase tracking-tighter">Finanças Mateus</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "future" ? "secondary" : "outline"}
              className={cn("h-10 font-bold", viewMode === "future" && "bg-amber-400 text-amber-900 border-none")}
              onClick={() => setViewMode(viewMode === "current" ? "future" : "current")}
            >
              <CalendarClock size={18} className="mr-2" />
              {viewMode === "current" ? "Ver Futuros" : "Fatura Atual"}
            </Button>
            <Button className="bg-white text-blue-700 font-black h-10" onClick={() => setFormOpen(true)}>
              <Plus size={18} />
            </Button>
            <Button variant="ghost" onClick={() => supabase.auth.signOut()} className="text-white">
              <LogOut size={20} />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 mt-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-600 text-white rounded-2xl p-5 shadow-lg">
            <p className="text-[10px] font-black opacity-80 uppercase mb-1">Total</p>
            <h2 className="text-xl font-black">{formatCurrency(totalSpent)}</h2>
          </div>
          <div className="bg-slate-800 text-white rounded-2xl p-5 shadow-lg">
            <p className="text-[10px] font-black opacity-80 uppercase mb-1">Itens</p>
            <h2 className="text-xl font-black">{filteredAndSorted.length}</h2>
          </div>
          <div
            className={cn(
              "text-white rounded-2xl p-5 shadow-lg cursor-pointer",
              budget && totalSpent > budget ? "bg-red-500" : "bg-emerald-500",
            )}
            onClick={() => setBudgetDialogOpen(true)}
          >
            <p className="text-[10px] font-black uppercase mb-1">Saldo Teto</p>
            <h2 className="text-xl font-black">{budget ? formatCurrency(budget - totalSpent) : "Definir"}</h2>
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="bg-white p-1 mb-6 rounded-2xl w-full sm:w-fit flex shadow-sm border border-slate-100">
            <TabsTrigger
              value="dashboard"
              className="px-8 py-2 font-black rounded-xl data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
            >
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="tabela"
              className="px-8 py-2 font-black rounded-xl data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
            >
              Tabela
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-[10px] font-black text-slate-600 mb-4 uppercase tracking-widest text-center">
                  Bancos
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={chartData.banks}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="50%"
                      outerRadius="80%"
                      paddingAngle={3}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {chartData.banks.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-[10px] font-black text-slate-600 mb-4 uppercase tracking-widest text-center">
                  Evolução Mensal
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData.temporal} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.1}
                      strokeWidth={4}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-[10px] font-black text-slate-600 mb-4 uppercase tracking-widest">
                Classificação de Gastos
              </h3>
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.cats.length * 35)}>
                <BarChart data={chartData.cats} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fontSize: 10, fontWeight: "bold" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={truncate}
                  />
                  <Tooltip formatter={(v: any) => formatCurrency(v)} />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-[10px] font-black text-slate-600 mb-4 uppercase tracking-widest">
                Top Justificativas
              </h3>
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.justs.length * 35)}>
                <BarChart data={chartData.justs} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fontSize: 10, fontWeight: "bold" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={truncate}
                  />
                  <Tooltip formatter={(v: any) => formatCurrency(v)} />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="tabela">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 bg-slate-50 flex justify-between items-center">
                <h3 className="font-black uppercase text-xs text-slate-500">
                  {viewMode === "current" ? "Lançamentos do Mês" : "Cronograma de Projeções"}
                </h3>
                <Input
                  className="h-8 text-xs w-48 bg-white"
                  placeholder="Filtrar..."
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-black text-[10px]">DATA/FATURA</TableHead>
                    <TableHead className="font-black text-[10px]">DESCRIÇÃO</TableHead>
                    <TableHead className="font-black text-[10px] text-center">PARCELA</TableHead>
                    <TableHead className="font-black text-[10px] text-right">VALOR</TableHead>
                    <TableHead className="font-black text-[10px] text-center">AÇÕES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((e) => {
                    const isAntecipado = e.justificativa?.includes("[ANTECIPADO");
                    return (
                      <TableRow key={e.id} className={cn(e.isProjecao && "bg-amber-50/20 italic text-slate-500")}>
                        <TableCell className="text-xs font-bold">
                          {format(parseISO(e.data), "dd/MM/yy")}
                          {e.fatura && <span className="block text-[9px] text-blue-500">{formatFatura(e.fatura)}</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm block">{e.despesa}</span>
                            {isAntecipado && <Zap size={12} className="text-amber-500" />}
                          </div>
                          <span className="text-[10px] text-slate-400">{e.justificativa}</span>
                        </TableCell>
                        <TableCell className="text-center font-black text-xs text-slate-400">
                          {e.total_parcela > 1 ? `${e.parcela}/${e.total_parcela}` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-black text-blue-600">
                          {formatCurrency(Number(e.valor))}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            {viewMode === "future" && !e.isProjecao && !isAntecipado && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-500"
                                onClick={() => handleAntecipar(e)}
                              >
                                <Zap size={14} />
                              </Button>
                            )}
                            {isAntecipado && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-500"
                                onClick={() => handleEstornarAntecipacao(e)}
                              >
                                <RotateCcw size={14} />
                              </Button>
                            )}
                            {!e.isProjecao && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400"
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
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent className="rounded-3xl border-none">
          <DialogHeader>
            <DialogTitle className="font-black text-center text-blue-900 uppercase">Teto de Gastos</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <Input
              type="number"
              value={tempBudget}
              onChange={(e) => setTempBudget(Number(e.target.value))}
              className="text-4xl font-black text-center h-20 bg-blue-50 border-none rounded-2xl"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSaveBudget} className="w-full bg-blue-600 font-black h-14 rounded-2xl">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editing}
        onSubmit={(data) => {
          if (!session?.user?.id) return;
          if (editing)
            updateExpense.mutate(
              { id: editing.id, ...data, valor: Number(data.valor), user_id: session.user.id },
              { onSuccess: () => setFormOpen(false) },
            );
          else
            addExpense.mutate(
              { ...data, valor: Number(data.valor), user_id: session.user.id },
              { onSuccess: () => setFormOpen(false) },
            );
        }}
      />
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black">Excluir?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 font-black"
              onClick={() => {
                if (deleting) deleteExpense.mutate(deleting, { onSuccess: () => setDeleting(null) });
              }}
            >
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
