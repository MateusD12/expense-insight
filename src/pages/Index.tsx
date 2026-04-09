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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  LogOut,
  Chrome,
  Wallet,
  Target,
  FilterX,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarClock,
  Zap,
  RotateCcw,
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

  const [filters, setFilters] = useState({
    search: "",
    banco: "all",
    classificacao: "all",
    justificativa: "all",
    fatura: "all",
  });
  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense; direction: "asc" | "desc" }>({
    key: "data",
    direction: "desc",
  });
  const [showFilters, setShowFilters] = useState(false);
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
    const currentMonth = startOfMonth(today);
    let list: any[] = [];

    allExpenses.forEach((exp) => {
      const isParcelado = exp.total_parcela && exp.total_parcela > 1;

      if (!isParcelado) {
        list.push({ ...exp, isProjecao: false });
      } else {
        // Se for parcelado, geramos as parcelas restantes para a visão futura
        const dataOriginal = new Date(exp.data);
        const total = exp.total_parcela || 1;
        const parcelaAtual = exp.parcela || 1;

        // Adiciona a parcela real que já existe no banco
        list.push({ ...exp, isProjecao: false });

        // Gera as parcelas "virtuais" seguintes para visualização
        if (viewMode === "future") {
          for (let i = 1; i <= total - parcelaAtual; i++) {
            list.push({
              ...exp,
              id: `${exp.id}-virtual-${i}`,
              parcela: parcelaAtual + i,
              data: format(addMonths(dataOriginal, i), "yyyy-MM-dd"),
              fatura: exp.fatura ? format(addMonths(new Date(exp.fatura), i), "yyyy-MM-dd") : null,
              isProjecao: true,
            });
          }
        }
      }
    });

    // Filtra baseado no modo (Fatura Atual vs Futuro)
    if (viewMode === "current") {
      const monthStr = format(today, "yyyy-MM");
      return list.filter((e) => !e.isProjecao && (e.fatura?.startsWith(monthStr) || e.data.startsWith(monthStr)));
    }

    return list;
  }, [allExpenses, viewMode]);

  const filteredAndSorted = useMemo(() => {
    let result = processedExpenses.filter((e) => {
      const matchSearch = e.despesa?.toLowerCase().includes(filters.search.toLowerCase());
      const matchBanco = filters.banco === "all" || e.banco === filters.banco;
      const matchFatura = filters.fatura === "all" || (e.fatura ? e.fatura.slice(0, 7) : "all") === filters.fatura;
      return matchSearch && matchBanco && matchFatura;
    });

    result.sort((a: any, b: any) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (sortConfig.key === "valor") return sortConfig.direction === "asc" ? a.valor - b.valor : b.valor - a.valor;
      return sortConfig.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    return result;
  }, [processedExpenses, filters, sortConfig]);

  const totalSpent = useMemo(() => filteredAndSorted.reduce((acc, e) => acc + Number(e.valor), 0), [filteredAndSorted]);

  const handleAntecipar = async (expense: Expense) => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    // Salvamos a data original na justificativa caso queira voltar atrás
    const novaJustificativa = `[ANTECIPADO original:${expense.data}] ${expense.justificativa || ""}`;

    await updateExpense.mutateAsync({
      id: expense.id,
      data: todayStr,
      fatura: todayStr,
      justificativa: novaJustificativa,
    });
    toast.success("Parcela antecipada para esta fatura!");
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
      toast.info("Parcela retornada ao cronograma original.");
    }
  };

  if (isCheckingAuth)
    return (
      <div className="h-screen flex items-center justify-center font-bold text-slate-400 italic">
        Carregando Finanças...
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-4 py-6 shadow-lg">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-white/20">
              <AvatarFallback className="bg-blue-900 font-bold">M</AvatarFallback>
            </Avatar>
            <h1 className="text-lg font-black uppercase tracking-tight">Finanças Mateus</h1>
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
            <Button
              className="bg-white text-blue-700 hover:bg-blue-50 font-black h-10"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus size={18} />
            </Button>
            <Button variant="ghost" onClick={() => supabase.auth.signOut()} className="text-white h-10">
              <LogOut size={20} />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 mt-6 space-y-4">
        {/* CARDS DE RESUMO */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-600 text-white rounded-2xl p-5 shadow-md">
            <p className="text-[10px] font-black opacity-70 uppercase mb-1">
              {viewMode === "current" ? "Total Fatura Atual" : "Total Projetado"}
            </p>
            <h2 className="text-2xl font-black">{formatCurrency(totalSpent)}</h2>
          </div>
          <div className="bg-slate-800 text-white rounded-2xl p-5 shadow-md">
            <p className="text-[10px] font-black opacity-70 uppercase mb-1">Itens na Lista</p>
            <h2 className="text-2xl font-black">{filteredAndSorted.length}</h2>
          </div>
          {budget && (
            <div
              className={cn(
                "rounded-2xl p-5 shadow-md text-white",
                totalSpent > budget ? "bg-red-500" : "bg-emerald-500",
              )}
            >
              <p className="text-[10px] font-black opacity-70 uppercase mb-1">Saldo do Teto</p>
              <h2 className="text-2xl font-black">{formatCurrency(budget - totalSpent)}</h2>
            </div>
          )}
        </div>

        {/* TABELA DE GASTOS */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-black uppercase text-xs text-slate-500 tracking-widest">
              {viewMode === "current" ? "Lançamentos do Mês" : "Cronograma de Faturas Futuras"}
            </h3>
            <div className="flex gap-2">
              <Input
                className="h-8 text-xs w-40 sm:w-64 bg-white"
                placeholder="Filtrar despesa..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black text-[10px] uppercase">Data/Fatura</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Descrição</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-center">Parcela</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-right">Valor</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSorted.map((e) => {
                  const isAntecipado = e.justificativa?.includes("[ANTECIPADO");
                  return (
                    <TableRow
                      key={e.id}
                      className={cn(
                        "group transition-colors",
                        e.isProjecao ? "bg-amber-50/30 italic text-slate-500" : "hover:bg-blue-50/50",
                      )}
                    >
                      <TableCell className="text-xs font-bold">
                        {format(parseISO(e.data), "dd/MM/yy")}
                        {e.fatura && (
                          <span className="block text-[9px] text-blue-500 font-black uppercase">
                            Fatura: {formatFatura(e.fatura)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800">{e.despesa}</span>
                          {isAntecipado && (
                            <Zap size={12} className="text-amber-500 fill-amber-500" title="Parcela Antecipada" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block">{e.justificativa || "-"}</span>
                      </TableCell>
                      <TableCell className="text-center font-black text-xs text-slate-400">
                        {e.total_parcela > 1 ? `${e.parcela}/${e.total_parcela}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-black text-blue-600">
                        {formatCurrency(Number(e.valor))}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          {/* Botão de Antecipar (Só aparece para parcelas futuras reais) */}
                          {viewMode === "future" && !e.isProjecao && !isAntecipado && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:bg-amber-100"
                              onClick={() => handleAntecipar(e)}
                            >
                              <Zap size={14} />
                            </Button>
                          )}
                          {/* Botão de Estornar Antecipação */}
                          {isAntecipado && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:bg-blue-100"
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
            {filteredAndSorted.length === 0 && (
              <div className="p-10 text-center text-slate-400 font-bold italic">
                Nenhum gasto encontrado para este período.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAIS E FORMS (Mantidos como estavam) */}
      <ExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editing}
        onSubmit={(data) => {
          if (!session?.user?.id) return;
          const payload = { ...data, valor: Number(data.valor), user_id: session.user.id };
          if (editing) updateExpense.mutate({ id: editing.id, ...payload }, { onSuccess: () => setFormOpen(false) });
          else addExpense.mutate(payload, { onSuccess: () => setFormOpen(false) });
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black">Remover despesa?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 font-black"
              onClick={() => {
                if (deleting) deleteExpense.mutate(deleting, { onSuccess: () => setDeleting(null) });
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
