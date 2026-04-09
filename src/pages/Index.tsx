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
        if (lines.length < 2) return toast.error("O arquivo parece estar vazio.");

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
      toast.success("Tudo importado com sucesso!");
      setShowImportDialog(false);
      setImportPreview([]);
    } catch (err) {
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

  const requestSort = (key: keyof Expense) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const filteredAndSorted = useMemo(() => {
    let result = normalizedExpenses.filter((e) => {
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
    });

    result.sort((a: any, b: any) => {
      if (sortConfig.key === "valor" || sortConfig.key === "parcela" || sortConfig.key === "total_parcela") {
        const aVal = Number(a[sortConfig.key]) || 0;
        const bVal = Number(b[sortConfig.key]) || 0;
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (sortConfig.key === "data") {
        const aDate = new Date(a.data).getTime();
        const bDate = new Date(b.data).getTime();
        return sortConfig.direction === "asc" ? aDate - bDate : bDate - aDate;
      }
      const aVal = String(a[sortConfig.key] || "").toLowerCase();
      const bVal = String(b[sortConfig.key] || "").toLowerCase();
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [normalizedExpenses, filters, sortConfig]);

  const chartData = useMemo(() => {
    const banks: Record<string, number> = {};
    const cats: Record<string, number> = {};
    const justs: Record<string, number> = {};
    const temporal: Record<string, number> = {};

    filteredAndSorted.forEach((e) => {
      const val = Number(e.valor);
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
    if (installmentFilter !== "all") data = data.filter((e) => e.justificativa === installmentFilter);

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

  const handleBankClick = (data: any) => {
    const parts = data.name.split(" ••");
    const bankName = parts[0];
    const cardNum = parts[1] || "all";
    setFilters((prev) => {
      const isAlreadySelected = prev.banco === bankName && prev.cartao === cardNum;
      return { ...prev, banco: isAlreadySelected ? "all" : bankName, cartao: isAlreadySelected ? "all" : cardNum };
    });
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

  const truncateText = (text: string, limit: number = 12) => {
    if (!text) return "";
    return text.length > limit ? text.substring(0, limit) + "..." : text;
  };

  const hasActiveFilters =
    filters.banco !== "all" ||
    filters.classificacao !== "all" ||
    filters.justificativa !== "all" ||
    filters.fatura !== "all" ||
    filters.dataInicio !== "" ||
    filters.dataFim !== "";

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
                className="h-12 border-slate-200 focus-visible:ring-blue-500"
              />
              <Input
                type="password"
                placeholder="Senha"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                className="h-12 border-slate-200 focus-visible:ring-blue-500"
              />
              <Button
                type="submit"
                disabled={isAuthLoading}
                className="w-full h-12 font-black bg-blue-600 hover:bg-blue-700 uppercase tracking-widest transition-colors"
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
          <div className="flex items-center gap-3 sm:gap-4">
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-white/20 shadow-sm">
              <AvatarImage src={session.user.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-blue-900 font-bold">
                {userName?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight truncate max-w-[120px] sm:max-w-none drop-shadow-md">
              Olá, {userName?.split(" ")[0]}
            </h1>
          </div>
          <div className="flex gap-1 sm:gap-2">
            <div className="relative hover:opacity-90 transition-opacity">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Button variant="outline" className="bg-white/10 border-white/20 text-white font-bold h-10 px-2 sm:px-4">
                <Upload size={18} className="sm:mr-2" />
                <span className="hidden sm:inline">Importar</span>
              </Button>
            </div>
            <Button
              className="bg-white text-blue-700 hover:bg-blue-50 hover:text-blue-800 font-black h-10 px-2 sm:px-4 transition-colors shadow-sm"
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
              className="text-white hover:bg-red-500/30 h-10 px-2 sm:px-4 transition-colors"
            >
              <LogOut size={20} />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 mt-6 space-y-4 sm:space-y-6">
        <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-2 sm:gap-3 relative overflow-hidden transition-all">
          <div className="flex gap-2 sm:gap-3 items-center">
            <Input
              className="flex-1 min-w-0 h-10 sm:h-11 bg-slate-50 hover:bg-slate-100 transition-colors border-none font-bold text-xs sm:text-sm focus-visible:ring-blue-500"
              placeholder="Buscar despesa ou justificativa..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "h-10 sm:h-11 px-3 sm:px-4 font-bold border-none transition-colors",
                showFilters || hasActiveFilters
                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100",
              )}
            >
              <Filter size={16} className={cn("sm:mr-2", hasActiveFilters && "fill-blue-700")} />
              <span className="hidden sm:inline">
                {showFilters ? "Ocultar Filtros" : hasActiveFilters ? "Filtros Ativos" : "Filtros Avançados"}
              </span>
            </Button>
          </div>

          {showFilters && (
            <div className="pt-3 border-t border-slate-100 mt-1 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
              <Select value={filters.fatura} onValueChange={(v) => setFilters((f) => ({ ...f, fatura: v }))}>
                <SelectTrigger className="w-full h-10 sm:h-11 bg-slate-50 hover:bg-slate-100 transition-colors border-none font-bold text-xs sm:text-sm focus:ring-blue-500">
                  <SelectValue placeholder="Faturas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-bold text-blue-600">
                    Todas Faturas
                  </SelectItem>
                  {unique("fatura").map((f) => (
                    <SelectItem key={f} value={f}>
                      {formatFatura(f as string)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.banco} onValueChange={(v) => setFilters((f) => ({ ...f, banco: v }))}>
                <SelectTrigger className="w-full h-10 sm:h-11 bg-slate-50 hover:bg-slate-100 transition-colors border-none font-bold text-xs sm:text-sm focus:ring-blue-500">
                  <SelectValue placeholder="Bancos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-bold text-blue-600">
                    Todos Bancos
                  </SelectItem>
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
                <SelectTrigger className="w-full h-10 sm:h-11 bg-slate-50 hover:bg-slate-100 transition-colors border-none font-bold text-xs sm:text-sm focus:ring-blue-500">
                  <SelectValue placeholder="Categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-bold text-blue-600">
                    Todas Categorias
                  </SelectItem>
                  {unique("classificacao").map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.justificativa}
                onValueChange={(v) => setFilters((f) => ({ ...f, justificativa: v }))}
              >
                <SelectTrigger className="w-full h-10 sm:h-11 bg-slate-50 hover:bg-slate-100 transition-colors border-none font-bold text-xs sm:text-sm focus:ring-blue-500">
                  <SelectValue placeholder="Justificativas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-bold text-blue-600">
                    Todas Justif.
                  </SelectItem>
                  {unique("justificativa").map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="col-span-2 md:col-span-4 flex flex-wrap gap-2 sm:gap-3 items-center mt-1">
                <div className="flex items-center gap-1 sm:gap-2 bg-slate-50 hover:bg-slate-100 transition-colors px-3 rounded-xl h-10 sm:h-11 border-none overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 flex-1 md:flex-none">
                  <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                    De:
                  </span>
                  <input
                    type="date"
                    className="bg-transparent text-xs sm:text-sm font-bold text-slate-700 outline-none w-full"
                    value={filters.dataInicio}
                    onChange={(e) => setFilters((f) => ({ ...f, dataInicio: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-1 sm:gap-2 bg-slate-50 hover:bg-slate-100 transition-colors px-3 rounded-xl h-10 sm:h-11 border-none overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 flex-1 md:flex-none">
                  <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                    Até:
                  </span>
                  <input
                    type="date"
                    className="bg-transparent text-xs sm:text-sm font-bold text-slate-700 outline-none w-full"
                    value={filters.dataFim}
                    onChange={(e) => setFilters((f) => ({ ...f, dataFim: e.target.value }))}
                  />
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    className="col-span-2 md:col-auto text-red-500 hover:bg-red-50 hover:text-red-600 font-bold h-10 sm:h-11 w-full md:w-auto transition-colors rounded-xl"
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
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg border-none relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-20">
              <Wallet size={80} />
            </div>
            <p className="text-[9px] sm:text-[10px] font-black opacity-80 uppercase tracking-widest mb-1 truncate">
              Total Gastos
            </p>
            <h2 className="text-xl sm:text-3xl font-black truncate drop-shadow-sm">{formatCurrency(totalSpent)}</h2>
          </div>

          <div
            className={cn(
              "text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg cursor-pointer transition-transform hover:scale-[1.02] border-none relative overflow-hidden",
              budget === null
                ? "bg-slate-400"
                : totalSpent > budget
                  ? "bg-gradient-to-br from-red-500 to-rose-600"
                  : "bg-gradient-to-br from-purple-500 to-indigo-600",
            )}
            onClick={() => {
              setTempBudget(budget || 0);
              setBudgetDialogOpen(true);
            }}
          >
            <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-20">
              <Target size={80} />
            </div>
            <div className="flex justify-between items-center relative z-10">
              <p className="text-[9px] sm:text-[10px] font-black uppercase opacity-90 tracking-widest truncate mr-1">
                {budget !== null ? `Teto (${formatCurrency(budget)})` : "Sem Teto"}
              </p>
            </div>
            <h2 className="text-xl sm:text-3xl font-black mt-1 truncate drop-shadow-sm relative z-10">
              {budget !== null ? formatCurrency(budget - totalSpent) : "Definir"}
            </h2>
          </div>

          <div className="bg-gradient-to-br from-emerald-400 to-emerald-500 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg border-none relative overflow-hidden">
            <p className="text-[9px] sm:text-[10px] font-black opacity-80 uppercase tracking-widest mb-1 truncate">
              Transações
            </p>
            <h2 className="text-xl sm:text-3xl font-black drop-shadow-sm">{filteredAndSorted.length}</h2>
          </div>

          <div className="bg-slate-800 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg border-none relative overflow-hidden">
            <p className="text-[9px] sm:text-[10px] font-black opacity-80 uppercase tracking-widest mb-1 truncate text-slate-300">
              Maior Categoria
            </p>
            <h2 className="text-base sm:text-xl font-black truncate text-slate-50 mt-1">
              {chartData.cats.length > 0 ? chartData.cats[0].name : "-"}
            </h2>
            {chartData.cats.length > 0 && (
              <p className="text-[10px] sm:text-xs text-blue-400 font-black truncate mt-0.5">
                {formatCurrency(chartData.cats[0].value)}
              </p>
            )}
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="bg-white p-1.5 mb-4 sm:mb-6 rounded-2xl w-full sm:w-fit flex shadow-sm border border-slate-100">
            <TabsTrigger
              value="dashboard"
              className="px-4 sm:px-8 py-2 font-black rounded-xl flex-1 sm:flex-none text-slate-500 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 transition-colors"
            >
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="tabela"
              className="px-4 sm:px-8 py-2 font-black rounded-xl flex-1 sm:flex-none text-slate-500 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 transition-colors"
            >
              Tabela
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 sm:space-y-6">
            <svg width="0" height="0">
              <defs>
                <linearGradient id="colorEvolucao" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
            </svg>

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
              <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                <div className="flex justify-between items-center mb-4 sm:mb-6 mt-1 px-2">
                  <h3 className="text-[10px] sm:text-xs font-black text-slate-600 uppercase tracking-widest">
                    Divisão por Banco
                  </h3>
                  <span className="text-[8px] sm:text-[9px] text-blue-500 uppercase font-black bg-blue-50 px-2.5 py-1 rounded-lg">
                    Clique p/ Filtrar
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={260}>
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
                      labelLine={false}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                      onClick={handleBankClick}
                      className="cursor-pointer focus:outline-none"
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
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        fontWeight: "bold",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", fontWeight: "bold", paddingTop: "10px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                <h3 className="text-[10px] sm:text-xs font-black text-slate-600 mb-4 sm:mb-6 mt-1 px-2 uppercase tracking-widest">
                  Evolução Mensal
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData.temporal} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fontWeight: "bold" }}
                      stroke="#94a3b8"
                      axisLine={false}
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis
                      tickFormatter={(v) => `R$${v / 1000}k`}
                      tick={{ fontSize: 10, fontWeight: "bold" }}
                      axisLine={false}
                      tickLine={false}
                      stroke="#94a3b8"
                      width={45}
                    />
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        fontWeight: "bold",
                        color: "#1e293b",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="#3b82f6"
                      fill="url(#colorEvolucao)"
                      strokeWidth={4}
                      activeDot={{ r: 6, fill: "#1e3a8a", stroke: "#fff", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* GRÁFICO DE CLASSIFICAÇÃO (MODELO) */}
              <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-fuchsia-500"></div>
                <div className="flex justify-between items-center mb-4 sm:mb-6 mt-1 px-2">
                  <h3 className="text-[10px] sm:text-xs font-black text-slate-600 uppercase tracking-widest">
                    Classificação
                  </h3>
                  <span className="text-[8px] sm:text-[9px] text-blue-500 uppercase font-black bg-blue-50 px-2 py-1 rounded-lg">
                    Clique p/ Filtrar
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(200, chartData.cats.length * 40)}>
                  <BarChart data={chartData.cats} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={95}
                      tick={{ fontSize: 10, fontWeight: "bold", fill: "#475569" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => truncateText(val, 12)}
                    />
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      cursor={{ fill: "#f1f5f9" }}
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        fontWeight: "bold",
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill="#8b5cf6"
                      radius={[0, 6, 6, 0]}
                      barSize={24}
                      onClick={handleCatClick}
                      className="cursor-pointer hover:opacity-80 transition-all"
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

              {/* GRÁFICO DE JUSTIFICATIVA (SEGUINDO O MODELO) */}
              <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-sky-500"></div>
                <h3 className="text-[10px] sm:text-xs font-black text-slate-600 mb-4 sm:mb-6 mt-1 px-2 uppercase tracking-widest">
                  Top 10 Justificativas
                </h3>
                <ResponsiveContainer width="100%" height={Math.max(200, chartData.justs.length * 40)}>
                  <BarChart
                    data={chartData.justs}
                    layout="vertical"
                    margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={95}
                      tick={{ fontSize: 10, fontWeight: "bold", fill: "#475569" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => truncateText(val, 12)}
                    />
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      cursor={{ fill: "#f1f5f9" }}
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        fontWeight: "bold",
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill="#0ea5e9"
                      radius={[0, 6, 6, 0]}
                      barSize={24}
                      className="hover:opacity-80 transition-opacity"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* GRÁFICO DE PARCELAS (SEGUINDO O MODELO) */}
              <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden lg:col-span-2">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 sm:mb-6 mt-1 px-2">
                  <h3 className="text-[10px] sm:text-xs font-black text-slate-600 uppercase tracking-widest">
                    Acompanhamento de Parcelas
                  </h3>
                  <Select value={installmentFilter} onValueChange={setInstallmentFilter}>
                    <SelectTrigger className="w-full sm:w-[220px] h-10 text-xs font-bold border-slate-200 bg-slate-50 focus:ring-blue-500 rounded-xl">
                      <SelectValue placeholder="Filtrar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="font-bold text-blue-600">
                        Todas as Compras
                      </SelectItem>
                      {installmentsData.options.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(200, installmentsData.data.length * 45)}>
                  <BarChart
                    data={installmentsData.data}
                    layout="vertical"
                    margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={95}
                      tick={{ fontSize: 10, fontWeight: "bold", fill: "#475569" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => truncateText(val, 12)}
                    />
                    <Tooltip
                      cursor={{ fill: "#f1f5f9" }}
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        fontWeight: "bold",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", fontWeight: "bold", paddingTop: "10px" }} />
                    <Bar
                      dataKey="Pagas"
                      stackId="a"
                      fill="#10b981"
                      radius={[0, 0, 0, 0]}
                      barSize={24}
                      className="hover:opacity-80 transition-opacity"
                    />
                    <Bar
                      dataKey="Restantes"
                      stackId="a"
                      fill="#f59e0b"
                      radius={[0, 6, 6, 0]}
                      barSize={24}
                      className="hover:opacity-80 transition-opacity"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tabela">
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 overflow-hidden pt-2">
              <div className="overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader className="bg-slate-50 border-b border-slate-100">
                    <TableRow className="border-none">
                      <TableHead
                        className="font-black text-[10px] text-slate-500 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors py-4 px-4"
                        onClick={() => requestSort("banco")}
                      >
                        Banco {renderSortIcon("banco")}
                      </TableHead>
                      <TableHead
                        className="font-black text-[10px] text-slate-500 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors text-right py-4 px-4"
                        onClick={() => requestSort("valor")}
                      >
                        Valor {renderSortIcon("valor")}
                      </TableHead>
                      <TableHead
                        className="font-black text-[10px] text-slate-500 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors text-center py-4 px-4"
                        onClick={() => requestSort("parcela")}
                      >
                        Parcela {renderSortIcon("parcela")}
                      </TableHead>
                      <TableHead
                        className="font-black text-[10px] text-slate-500 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors py-4 px-4"
                        onClick={() => requestSort("data")}
                      >
                        Data {renderSortIcon("data")}
                      </TableHead>
                      <TableHead
                        className="font-black text-[10px] text-slate-500 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors py-4 px-4 min-w-[200px]"
                        onClick={() => requestSort("despesa")}
                      >
                        Despesa {renderSortIcon("despesa")}
                      </TableHead>
                      <TableHead
                        className="font-black text-[10px] text-slate-500 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors py-4 px-4 min-w-[140px]"
                        onClick={() => requestSort("classificacao")}
                      >
                        Categoria {renderSortIcon("classificacao")}
                      </TableHead>
                      <TableHead
                        className="font-black text-[10px] text-slate-500 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors py-4 px-4 min-w-[200px]"
                        onClick={() => requestSort("justificativa")}
                      >
                        Justificativa {renderSortIcon("justificativa")}
                      </TableHead>
                      <TableHead className="py-4 px-4" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSorted.map((e) => {
                      const badgeClass =
                        BADGE_COLORS[e.classificacao || ""] || "bg-slate-100 text-slate-600 border-slate-200";
                      return (
                        <TableRow
                          key={e.id}
                          className="hover:bg-blue-50/50 transition-colors border-b border-slate-50 group"
                        >
                          <TableCell className="font-bold text-slate-700 py-3 px-4">
                            {e.banco}{" "}
                            <span className="text-slate-400 text-xs font-normal ml-1">
                              {e.cartao && `••${e.cartao}`}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-black text-blue-600 text-sm py-3 px-4">
                            {formatCurrency(Number(e.valor))}
                          </TableCell>
                          <TableCell className="text-center font-black text-xs text-slate-400 py-3 px-4">
                            {e.total_parcela > 1 ? `${e.parcela}/${e.total_parcela}` : "-"}
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs font-bold py-3 px-4">
                            {format(parseISO(e.data), "dd/MM/yy")}
                          </TableCell>
                          <TableCell className="font-bold text-slate-800 text-sm py-3 px-4">{e.despesa}</TableCell>
                          <TableCell className="py-3 px-4">
                            <span
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm inline-block",
                                badgeClass,
                              )}
                            >
                              {e.classificacao || "Sem Cat"}
                            </span>
                          </TableCell>
                          <TableCell
                            className="text-xs text-slate-600 font-medium truncate max-w-[200px] py-3 px-4"
                            title={e.justificativa}
                          >
                            {e.justificativa || "-"}
                          </TableCell>
                          <TableCell className="py-3 px-4">
                            <div className="flex gap-1 justify-end opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-500 hover:bg-blue-100 rounded-lg"
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
                                className="h-8 w-8 text-red-500 hover:bg-red-100 rounded-lg"
                                onClick={() => setDeleting(e.id)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent aria-describedby={undefined} className="rounded-3xl border-none w-[90%] sm:w-full">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-center text-blue-900">
              Ajustar Teto de Gastos
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-slate-500 text-xs sm:text-sm font-bold -mt-2">
            Deixe em zero para remover o limite.
          </p>
          <div className="py-6">
            <Input
              type="number"
              value={tempBudget}
              onChange={(e) => setTempBudget(Number(e.target.value))}
              className="text-4xl font-black text-center h-20 bg-blue-50 text-blue-900 border-none rounded-2xl focus-visible:ring-purple-500 shadow-inner"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveBudget}
              className="w-full bg-blue-600 hover:bg-blue-700 transition-colors font-black h-14 rounded-2xl text-lg shadow-xl shadow-blue-100"
            >
              Salvar no Perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-[600px] w-[95%] rounded-3xl border-none">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-xl text-blue-900">Conferir Importação</DialogTitle>
          </DialogHeader>
          <div className="max-h-[300px] overflow-auto border border-slate-200 rounded-xl shadow-inner bg-slate-50/50">
            <Table>
              <TableBody>
                {importPreview.slice(0, 5).map((item, idx) => (
                  <TableRow key={idx} className="border-b border-slate-100">
                    <TableCell className="font-bold text-xs sm:text-sm text-slate-700">{item.despesa}</TableCell>
                    <TableCell className="text-right font-black text-emerald-600 text-xs sm:text-sm">
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
              className="bg-emerald-600 hover:bg-emerald-700 transition-colors font-black w-full h-12 rounded-xl text-md shadow-lg shadow-emerald-100"
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

          let faturaSegura = data.fatura || null;
          if (faturaSegura && faturaSegura.length === 7) {
            faturaSegura = `${faturaSegura}-01`;
          }

          const payload = {
            banco: data.banco,
            cartao: data.cartao,
            valor: Number(data.valor),
            data: data.data,
            despesa: data.despesa,
            classificacao: data.classificacao,
            justificativa: data.justificativa,
            parcela: Number(data.parcela) || 1,
            total_parcela: Number(data.total_parcela) || 1,
            fatura: faturaSegura,
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
        <AlertDialogContent aria-describedby={undefined} className="rounded-3xl border-none w-[90%] sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-xl text-slate-800">Excluir este registro?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="font-bold rounded-xl h-11 m-0 hover:bg-slate-100 border-slate-200">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 transition-colors font-black rounded-xl h-11 m-0 shadow-lg shadow-red-100"
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
