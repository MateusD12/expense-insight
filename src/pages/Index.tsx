import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  Target,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  Wallet,
  LogOut,
  Mail,
  Lock,
  Chrome,
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
import { format, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLORS = ["#7c3aed", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];

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

export default function Index() {
  // --- ESTADOS DE AUTENTICAÇÃO ---
  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup" | "recovery">("login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsCheckingAuth(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu e-mail.");
        setAuthMode("login");
      } else if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
      } else if (authMode === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        toast.success("E-mail de recuperação enviado!");
        setAuthMode("login");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro na operação.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
      if (error) throw error;
    } catch (error: any) {
      toast.error("Erro ao conectar com Google.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.info("Sessão encerrada.");
  };

  // --- LÓGICA DE NEGÓCIO ---
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
  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense; direction: "asc" | "desc" }>({
    key: "data",
    direction: "desc",
  });
  const [budget, setBudget] = useState<number>(() => Number(localStorage.getItem("expense-budget")) || 4000);
  const [tempBudget, setTempBudget] = useState(budget);

  // Importação
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim() !== "");
      const headers = lines[0].toLowerCase().split(/[;,]/);
      const parsedData = lines.slice(1).map((line) => {
        const values = line.split(/[;,]/);
        const obj: any = {};
        headers.forEach((header, i) => {
          let val = values[i]?.replace(/"/g, "").trim();
          if (header.includes("valor")) val = val?.replace(",", ".");
          obj[header.trim()] = val;
        });
        return obj;
      });
      setImportPreview(parsedData);
      setShowImportDialog(true);
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    try {
      for (const item of importPreview) {
        await addExpense.mutateAsync({
          banco: item.banco || "",
          cartao: item.cartao || "",
          valor: Number(item.valor) || 0,
          data: item.data || new Date().toISOString().split("T")[0],
          despesa: item.despesa || "",
          classificacao: item.classificacao || "",
          justificativa: item.justificativa || "",
          parcela: Number(item.parcela) || 1,
          total_parcela: Number(item.total_parcelas || item.total_parcela) || 1,
          fatura: item.fatura || null,
        });
      }
      toast.success("Importação concluída!");
      setShowImportDialog(false);
      setImportPreview([]);
    } catch (err) {
      toast.error("Erro na importação.");
    }
  };

  const filteredAndSorted = useMemo(() => {
    let result = allExpenses
      .map((e) => ({
        ...e,
        parcela: e.parcela && e.parcela > 0 ? e.parcela : 1,
        total_parcela: e.total_parcela && e.total_parcela > 0 ? e.total_parcela : 1,
      }))
      .filter((e) => {
        const matchSearch =
          e.despesa?.toLowerCase().includes(filters.search.toLowerCase()) ||
          e.justificativa?.toLowerCase().includes(filters.search.toLowerCase());
        const matchBanco = filters.banco === "all" || e.banco === filters.banco;
        const matchCat = filters.classificacao === "all" || e.classificacao === filters.classificacao;
        const faturafmt = e.fatura ? e.fatura.slice(0, 7) : "all";
        const matchFatura = filters.fatura === "all" || faturafmt === filters.fatura;
        return matchSearch && matchBanco && matchCat && matchFatura;
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
    [
      ...new Set(
        allExpenses
          .map((e) => (key === "fatura" && e[key] ? (e[key] as string).slice(0, 7) : e[key]))
          .filter(Boolean) as string[],
      ),
    ].sort();

  const pieData = useMemo(() => {
    const map: Record<string, { value: number; banco: string; cartao: string }> = {};
    filteredAndSorted.forEach((e) => {
      const key = `${e.banco} ••${e.cartao}`;
      if (!map[key]) map[key] = { value: 0, banco: e.banco, cartao: e.cartao };
      map[key].value += Number(e.valor);
    });
    return Object.entries(map).map(([name, d]) => ({ name, ...d }));
  }, [filteredAndSorted]);

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos((-Math.PI / 180) * midAngle);
    const y = cy + radius * Math.sin((-Math.PI / 180) * midAngle);
    return percent < 0.04 ? null : (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight="bold"
      >{`${(percent * 100).toFixed(0)}%`}</text>
    );
  };

  const installmentsData = useMemo(() => {
    let data = filteredAndSorted.filter((e) => (e.total_parcela || 1) > 1);
    const uniqueJust = [...new Set(data.map((e) => e.justificativa))].filter(Boolean) as string[];
    if (installmentFilter !== "all") data = data.filter((e) => e.justificativa === installmentFilter);
    return {
      data: data.map((e) => ({
        name: `${e.justificativa || "Sem info"} (${e.parcela}/${e.total_parcela})`,
        Pagas: e.parcela - 1,
        Restantes: e.total_parcela - (e.parcela - 1),
      })),
      options: uniqueJust,
    };
  }, [filteredAndSorted, installmentFilter]);

  const totalSpent = useMemo(() => filteredAndSorted.reduce((acc, e) => acc + Number(e.valor), 0), [filteredAndSorted]);
  const uniqueBancos = new Set(filteredAndSorted.map((e) => e.banco)).size;
  const uniqueCats = new Set(filteredAndSorted.map((e) => e.classificacao)).size;
  const remainingBudget = budget - totalSpent;

  const handleSort = (key: keyof Expense) =>
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  const getSortIcon = (key: keyof Expense) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={12} className="ml-1 opacity-30 inline" />;
    return sortConfig.direction === "asc" ? (
      <ArrowUp size={12} className="ml-1 inline" />
    ) : (
      <ArrowDown size={12} className="ml-1 inline" />
    );
  };

  if (isCheckingAuth)
    return (
      <div className="h-screen flex items-center justify-center font-bold text-slate-500">Iniciando sistema...</div>
    );

  // --- TELA DE LOGIN ---
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-br from-blue-600 to-purple-700 p-10 text-center text-white">
            <div className="bg-white/20 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
              <Wallet size={40} className="text-white" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter mb-2">Financeiro</h1>
            <p className="text-blue-100 text-sm font-medium opacity-80 uppercase tracking-widest">
              Controle Profissional
            </p>
          </div>

          <div className="p-8 space-y-6">
            <Button
              onClick={loginWithGoogle}
              variant="outline"
              className="w-full h-12 font-bold border-slate-200 hover:bg-slate-50 flex gap-3 text-slate-700"
            >
              <Chrome size={20} className="text-blue-500" /> Entrar com Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-bold">Ou com e-mail</span>
              </div>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-1">
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="E-mail"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                    className="pl-10 h-12 bg-slate-50 border-none focus-visible:ring-blue-500"
                  />
                </div>
              </div>

              {authMode !== "recovery" && (
                <div className="space-y-1">
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                    <Input
                      type="password"
                      placeholder="Senha"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      required
                      className="pl-10 h-12 bg-slate-50 border-none focus-visible:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={isAuthLoading}
                className="w-full h-12 font-black bg-blue-600 hover:bg-blue-700 text-lg shadow-lg shadow-blue-200"
              >
                {isAuthLoading
                  ? "Processando..."
                  : authMode === "signup"
                    ? "Criar Minha Conta"
                    : authMode === "recovery"
                      ? "Enviar Link de Recuperação"
                      : "Entrar"}
              </Button>
            </form>

            <div className="flex flex-col gap-3 text-center pt-2">
              <button
                type="button"
                onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
                className="text-sm font-bold text-slate-500 hover:text-blue-600"
              >
                {authMode === "signup" ? "Já tem conta? Faça login" : "Não tem conta? Comece agora"}
              </button>
              {authMode === "login" && (
                <button
                  type="button"
                  onClick={() => setAuthMode("recovery")}
                  className="text-xs font-bold text-slate-400 hover:text-red-500"
                >
                  Esqueceu sua senha?
                </button>
              )}
              {authMode === "recovery" && (
                <button type="button" onClick={() => setAuthMode("login")} className="text-xs font-bold text-slate-500">
                  Voltar para o login
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- DASHBOARD PRINCIPAL ---
  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white px-6 py-8 shadow-lg">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2 tracking-tight uppercase">
              💳 Controle de Gastos
            </h1>
            <p className="text-blue-100 text-xs mt-1 font-bold opacity-70">Logado como: {session.user.email}</p>
            <p className="text-yellow-300 text-[9px] font-mono mt-1 select-all">SEU ID: {session.user.id}</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Button
                variant="outline"
                className="bg-white/10 hover:bg-white/20 border-white/30 text-white font-bold h-11"
              >
                <Upload size={18} className="mr-2" /> Importar
              </Button>
            </div>
            <Button
              className="bg-white text-blue-700 hover:bg-blue-50 border-none font-black h-11 px-6 shadow-xl"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus size={18} className="mr-2" /> Novo Gasto
            </Button>
            <Button variant="ghost" onClick={handleLogout} className="text-white hover:bg-red-500/20 h-11">
              <LogOut size={20} />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 mt-6 space-y-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-3 items-center">
          <Input
            className="pl-4 h-11 flex-1 min-w-[200px] bg-slate-50 border-none"
            placeholder="O que você está procurando?"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <Select value={filters.fatura} onValueChange={(v) => setFilters((f) => ({ ...f, fatura: v }))}>
            <SelectTrigger className="w-[160px] h-11 bg-slate-50 border-none font-bold">
              <SelectValue placeholder="Faturas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {unique("fatura").map((f) => (
                <SelectItem key={f} value={f}>
                  {formatFatura(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-blue-600 text-white rounded-2xl p-5 shadow-blue-100 shadow-xl">
            <p className="text-[10px] font-black opacity-80 uppercase tracking-widest">Total Gastos</p>
            <h2 className="text-2xl font-black mt-1">{formatCurrency(totalSpent)}</h2>
          </div>
          <div
            className={cn(
              "text-white rounded-2xl p-5 shadow-xl transition-all",
              remainingBudget < 0 ? "bg-red-500" : "bg-purple-600",
            )}
            onClick={() => setBudgetDialogOpen(true)}
          >
            <div className="flex justify-between items-center opacity-80">
              <p className="text-[10px] font-black uppercase tracking-widest">Saldo do Teto</p>
              <Target size={16} />
            </div>
            <h2 className="text-2xl font-black mt-1">{formatCurrency(remainingBudget)}</h2>
          </div>
          <div className="bg-emerald-500 text-white rounded-2xl p-5 shadow-xl">
            <p className="text-[10px] font-black opacity-80 uppercase tracking-widest">Transações</p>
            <h2 className="text-2xl font-black mt-1">{filteredAndSorted.length}</h2>
          </div>
          <div className="bg-cyan-500 text-white rounded-2xl p-5 shadow-xl">
            <p className="text-[10px] font-black opacity-80 uppercase tracking-widest">Bancos</p>
            <h2 className="text-2xl font-black mt-1">{uniqueBancos}</h2>
          </div>
          <div className="bg-orange-500 text-white rounded-2xl p-5 shadow-xl">
            <p className="text-[10px] font-black opacity-80 uppercase tracking-widest">Categorias</p>
            <h2 className="text-2xl font-black mt-1">{uniqueCats}</h2>
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="bg-slate-200/50 p-1 mb-6 rounded-xl">
            <TabsTrigger value="dashboard" className="rounded-lg px-8 font-bold">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="tabela" className="rounded-lg px-8 font-bold">
              Tabela
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-xs font-black text-slate-400 mb-6 uppercase tracking-tighter">Divisão por Banco</h3>
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
                      labelLine={false}
                      label={renderCustomizedLabel}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-xs font-black text-slate-400 mb-6 uppercase tracking-tighter">Evolução Mensal</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={areaData}>
                    <defs>
                      <linearGradient id="colorPurple" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      className="text-[10px] font-bold text-slate-400"
                    />
                    <YAxis
                      tickFormatter={(v) => `R$${v / 1000}k`}
                      axisLine={false}
                      tickLine={false}
                      className="text-[10px] font-bold text-slate-400"
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Area type="monotone" dataKey="valor" stroke="#8b5cf6" fill="url(#colorPurple)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <RankedList data={topClassificacao} title="Maiores Gastos por Categoria" />
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <RankedList data={topJustificativa} title="Maiores Gastos por Justificativa" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black text-slate-400 uppercase">Acompanhamento de Parcelas</h3>
                <Select value={installmentFilter} onValueChange={setInstallmentFilter}>
                  <SelectTrigger className="w-[200px] h-8 text-xs bg-slate-50 border-none font-bold">
                    <SelectValue placeholder="Filtrar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Parcelas</SelectItem>
                    {installmentsData.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(250, installmentsData.data.length * 40)}>
                <BarChart data={installmentsData.data} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={180}
                    tick={{ fontSize: 10, fontWeight: "bold", fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip cursor={{ fill: "transparent" }} />
                  <Legend iconType="circle" />
                  <Bar dataKey="Pagas" stackId="a" fill="#10b981" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="Restantes" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="tabela">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead
                      onClick={() => handleSort("banco")}
                      className="cursor-pointer font-black text-[10px] uppercase"
                    >
                      Banco
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort("valor")}
                      className="text-right cursor-pointer font-black text-[10px] uppercase"
                    >
                      Valor
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort("data")}
                      className="cursor-pointer font-black text-[10px] uppercase"
                    >
                      Data
                    </TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Parcela</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Despesa</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Categoria</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((e) => (
                    <TableRow key={e.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-bold text-slate-700">{e.banco}</TableCell>
                      <TableCell className="text-right">
                        <div className="font-black text-blue-600">{formatCurrency(Number(e.valor))}</div>
                        {e.total_parcela > 1 && (
                          <div className="text-[9px] text-orange-600 font-black uppercase">
                            Falta: {formatCurrency(Number(e.valor) * (e.total_parcela - e.parcela + 1))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-500 font-medium">
                        {format(parseISO(e.data), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="font-black text-xs text-slate-400">
                        {e.parcela}/{e.total_parcela}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-800">{e.despesa}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">{e.justificativa}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            BADGE_COLORS[e.classificacao] || "bg-slate-100 text-slate-800",
                            "font-black text-[9px] border-none uppercase shadow-none",
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

      {/* DIALOGS */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl border-none">
          <DialogHeader>
            <DialogTitle className="font-black">Ajustar Teto</DialogTitle>
            <DialogDescription className="font-bold text-slate-400">
              Quanto você planeja gastar por mês?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              value={tempBudget}
              onChange={(e) => setTempBudget(Number(e.target.value))}
              className="text-4xl font-black text-center h-20 bg-slate-50 border-none rounded-2xl"
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
              className="w-full bg-blue-600 font-black h-14 rounded-2xl text-lg shadow-xl shadow-blue-100"
            >
              Salvar Teto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black text-2xl uppercase">Conferência de Dados</DialogTitle>
            <DialogDescription className="font-bold">
              Verifique os valores convertidos antes de confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-2xl overflow-hidden my-4">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black text-[10px]">Despesa</TableHead>
                  <TableHead className="text-right font-black text-[10px]">Valor</TableHead>
                  <TableHead className="font-black text-[10px]">Fatura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreview.slice(0, 10).map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-bold">{item.despesa}</TableCell>
                    <TableCell className="text-right font-black text-emerald-600">
                      {formatCurrency(Number(item.valor))}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-400 uppercase">
                      {formatFatura(item.fatura)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(false)} className="font-bold h-12 rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={confirmImport}
              className="bg-emerald-600 font-black h-12 rounded-xl px-8 shadow-lg shadow-emerald-100"
            >
              <Check className="mr-2 h-5 w-5" /> Confirmar {importPreview.length} Itens
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editing}
        onSubmit={(data) => {
          const faturaSegura = data.fatura && data.fatura.length === 7 ? `${data.fatura}-01` : data.fatura;
          const payload = {
            ...data,
            valor: Number(data.valor),
            parcela: Number(data.parcela),
            total_parcela: Number(data.total_parcela),
            fatura: faturaSegura,
          };
          if (editing) {
            updateExpense.mutate(
              { id: editing.id, ...payload },
              {
                onSuccess: () => {
                  toast.success("Gasto atualizado!");
                  setFormOpen(false);
                },
              },
            );
          } else {
            addExpense.mutate(payload, {
              onSuccess: () => {
                toast.success("Gasto adicionado!");
                setFormOpen(false);
              },
            });
          }
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent className="rounded-3xl border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-2xl">Excluir este gasto?</AlertDialogTitle>
            <AlertDialogDescription className="font-bold text-slate-400">
              Esta ação removerá o registro permanentemente do seu controle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold h-12 rounded-xl">Não, manter</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 font-black h-12 rounded-xl shadow-lg shadow-red-100"
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
