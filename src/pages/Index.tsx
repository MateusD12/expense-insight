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
import { format, parseISO } from "date-fns";
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

  const [budget, setBudget] = useState<number | null>(null);
  const [tempBudget, setTempBudget] = useState<number>(0);

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup" | "recovery">("login");

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
  const [installmentFilter, setInstallmentFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense; direction: "asc" | "desc" }>({
    key: "data",
    direction: "desc",
  });
  const [showFilters, setShowFilters] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      setIsCheckingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase
      .from("profiles" as any)
      .select("*")
      .eq("id", uid)
      .single();
    if (data && (data as any).budget !== undefined) setBudget(Number((data as any).budget));
    else setBudget(null);
  };

  const handleSaveBudget = async () => {
    if (!session?.user?.id) return;
    const { error } = await supabase.from("profiles" as any).upsert({ id: session.user.id, budget: tempBudget } as any);
    if (!error) {
      setBudget(tempBudget);
      setBudgetDialogOpen(false);
      toast.success("Teto atualizado!");
    } else {
      toast.error("Erro ao salvar.");
    }
  };

  const loginWithGoogle = () => {
    supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      } else if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        toast.success("Verifique seu e-mail!");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
        const headers = lines[0]
          .toLowerCase()
          .replace(/^\ufeff/, "")
          .replace(/"/g, "")
          .split(";")
          .map((h) => h.trim());
        const parsed = lines.slice(1).map((line) => {
          const values = line.split(";");
          const obj: any = {};
          headers.forEach((h, i) => {
            let v = values[i]?.replace(/^"|"$/g, "").trim();
            if (h.includes("valor") && v) v = v.replace(",", ".");
            obj[h] = v;
          });
          return obj;
        });
        setImportPreview(parsed);
        setShowImportDialog(true);
      } catch (err) {
        toast.error("Erro no arquivo CSV.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const safeString = (val: any) => (val !== null && val !== undefined ? String(val).trim() : "");

  const confirmImport = async () => {
    if (!session?.user?.id) return;
    try {
      for (const item of importPreview) {
        let dataSegura = safeString(item.data);
        if (dataSegura.includes("/")) {
          const p = dataSegura.split("/");
          if (p.length === 3) dataSegura = `${p[2]}-${p[1]}-${p[0]}`;
        }
        let faturaSegura = null;
        const faturaRaw = safeString(item.fatura);
        if (faturaRaw !== "") faturaSegura = faturaRaw.length === 7 ? `${faturaRaw}-01` : faturaRaw;

        const payload = {
          banco: safeString(item.banco) || "Desconhecido",
          cartao: safeString(item.cartao),
          valor: Number(safeString(item.valor)) || 0,
          data: dataSegura || new Date().toISOString().split("T")[0],
          despesa: safeString(item.despesa) || "Importado",
          classificacao: safeString(item.classificacao) || "Outros",
          justificativa: safeString(item.justificativa),
          parcela: Number(item.parcela) || 1,
          total_parcela: Number(item.total_parcelas || item.total_parcela) || 1,
          fatura: faturaSegura,
          user_id: session.user.id,
        };
        await addExpense.mutateAsync(payload);
      }
      toast.success("Importação concluída!");
      setShowImportDialog(false);
      setImportPreview([]);
    } catch (err) {
      toast.error("Erro ao importar.");
    }
  };

  const normalizedExpenses = useMemo(() => {
    return allExpenses.map((e) => ({
      ...e,
      parcela: e.parcela && e.parcela > 0 ? e.parcela : 1,
      total_parcela: e.total_parcela && e.total_parcela > 0 ? e.total_parcela : 1,
    }));
  }, [allExpenses]);

  const unique = (key: keyof Expense) =>
    [
      ...new Set(
        normalizedExpenses
          .map((e) => (key === "fatura" && e[key] ? (e[key] as string).slice(0, 7) : e[key]))
          .filter(Boolean) as string[],
      ),
    ].sort();

  const filteredAndSorted = useMemo(() => {
    let result = normalizedExpenses.filter((e) => {
      const matchSearch =
        e.despesa?.toLowerCase().includes(filters.search.toLowerCase()) ||
        e.justificativa?.toLowerCase().includes(filters.search.toLowerCase());
      const matchBanco = filters.banco === "all" || e.banco === filters.banco;
      const matchCat = filters.classificacao === "all" || e.classificacao === filters.classificacao;
      const matchJust = filters.justificativa === "all" || e.justificativa === filters.justificativa;
      const matchFatura = filters.fatura === "all" || (e.fatura ? e.fatura.slice(0, 7) : "all") === filters.fatura;
      const matchDataInicio = !filters.dataInicio || e.data >= filters.dataInicio;
      const matchDataFim = !filters.dataFim || e.data <= filters.dataFim;
      return matchSearch && matchBanco && matchCat && matchJust && matchFatura && matchDataInicio && matchDataFim;
    });

    result.sort((a: any, b: any) => {
      if (sortConfig.key === "valor")
        return sortConfig.direction === "asc" ? Number(a.valor) - Number(b.valor) : Number(b.valor) - Number(a.valor);
      if (sortConfig.key === "data")
        return sortConfig.direction === "asc"
          ? new Date(a.data).getTime() - new Date(b.data).getTime()
          : new Date(b.data).getTime() - new Date(a.data).getTime();
      const aVal = String(a[sortConfig.key] || "").toLowerCase();
      const bVal = String(b[sortConfig.key] || "").toLowerCase();
      return sortConfig.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return result;
  }, [normalizedExpenses, filters, sortConfig]);

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
        .map(([name, value]) => ({ name, value })),
      temporal: Object.entries(temporal)
        .sort()
        .map(([f, valor]) => ({
          name: format(new Date(f + "-01T12:00:00"), "MMM/yy", { locale: ptBR }),
          valor,
        })),
    };
  }, [filteredAndSorted]);

  const installmentsData = useMemo(() => {
    let data = filteredAndSorted.filter((e) => e.total_parcela > 1);
    const uniqueJust = [...new Set(data.map((e) => e.justificativa))].filter(Boolean) as string[];
    if (installmentFilter !== "all") data = data.filter((e) => e.justificativa === installmentFilter);
    const latestInstallments: Record<string, any> = {};
    data.forEach((e) => {
      const key = e.justificativa || e.despesa || "Sem info";
      if (!latestInstallments[key] || e.parcela > latestInstallments[key].parcela) latestInstallments[key] = e;
    });
    return {
      data: Object.values(latestInstallments).map((e) => ({
        name: `${e.justificativa || e.despesa} (${e.parcela}/${e.total_parcela})`,
        Pagas: e.parcela - 1,
        Restantes: e.total_parcela - (e.parcela - 1),
      })),
      options: uniqueJust,
    };
  }, [filteredAndSorted, installmentFilter]);

  const totalSpent = useMemo(() => filteredAndSorted.reduce((acc, e) => acc + Number(e.valor), 0), [filteredAndSorted]);

  const handleBankClick = (data: any) => {
    const parts = data.name.split(" ••");
    setFilters((prev) => ({ ...prev, banco: prev.banco === parts[0] ? "all" : parts[0] }));
  };

  const handleCatClick = (data: any) => {
    setFilters((prev) => ({ ...prev, classificacao: prev.classificacao === data.name ? "all" : data.name }));
  };

  const renderSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={10} className="opacity-30 inline-block ml-1" />;
    return sortConfig.direction === "asc" ? (
      <ArrowUp size={10} className="inline-block ml-1 text-blue-600" />
    ) : (
      <ArrowDown size={10} className="inline-block ml-1 text-blue-600" />
    );
  };

  if (isCheckingAuth)
    return (
      <div className="h-screen flex items-center justify-center font-bold text-slate-400 italic">
        Validando acesso...
      </div>
    );

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-br from-blue-600 to-purple-700 p-10 text-center text-white">
            <Wallet size={48} className="mx-auto mb-4" />
            <h1 className="text-3xl font-black uppercase tracking-tighter">Financeiro</h1>
          </div>
          <div className="p-8 space-y-6">
            <Button
              onClick={loginWithGoogle}
              variant="outline"
              className="w-full h-12 font-bold flex gap-3 text-slate-700 hover:bg-slate-50"
            >
              <Chrome size={20} className="text-blue-500" /> Entrar com Google
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black text-slate-400">
                <span className="bg-white px-2">Ou E-mail</span>
              </div>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              <Input
                type="email"
                placeholder="E-mail"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                className="h-12 border-slate-200"
              />
              <Input
                type="password"
                placeholder="Senha"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                className="h-12 border-slate-200"
              />
              <Button
                type="submit"
                disabled={isAuthLoading}
                className="w-full h-12 font-black bg-blue-600 hover:bg-blue-700 uppercase tracking-widest"
              >
                {authMode === "login" ? "Entrar" : "Cadastrar"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const userName = session.user.user_metadata?.full_name || session.user.email;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white px-4 sm:px-6 py-6 sm:py-8 shadow-lg">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-white/20 shadow-sm">
              <AvatarImage src={session.user.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-blue-900 font-bold">
                {userName?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight truncate drop-shadow-md">
              Olá, {userName?.split(" ")[0]}
            </h1>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Button variant="outline" className="bg-white/10 border-white/20 text-white font-bold h-10">
                <Upload size={18} className="sm:mr-2" />
                <span className="hidden sm:inline">Importar</span>
              </Button>
            </div>
            <Button
              className="bg-white text-blue-700 hover:bg-blue-50 font-black h-10"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus size={18} className="sm:mr-2" />
              <span className="hidden sm:inline">Novo Gasto</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => supabase.auth.signOut()}
              className="text-white hover:bg-red-500/30 h-10 px-2"
            >
              <LogOut size={20} />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 mt-6 space-y-6">
        <div className="bg-white p-3 sm:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
          <div className="flex gap-3 items-center">
            <Input
              className="flex-1 h-11 bg-slate-50 border-none font-bold text-sm focus-visible:ring-blue-500"
              placeholder="Buscar despesa..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "h-11 px-4 font-bold border-none",
                showFilters ? "bg-blue-100 text-blue-700" : "bg-slate-50 text-slate-600",
              )}
            >
              <Filter size={16} className="sm:mr-2" /> <span className="hidden sm:inline">Filtros</span>
            </Button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in slide-in-from-top-4">
              <Select value={filters.fatura} onValueChange={(v) => setFilters((f) => ({ ...f, fatura: v }))}>
                <SelectTrigger className="h-11 bg-slate-50 border-none font-bold text-xs">
                  <SelectValue placeholder="Faturas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {unique("fatura").map((f) => (
                    <SelectItem key={f} value={f}>
                      {formatFatura(f as string)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.banco} onValueChange={(v) => setFilters((f) => ({ ...f, banco: v }))}>
                <SelectTrigger className="h-11 bg-slate-50 border-none font-bold text-xs">
                  <SelectValue placeholder="Bancos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {unique("banco").map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.classificacao}
                onValueChange={(v) => setFilters((f) => ({ ...f, classificacao: v }))}
              >
                <SelectTrigger className="h-11 bg-slate-50 border-none font-bold text-xs">
                  <SelectValue placeholder="Categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {unique("classificacao").map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                className="text-red-500 font-bold h-11"
                onClick={() =>
                  setFilters({
                    search: "",
                    banco: "all",
                    cartao: "all",
                    classificacao: "all",
                    justificativa: "all",
                    fatura: "all",
                    dataInicio: "",
                    dataFim: "",
                  })
                }
              >
                Limpar
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-600 text-white rounded-3xl p-5 shadow-lg">
            <p className="text-[10px] font-black opacity-80 uppercase tracking-widest mb-1">Total Gastos</p>
            <h2 className="text-2xl font-black">{formatCurrency(totalSpent)}</h2>
          </div>
          <div
            className={cn(
              "text-white rounded-3xl p-5 shadow-lg cursor-pointer",
              budget === null ? "bg-slate-400" : totalSpent > budget ? "bg-red-500" : "bg-purple-600",
            )}
            onClick={() => {
              setTempBudget(budget || 0);
              setBudgetDialogOpen(true);
            }}
          >
            <p className="text-[10px] font-black uppercase opacity-90 tracking-widest mb-1">
              {budget !== null ? `Teto (${formatCurrency(budget)})` : "Sem Teto"}
            </p>
            <h2 className="text-2xl font-black">{budget !== null ? formatCurrency(budget - totalSpent) : "Definir"}</h2>
          </div>
          <div className="bg-emerald-500 text-white rounded-3xl p-5 shadow-lg">
            <p className="text-[10px] font-black opacity-80 uppercase tracking-widest mb-1">Transações</p>
            <h2 className="text-2xl font-black">{filteredAndSorted.length}</h2>
          </div>
          <div className="bg-slate-800 text-white rounded-3xl p-5 shadow-lg">
            <p className="text-[10px] font-black opacity-80 uppercase tracking-widest mb-1">Maior Categoria</p>
            <h2 className="text-lg font-black truncate">{chartData.cats[0]?.name || "-"}</h2>
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

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-[10px] font-black text-slate-600 mb-4 uppercase tracking-widest">
                  Divisão por Banco
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
                      onClick={handleBankClick}
                      className="cursor-pointer focus:outline-none"
                    >
                      {chartData.banks.map((entry, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: "11px", fontWeight: "bold" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-[10px] font-black text-slate-600 mb-4 uppercase tracking-widest">
                  Evolução Mensal
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData.temporal} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: "bold" }} />
                    <YAxis tickFormatter={(v) => `R$${v / 1000}k`} tick={{ fontSize: 10, fontWeight: "bold" }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
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

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-[10px] font-black text-slate-600 mb-4 uppercase tracking-widest">Classificação</h3>
                <ResponsiveContainer width="100%" height={Math.max(200, chartData.cats.length * 35)}>
                  <BarChart data={chartData.cats} layout="vertical" margin={{ left: -10 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={100}
                      tick={{ fontSize: 10, fontWeight: "bold" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar
                      dataKey="value"
                      fill="#8b5cf6"
                      radius={[0, 4, 4, 0]}
                      barSize={18}
                      onClick={handleCatClick}
                      className="cursor-pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* TABELA DE JUSTIFICATIVAS SOLICITADA */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                <h3 className="text-[10px] font-black text-slate-600 mb-4 uppercase tracking-widest">
                  Justificativas e Valores
                </h3>
                <div className="flex-1 overflow-auto max-h-[300px] scrollbar-hide">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[9px] font-black uppercase py-2">
                          Descrição (Justificativa)
                        </TableHead>
                        <TableHead className="text-[9px] font-black uppercase py-2 text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chartData.justs.slice(0, 15).map((item, idx) => (
                        <TableRow key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <TableCell className="py-2 text-xs font-bold text-slate-700">{item.name}</TableCell>
                          <TableCell className="py-2 text-xs font-black text-blue-600 text-right">
                            {formatCurrency(item.value)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2">
                <h3 className="text-[10px] font-black text-slate-600 mb-4 uppercase tracking-widest">Parcelas</h3>
                <ResponsiveContainer width="100%" height={Math.max(180, installmentsData.data.length * 40)}>
                  <BarChart data={installmentsData.data} layout="vertical" margin={{ left: -10 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={110}
                      tick={{ fontSize: 10, fontWeight: "bold" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Pagas" stackId="a" fill="#10b981" barSize={18} />
                    <Bar dataKey="Restantes" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tabela">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-black text-[10px] py-4" onClick={() => requestSort("banco")}>
                        Banco {renderSortIcon("banco")}
                      </TableHead>
                      <TableHead className="font-black text-[10px] text-right" onClick={() => requestSort("valor")}>
                        Valor {renderSortIcon("valor")}
                      </TableHead>
                      <TableHead className="font-black text-[10px] text-center" onClick={() => requestSort("parcela")}>
                        Parc.
                      </TableHead>
                      <TableHead className="font-black text-[10px]" onClick={() => requestSort("data")}>
                        Data {renderSortIcon("data")}
                      </TableHead>
                      <TableHead className="font-black text-[10px]">Despesa</TableHead>
                      <TableHead className="font-black text-[10px]">Categoria</TableHead>
                      <TableHead className="font-black text-[10px]">Justificativa</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSorted.map((e) => (
                      <TableRow key={e.id} className="hover:bg-blue-50/50">
                        <TableCell className="font-bold text-xs">{e.banco}</TableCell>
                        <TableCell className="text-right font-black text-blue-600">
                          {formatCurrency(Number(e.valor))}
                        </TableCell>
                        <TableCell className="text-center font-bold text-xs text-slate-400">
                          {e.total_parcela > 1 ? `${e.parcela}/${e.total_parcela}` : "-"}
                        </TableCell>
                        <TableCell className="text-slate-500 text-xs font-bold">
                          {format(parseISO(e.data), "dd/MM/yy")}
                        </TableCell>
                        <TableCell className="font-bold text-sm">{e.despesa}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "px-2 py-1 rounded text-[9px] font-black border",
                              BADGE_COLORS[e.classificacao || ""] || "bg-slate-100",
                            )}
                          >
                            {e.classificacao || "Outros"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[150px]">{e.justificativa || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
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
          const payload = {
            ...data,
            valor: Number(data.valor),
            parcela: Number(data.parcela) || 1,
            total_parcela: Number(data.total_parcela) || 1,
            fatura: data.fatura?.length === 7 ? `${data.fatura}-01` : data.fatura,
            user_id: session.user.id,
          };
          if (editing) updateExpense.mutate({ id: editing.id, ...payload }, { onSuccess: () => setFormOpen(false) });
          else addExpense.mutate(payload, { onSuccess: () => setFormOpen(false) });
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent className="rounded-3xl border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black">Excluir registro?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">Não</AlertDialogCancel>
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
