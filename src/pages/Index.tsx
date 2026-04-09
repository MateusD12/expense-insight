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
import { Plus, Pencil, Trash2, Upload, LogOut, Chrome, Wallet, Target, FilterX } from "lucide-react";
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
      if (window.location.hash || window.location.search.includes("access_token")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
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
      .select("budget")
      .eq("id", uid)
      .single();
    if (data && data.budget !== null) {
      setBudget(Number(data.budget));
    } else {
      setBudget(null);
    }
  };

  const handleSaveBudget = async () => {
    if (!session?.user?.id) return;
    const { error } = await supabase.from("profiles" as any).upsert({ id: session.user.id, budget: tempBudget } as any);
    if (!error) {
      setBudget(tempBudget);
      setBudgetDialogOpen(false);
      toast.success("Teto atualizado no seu perfil!");
    } else {
      toast.error("Erro ao salvar teto.");
    }
  };

  const loginWithGoogle = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
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

        if (lines.length < 2) {
          toast.error("O arquivo parece estar vazio ou não tem cabeçalho.");
          return;
        }

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
        console.error("Erro ao ler o arquivo:", err);
        toast.error("Erro ao ler o formato deste CSV.");
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
        if (faturaRaw !== "") {
          faturaSegura = faturaRaw.length === 7 ? `${faturaRaw}-01` : faturaRaw;
        }

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
      toast.success("Tudo importado com sucesso!");
      setShowImportDialog(false);
      setImportPreview([]);
    } catch (err) {
      console.error(err);
      toast.error("Erro na importação. O banco rejeitou os dados.");
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
    return normalizedExpenses
      .filter((e) => {
        const matchSearch =
          e.despesa?.toLowerCase().includes(filters.search.toLowerCase()) ||
          e.justificativa?.toLowerCase().includes(filters.search.toLowerCase());
        const matchBanco = filters.banco === "all" || e.banco === filters.banco;
        const matchCartao = filters.cartao === "all" || e.cartao === filters.cartao;
        const matchCat = filters.classificacao === "all" || e.classificacao === filters.classificacao;
        const matchJust = filters.justificativa === "all" || e.justificativa === filters.justificativa;

        const faturafmt = e.fatura ? e.fatura.slice(0, 7) : "all";
        const matchFatura = filters.fatura === "all" || faturafmt === filters.fatura;

        const matchDataInicio = !filters.dataInicio || e.data >= filters.dataInicio;
        const matchDataFim = !filters.dataFim || e.data <= filters.dataFim;

        return (
          matchSearch &&
          matchBanco &&
          matchCartao &&
          matchCat &&
          matchJust &&
          matchFatura &&
          matchDataInicio &&
          matchDataFim
        );
      })
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [normalizedExpenses, filters]);

  const chartData = useMemo(() => {
    const banks: Record<string, number> = {};
    const cats: Record<string, number> = {};
    const justs: Record<string, number> = {};
    const temporal: Record<string, number> = {};

    filteredAndSorted.forEach((e) => {
      const val = Number(e.valor);

      // Volta a agrupar com Banco e Cartão juntos
      const bankKey = e.banco ? `${e.banco}${e.cartao ? " ••" + e.cartao : ""}` : "Desconhecido";
      banks[bankKey] = (banks[bankKey] || 0) + val;

      cats[e.classificacao || "Outros"] = (cats[e.classificacao || "Outros"] || 0) + val;
      justs[e.justificativa || "Outros"] = (justs[e.justificativa || "Outros"] || 0) + val;

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

  const installmentsData = useMemo(() => {
    let data = filteredAndSorted.filter((e) => e.total_parcela > 1);
    const uniqueJust = [...new Set(data.map((e) => e.justificativa))].filter(Boolean) as string[];

    if (installmentFilter !== "all") {
      data = data.filter((e) => e.justificativa === installmentFilter);
    }

    const latestInstallments: Record<string, any> = {};
    data.forEach((e) => {
      const key = e.justificativa || e.despesa || "Sem info";
      if (!latestInstallments[key] || e.parcela > latestInstallments[key].parcela) {
        latestInstallments[key] = e;
      }
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

  // --- CLIQUES INTERATIVOS NOS GRÁFICOS ---
  const handleBankClick = (data: any) => {
    const parts = data.name.split(" ••");
    const bankName = parts[0];
    const cardNum = parts[1] || "all";

    setFilters((prev) => {
      const isAlreadySelected = prev.banco === bankName && prev.cartao === cardNum;
      return {
        ...prev,
        banco: isAlreadySelected ? "all" : bankName,
        cartao: isAlreadySelected ? "all" : cardNum,
      };
    });
  };

  const handleCatClick = (data: any) => {
    setFilters((prev) => ({ ...prev, classificacao: prev.classificacao === data.name ? "all" : data.name }));
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
              className="w-full h-12 font-bold flex gap-3 text-slate-700"
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
                className="h-12"
              />
              <Input
                type="password"
                placeholder="Senha"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                className="h-12"
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
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white px-6 py-8 shadow-lg">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-white/20">
              <AvatarImage src={session.user.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-blue-900 font-bold">
                {userName?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h1 className="text-xl font-black uppercase tracking-tight">Olá, {userName?.split(" ")[0]}</h1>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Button variant="outline" className="bg-white/10 text-white font-bold h-11">
                <Upload size={18} className="mr-2" /> Importar
              </Button>
            </div>
            <Button
              className="bg-white text-blue-700 font-black h-11"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus size={18} className="mr-2" /> Novo Gasto
            </Button>
            <Button
              variant="ghost"
              onClick={() => supabase.auth.signOut()}
              className="text-white hover:bg-red-500/20 h-11"
            >
              <LogOut size={20} />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 mt-6 space-y-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <Input
              className="pl-4 h-11 flex-1 min-w-[200px] bg-slate-50 border-none font-bold"
              placeholder="Buscar despesa ou justificativa..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
            <Select value={filters.fatura} onValueChange={(v) => setFilters((f) => ({ ...f, fatura: v }))}>
              <SelectTrigger className="w-[150px] h-11 bg-slate-50 border-none font-bold">
                <SelectValue placeholder="Faturas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Faturas</SelectItem>
                {unique("fatura").map((f) => (
                  <SelectItem key={f} value={f}>
                    {formatFatura(f as string)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.banco} onValueChange={(v) => setFilters((f) => ({ ...f, banco: v }))}>
              <SelectTrigger className="w-[150px] h-11 bg-slate-50 border-none font-bold">
                <SelectValue placeholder="Bancos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Bancos</SelectItem>
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
              <SelectTrigger className="w-[160px] h-11 bg-slate-50 border-none font-bold">
                <SelectValue placeholder="Categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {unique("classificacao").map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Select
              value={filters.justificativa}
              onValueChange={(v) => setFilters((f) => ({ ...f, justificativa: v }))}
            >
              <SelectTrigger className="w-[200px] h-11 bg-slate-50 border-none font-bold">
                <SelectValue placeholder="Justificativas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Justificativas</SelectItem>
                {unique("justificativa").map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-xl h-11 border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">De:</span>
              <input
                type="date"
                className="bg-transparent text-sm font-bold text-slate-700 outline-none"
                value={filters.dataInicio}
                onChange={(e) => setFilters((f) => ({ ...f, dataInicio: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-xl h-11 border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Até:</span>
              <input
                type="date"
                className="bg-transparent text-sm font-bold text-slate-700 outline-none"
                value={filters.dataFim}
                onChange={(e) => setFilters((f) => ({ ...f, dataFim: e.target.value }))}
              />
            </div>
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
              <FilterX size={16} className="mr-2" /> Limpar Filtros
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-600 text-white rounded-2xl p-5 shadow-xl">
            <p className="text-[10px] font-black opacity-80 uppercase tracking-widest mb-1">Total Gastos</p>
            <h2 className="text-2xl font-black">{formatCurrency(totalSpent)}</h2>
          </div>

          <div
            className={cn(
              "text-white rounded-2xl p-5 shadow-xl cursor-pointer transition-all",
              budget === null
                ? "bg-slate-400 hover:bg-slate-500"
                : totalSpent > budget
                  ? "bg-red-500"
                  : "bg-purple-600",
            )}
            onClick={() => {
              setTempBudget(budget || 0);
              setBudgetDialogOpen(true);
            }}
          >
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black uppercase opacity-80 tracking-widest">
                {budget !== null ? `Saldo do Teto (${formatCurrency(budget)})` : "Sem Teto Definido"}
              </p>
              <Target size={14} />
            </div>
            <h2 className="text-2xl font-black mt-1">
              {budget !== null ? formatCurrency(budget - totalSpent) : "Definir Limite"}
            </h2>
          </div>

          <div className="bg-emerald-500 text-white rounded-2xl p-5 shadow-xl">
            <p className="text-[10px] font-black opacity-80 uppercase tracking-widest mb-1">Transações</p>
            <h2 className="text-2xl font-black">{filteredAndSorted.length}</h2>
          </div>

          <div className="bg-slate-800 text-white rounded-2xl p-5 shadow-xl">
            <p className="text-[10px] font-black opacity-80 uppercase tracking-widest mb-1">Maior Categoria</p>
            <h2 className="text-xl font-black truncate">{chartData.cats.length > 0 ? chartData.cats[0].name : "-"}</h2>
            {chartData.cats.length > 0 && (
              <p className="text-xs text-slate-300 font-bold">{formatCurrency(chartData.cats[0].value)}</p>
            )}
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="bg-slate-200/50 p-1 mb-6 rounded-xl">
            <TabsTrigger value="dashboard" className="px-8 font-bold rounded-lg">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="tabela" className="px-8 font-bold rounded-lg">
              Tabela
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Divisão por Banco</h3>
                  <span className="text-[9px] text-slate-300 uppercase font-bold">Clique para filtrar</span>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={chartData.banks}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      labelLine={false}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                      onClick={handleBankClick}
                      className="cursor-pointer"
                    >
                      {chartData.banks.map((entry, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={COLORS[i % COLORS.length]}
                          className="hover:opacity-80 transition-opacity"
                          stroke={filters.banco === entry.name.split(" ••")[0] ? "#000" : "none"}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest">
                  Evolução Mensal
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData.temporal}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: "bold" }} />
                    <YAxis
                      tickFormatter={(v) => `R$${v / 1000}k`}
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.1}
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Classificação de Gastos
                  </h3>
                  <span className="text-[9px] text-slate-300 uppercase font-bold">Clique para filtrar</span>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(250, chartData.cats.length * 30)}>
                  <BarChart data={chartData.cats} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={80}
                      tick={{ fontSize: 10, fontWeight: "bold" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar
                      dataKey="value"
                      fill="#8b5cf6"
                      radius={[0, 4, 4, 0]}
                      onClick={handleCatClick}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {chartData.cats.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={filters.classificacao === entry.name ? "#6d28d9" : "#8b5cf6"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest">
                  Top 10 Justificativas
                </h3>
                <ResponsiveContainer width="100%" height={Math.max(250, chartData.justs.length * 30)}>
                  <BarChart data={chartData.justs} layout="vertical" margin={{ left: 20 }}>
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
                    <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 md:col-span-2">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Acompanhamento de Parcelas
                  </h3>
                  <Select value={installmentFilter} onValueChange={setInstallmentFilter}>
                    <SelectTrigger className="w-[180px] h-8 text-xs font-bold">
                      <SelectValue placeholder="Filtrar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Compras</SelectItem>
                      {installmentsData.options.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(250, installmentsData.data.length * 40)}>
                  <BarChart data={installmentsData.data} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={180}
                      tick={{ fontSize: 10, fontWeight: "bold" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="Pagas" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Restantes" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tabela">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-none">
                    <TableHead className="font-black text-[10px] uppercase tracking-widest">Banco</TableHead>
                    <TableHead className="text-right font-black text-[10px] uppercase tracking-widest">Valor</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-center">
                      Parcela
                    </TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest">Data</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest">Despesa</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((e) => (
                    <TableRow key={e.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-slate-700">{e.banco}</TableCell>
                      <TableCell className="text-right font-black text-blue-600">
                        {formatCurrency(Number(e.valor))}
                      </TableCell>
                      <TableCell className="text-center font-black text-xs text-slate-400">
                        {e.total_parcela > 1 ? `${e.parcela}/${e.total_parcela}` : "-"}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs font-bold">
                        {format(parseISO(e.data), "dd/MM/yy")}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-800 text-sm">{e.despesa}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">{e.justificativa}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
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
        <DialogContent aria-describedby={undefined} className="rounded-3xl border-none">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-center">
              Ajustar Teto de Gastos
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-slate-500 font-bold -mt-2">Deixe em zero para remover o limite.</p>
          <div className="py-6">
            <Input
              type="number"
              value={tempBudget}
              onChange={(e) => setTempBudget(Number(e.target.value))}
              className="text-4xl font-black text-center h-20 bg-slate-50 border-none rounded-2xl focus-visible:ring-purple-500"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveBudget}
              className="w-full bg-blue-600 font-black h-14 rounded-2xl text-lg shadow-xl shadow-blue-100"
            >
              Salvar no Perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-[600px] rounded-3xl border-none">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-xl">Conferir Importação</DialogTitle>
          </DialogHeader>
          <div className="max-h-[300px] overflow-auto border rounded-xl">
            <Table>
              <TableBody>
                {importPreview.slice(0, 5).map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-bold text-sm">{item.despesa}</TableCell>
                    <TableCell className="text-right font-black text-emerald-600">
                      {formatCurrency(Number(item.valor))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="mt-4">
            <Button
              onClick={confirmImport}
              className="bg-emerald-600 font-black w-full h-12 rounded-xl text-md shadow-lg shadow-emerald-50"
            >
              Confirmar {importPreview.length} Itens
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
            parcela: Number(data.parcela),
            total_parcela: Number(data.total_parcela),
            user_id: session.user.id,
          };
          if (editing)
            updateExpense.mutate(
              { id: editing.id, ...payload },
              {
                onSuccess: () => {
                  toast.success("Gasto atualizado!");
                  setFormOpen(false);
                },
              },
            );
          else
            addExpense.mutate(payload, {
              onSuccess: () => {
                toast.success("Gasto adicionado!");
                setFormOpen(false);
              },
            });
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent aria-describedby={undefined} className="rounded-3xl border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-xl">Excluir este registro?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold rounded-xl h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 font-black rounded-xl h-11"
              onClick={() => {
                if (deleting)
                  deleteExpense.mutate(deleting, {
                    onSuccess: () => {
                      toast.success("Excluído!");
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
