import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExpenses, type Expense } from "@/hooks/useExpenses";
import { ExpenseForm } from "@/components/ExpenseForm";
import { FutureExpenses } from "@/components/FutureExpenses";
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
import { InvoiceImport } from "@/components/InvoiceImport";
import { parseItauPdf, type ParsedInvoice } from "@/lib/parseItauPdf";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  FileText,
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
import { format, parseISO, addMonths } from "date-fns";
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

  const {
    data: allExpenses = [],
    isLoading,
    addExpense,
    bulkAddExpenses,
    updateExpense,
    deleteExpense,
  } = useExpenses();

  const faturaFoco = useMemo(() => {
    const now = new Date();
    return format(addMonths(now, 1), "yyyy-MM");
  }, []);

  const [filters, setFilters] = useState({
    search: "",
    banco: "all",
    cartao: "all",
    classificacao: "all",
    justificativa: "all",
    fatura: faturaFoco,
    dataInicio: "",
    dataFim: "",
  });
  const [installmentFilter, setInstallmentFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense; direction: "asc" | "desc" }>({
    key: "data",
    direction: "desc",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [chartPeriod, setChartPeriod] = useState("6m");

  const [formOpen, setFormOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [parsedInvoice, setParsedInvoice] = useState<ParsedInvoice | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [parsingPdf, setParsingPdf] = useState(false);

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
      .maybeSingle();
    if (data && (data as any).budget !== undefined) {
      setBudget(Number((data as any).budget));
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
      toast.success("Teto atualizado!");
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
        const headers = lines[0]
          .toLowerCase()
          .replace(/^\ufeff/, "")
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
        toast.error("Erro ao ler o CSV.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setParsingPdf(true);
    try {
      const invoice = await parseItauPdf(file);
      if (invoice.transacoes.length === 0) {
        toast.error("Nenhuma transação encontrada no PDF.");
        return;
      }
      setParsedInvoice(invoice);
      setShowInvoiceDialog(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao ler o PDF.");
    } finally {
      setParsingPdf(false);
    }
  };

  const confirmImport = async () => {
    if (!session?.user?.id) return;
    try {
      for (const item of importPreview) {
        let dataSegura = String(item.data || "");
        if (dataSegura.includes("/")) {
          const p = dataSegura.split("/");
          if (p.length === 3) dataSegura = `${p[2]}-${p[1]}-${p[0]}`;
        }
        let faturaSegura = null;
        const faturaRaw = String(item.fatura || "");
        if (faturaRaw !== "") faturaSegura = faturaRaw.length === 7 ? `${faturaRaw}-01` : faturaRaw;

        const payload = {
          banco: item.banco || "Desconhecido",
          cartao: item.cartao,
          valor: Number(item.valor) || 0,
          data: dataSegura || new Date().toISOString().split("T")[0],
          despesa: item.despesa || "Importado",
          classificacao: item.classificacao || "Outros",
          justificativa: item.justificativa,
          parcela: Number(item.parcela) || 1,
          total_parcela: Number(item.total_parcela || item.total_parcelas) || 1,
          fatura: faturaSegura,
          fatura_original: null,
          user_id: session.user.id,
        };
        await addExpense.mutateAsync(payload);
      }
      toast.success("Tudo importado!");
      setShowImportDialog(false);
      setImportPreview([]);
    } catch (err) {
      toast.error("Erro na importação.");
    }
  };

  const normalizedExpenses = useMemo(() => {
    return allExpenses.map((e) => ({
      ...e,
      parcela: e.parcela && e.parcela > 0 ? e.parcela : 1,
      total_parcela: e.total_parcela && e.total_parcela > 0 ? e.total_parcela : 1,
    }));
  }, [allExpenses]);

  // Generate virtual future installments from parceladas
  const virtualExpenses = useMemo(() => {
    const result: (Expense & { isVirtual?: boolean })[] = [];
    const existingKeys = new Set(
      normalizedExpenses.map((e) => `${e.despesa}_${e.parcela}_${e.total_parcela}`)
    );

    for (const e of normalizedExpenses) {
      const totalParcelas = e.total_parcela || 0;
      if (totalParcelas <= 1) continue;
      if (!e.fatura) continue;

      const currentParcela = e.parcela || 0;
      const remainingCount = totalParcelas - currentParcela;
      if (remainingCount <= 0) continue;

      const faturaDate = new Date(e.fatura.substring(0, 7) + "-01T12:00:00");

      for (let i = 1; i <= remainingCount; i++) {
        const futureParcela = currentParcela + i;
        const key = `${e.despesa}_${futureParcela}_${totalParcelas}`;
        if (existingKeys.has(key)) continue;

        const futuraFatura = addMonths(faturaDate, i);
        const futuraFaturaStr = format(futuraFatura, "yyyy-MM-dd");

        result.push({
          ...e,
          id: `${e.id}_v${futureParcela}`,
          parcela: futureParcela,
          fatura: futuraFaturaStr,
          fatura_original: null,
          isVirtual: true,
        } as any);
      }
    }
    return result;
  }, [normalizedExpenses]);

  // Combine real faturas + virtual future faturas for dropdown
  const allFaturaOptions = useMemo(() => {
    const realFaturas = normalizedExpenses
      .map((e) => e.fatura?.slice(0, 7))
      .filter(Boolean) as string[];
    const virtualFaturas = virtualExpenses
      .map((e) => e.fatura?.slice(0, 7))
      .filter(Boolean) as string[];
    return [...new Set([...realFaturas, ...virtualFaturas])].sort();
  }, [normalizedExpenses, virtualExpenses]);

  const unique = (key: keyof Expense) => {
    if (key === "fatura") return allFaturaOptions;
    return [
      ...new Set(
        normalizedExpenses
          .map((e) => e[key])
          .filter(Boolean) as string[],
      ),
    ].sort();
  };

  const requestSort = (key: keyof Expense) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const filteredAndSorted = useMemo(() => {
    const hoje = new Date();
    const todayStr = format(hoje, "yyyy-MM-dd");
    const faturaAtual = format(addMonths(hoje, 1), "yyyy-MM"); // "2026-05"

    // If user selected a specific future fatura, include virtual expenses and skip isPresente
    const isFutureFilter = filters.fatura !== "all" && filters.fatura > faturaAtual;

    const pool = isFutureFilter
      ? [...normalizedExpenses, ...virtualExpenses]
      : normalizedExpenses;

    let result = pool.filter((e) => {
      const faturaMes = e.fatura?.substring(0, 7);

      if (!isFutureFilter) {
        // REGRA DO DASHBOARD: só mostra presentes
        const isAVista = (e.total_parcela || 0) <= 1;
        const jaVenceuODia = faturaMes && faturaMes <= faturaAtual && e.data <= todayStr;
        const isAdvanced = !!e.fatura_original;
        const isPresente = isAVista || jaVenceuODia || isAdvanced;
        if (!isPresente) return false;
      }

      const matchSearch =
        e.despesa?.toLowerCase().includes(filters.search.toLowerCase()) ||
        e.justificativa?.toLowerCase().includes(filters.search.toLowerCase());
      const matchBanco = filters.banco === "all" || e.banco === filters.banco;
      const matchCat = filters.classificacao === "all" || e.classificacao === filters.classificacao;
      const matchFatura = filters.fatura === "all" || (e.fatura ? e.fatura.slice(0, 7) : "all") === filters.fatura;

      return matchSearch && matchBanco && matchCat && matchFatura;
    });
    // ... o restante do sort continua igual ...

    result.sort((a: any, b: any) => {
      if (sortConfig.key === "valor" || sortConfig.key === "parcela") {
        const aVal = Number(a[sortConfig.key]) || 0;
        const bVal = Number(b[sortConfig.key]) || 0;
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (sortConfig.key === "data") {
        return sortConfig.direction === "asc"
          ? new Date(a.data).getTime() - new Date(b.data).getTime()
          : new Date(b.data).getTime() - new Date(a.data).getTime();
      }
      const aVal = String(a[sortConfig.key] || "").toLowerCase();
      const bVal = String(b[sortConfig.key] || "").toLowerCase();
      return sortConfig.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return result;
  }, [normalizedExpenses, virtualExpenses, filters, sortConfig]);

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

  // Próxima fatura: calculate next month's total relative to selected fatura
  const proximaFatura = useMemo(() => {
    const baseFatura = filters.fatura !== "all" ? filters.fatura : faturaFoco;
    const baseDate = new Date(baseFatura + "-01T12:00:00");
    const nextDate = addMonths(baseDate, 1);
    const nextKey = format(nextDate, "yyyy-MM");
    const allPool = [...normalizedExpenses, ...virtualExpenses];
    const total = allPool
      .filter((e) => e.fatura?.slice(0, 7) === nextKey)
      .reduce((acc, e) => acc + Number(e.valor), 0);
    return {
      label: format(nextDate, "MMM/yy", { locale: ptBR }),
      total,
    };
  }, [filters.fatura, faturaFoco, normalizedExpenses, virtualExpenses]);

  // Chart temporal data: independent of dashboard filters
  const chartTemporalData = useMemo(() => {
    const allPool = [...normalizedExpenses, ...virtualExpenses];
    const temporal: Record<string, number> = {};
    allPool.forEach((e) => {
      if (e.fatura) {
        const f = e.fatura.slice(0, 7);
        temporal[f] = (temporal[f] || 0) + Number(e.valor);
      }
    });

    let entries = Object.entries(temporal).sort();

    // Apply chart period filter
    if (chartPeriod !== "all") {
      const now = new Date();
      const currentMonth = format(now, "yyyy-MM");
      let monthsBack = 6;
      let monthsForward = 12;
      if (chartPeriod === "3m") { monthsBack = 3; monthsForward = 6; }
      else if (chartPeriod === "6m") { monthsBack = 6; monthsForward = 12; }
      else if (chartPeriod === "1y") { monthsBack = 12; monthsForward = 12; }

      const startDate = addMonths(now, -monthsBack);
      const endDate = addMonths(now, monthsForward);
      const startKey = format(startDate, "yyyy-MM");
      const endKey = format(endDate, "yyyy-MM");
      entries = entries.filter(([f]) => f >= startKey && f <= endKey);
    }

    return entries.map(([f, valor]) => ({
      name: format(new Date(f + "-01T12:00:00"), "MMM/yy", { locale: ptBR }),
      valor,
    }));
  }, [normalizedExpenses, virtualExpenses, chartPeriod]);

  const handleBankClick = (data: any) => {
    const bankName = data.name.split(" ••")[0];
    setFilters((prev) => ({ ...prev, banco: prev.banco === bankName ? "all" : bankName }));
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

  const truncateLabel = (text: string, limit: number = 14) => {
    if (!text) return "";
    return text.length > limit ? text.substring(0, limit) + "..." : text;
  };

  const hasActiveFilters =
    filters.banco !== "all" ||
    filters.classificacao !== "all" ||
    filters.justificativa !== "all" ||
    filters.fatura !== faturaFoco ||
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
                <span className="hidden sm:inline">CSV</span>
              </Button>
            </div>
            <div className="relative hover:opacity-90 transition-opacity">
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                disabled={parsingPdf}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-wait"
              />
              <Button variant="outline" className="bg-white/10 border-white/20 text-white font-bold h-10 px-2 sm:px-4" disabled={parsingPdf}>
                <FileText size={18} className="sm:mr-2" />
                <span className="hidden sm:inline">{parsingPdf ? "Lendo..." : "Fatura PDF"}</span>
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
              placeholder="Buscar..."
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
              <span className="hidden sm:inline">Filtros</span>
            </Button>
          </div>
          {showFilters && (
            <div className="pt-3 border-t border-slate-100 mt-1 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
              <Select value={filters.fatura} onValueChange={(v) => setFilters((f) => ({ ...f, fatura: v }))}>
                <SelectTrigger className="w-full h-10 sm:h-11 bg-slate-50 border-none font-bold text-xs">
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
                <SelectTrigger className="w-full h-10 sm:h-11 bg-slate-50 border-none font-bold text-xs">
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
                <SelectTrigger className="w-full h-10 sm:h-11 bg-slate-50 border-none font-bold text-xs">
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
              <Button
                variant="ghost"
                className="text-red-500 font-bold h-10 sm:h-11"
                onClick={() =>
                  setFilters({
                    search: "",
                    banco: "all",
                    cartao: "all",
                    classificacao: "all",
                    justificativa: "all",
                    fatura: faturaFoco,
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

        {filters.fatura !== "all" && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">
              📋 Fatura de {formatFatura(filters.fatura)}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg border-none relative overflow-hidden">
            <p className="text-[9px] sm:text-[10px] font-black opacity-80 uppercase tracking-widest mb-1">
              Total Gastos
            </p>
            <h2 className="text-xl sm:text-3xl font-black">{formatCurrency(totalSpent)}</h2>
          </div>
          <div
            className={cn(
              "text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg cursor-pointer transition-transform hover:scale-[1.02] border-none relative overflow-hidden",
              budget === null ? "bg-slate-400" : totalSpent > budget ? "bg-red-500" : "bg-purple-600",
            )}
            onClick={() => {
              setTempBudget(budget || 0);
              setBudgetDialogOpen(true);
            }}
          >
            <p className="text-[9px] sm:text-[10px] font-black uppercase opacity-90 tracking-widest mb-1">
              {budget !== null ? `Teto (${formatCurrency(budget)})` : "Sem Teto"}
            </p>
            <h2 className="text-xl sm:text-3xl font-black">
              {budget !== null ? formatCurrency(budget - totalSpent) : "Definir"}
            </h2>
          </div>
          <div className="bg-gradient-to-br from-emerald-400 to-emerald-500 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg border-none relative overflow-hidden">
            <p className="text-[9px] sm:text-[10px] font-black opacity-80 uppercase tracking-widest mb-1">Transações</p>
            <h2 className="text-xl sm:text-3xl font-black">{filteredAndSorted.length}</h2>
          </div>
          <div className="bg-slate-800 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg border-none relative overflow-hidden">
            <p className="text-[9px] sm:text-[10px] font-black opacity-80 uppercase tracking-widest mb-1 text-slate-300">
              Maior Categoria
            </p>
            <h2 className="text-base sm:text-xl font-black truncate text-slate-50">{chartData.cats[0]?.name || "-"}</h2>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg border-none relative overflow-hidden">
            <p className="text-[9px] sm:text-[10px] font-black opacity-80 uppercase tracking-widest mb-1">
              Próx. Fatura ({proximaFatura.label})
            </p>
            <h2 className="text-xl sm:text-3xl font-black">{formatCurrency(proximaFatura.total)}</h2>
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="bg-white p-1.5 mb-4 sm:mb-6 rounded-2xl w-full sm:w-fit flex shadow-sm border border-slate-100">
            <TabsTrigger
              value="dashboard"
              className="px-8 py-2 font-black rounded-xl flex-1 sm:flex-none text-slate-500 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 transition-colors"
            >
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="tabela"
              className="px-8 py-2 font-black rounded-xl flex-1 sm:flex-none text-slate-500 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 transition-colors"
            >
              Tabela
            </TabsTrigger>
            <TabsTrigger
              value="futuras"
              className="px-8 py-2 font-black rounded-xl flex-1 sm:flex-none text-slate-500 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 transition-colors"
            >
              Futuras
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="flex flex-col gap-6">
            {/* 1. Divisão por Banco */}
            <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
              <h3 className="text-[10px] sm:text-xs font-black text-slate-600 mb-4 sm:mb-6 mt-1 px-2 uppercase tracking-widest">
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
                    labelLine={false}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    onClick={handleBankClick}
                    className="cursor-pointer focus:outline-none"
                  >
                    {chartData.banks.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
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

            {/* 2. Evolução Mensal — independente dos filtros */}
            <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 sm:mb-6 mt-1 px-2">
                <h3 className="text-[10px] sm:text-xs font-black text-slate-600 uppercase tracking-widest">
                  Evolução Mensal
                </h3>
                <div className="flex gap-1">
                  {[
                    { value: "3m", label: "3M" },
                    { value: "6m", label: "6M" },
                    { value: "1y", label: "1A" },
                    { value: "all", label: "Tudo" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setChartPeriod(opt.value)}
                      className={cn(
                        "px-3 py-1 text-[10px] font-black rounded-lg transition-colors",
                        chartPeriod === opt.value
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartTemporalData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
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
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="valor"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.1}
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* 3. Classificação */}
            <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-fuchsia-500"></div>
              <h3 className="text-[10px] sm:text-xs font-black text-slate-600 mb-4 sm:mb-6 mt-1 px-2 uppercase tracking-widest">
                Classificação
              </h3>
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.cats.length * 35)}>
                <BarChart data={chartData.cats} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fontSize: 10, fontWeight: "bold", fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => truncateLabel(val, 14)}
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
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                    onClick={handleCatClick}
                    className="cursor-pointer hover:opacity-80"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 4. Justificativas (Voltado a Barras) */}
            <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-sky-500"></div>
              <h3 className="text-[10px] sm:text-xs font-black text-slate-600 mb-4 sm:mb-6 mt-1 px-2 uppercase tracking-widest">
                Top 10 Justificativas
              </h3>
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.justs.length * 35)}>
                <BarChart data={chartData.justs} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fontSize: 10, fontWeight: "bold", fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => truncateLabel(val, 14)}
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
                  <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={18} className="hover:opacity-80" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 5. Parcelas */}
            <div className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 sm:mb-6 mt-1 px-2">
                <h3 className="text-[10px] sm:text-xs font-black text-slate-600 uppercase tracking-widest">Parcelas</h3>
                <Select value={installmentFilter} onValueChange={setInstallmentFilter}>
                  <SelectTrigger className="w-full sm:w-[200px] h-9 text-xs font-bold border-slate-200 bg-slate-50">
                    <SelectValue placeholder="Filtrar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Compras</SelectItem>
                    {installmentsData.options.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(180, installmentsData.data.length * 40)}>
                <BarChart
                  data={installmentsData.data}
                  layout="vertical"
                  margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fontSize: 10, fontWeight: "bold", fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => truncateLabel(val, 14)}
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
                  <Bar dataKey="Pagas" stackId="a" fill="#10b981" barSize={18} />
                  <Bar dataKey="Restantes" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="tabela">
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
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
                      <TableHead className="font-black text-[10px] text-center">Parc.</TableHead>
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
                      <TableRow key={e.id} className="hover:bg-blue-50/50 transition-colors">
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

          <TabsContent value="futuras">
            <FutureExpenses expenses={normalizedExpenses} />
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
              className="text-4xl font-black text-center h-20 bg-blue-50 border-none rounded-2xl shadow-inner"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveBudget}
              className="w-full bg-blue-600 font-black h-14 rounded-2xl shadow-xl shadow-blue-100"
            >
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
          const totalParcelas = Number(data.total_parcela) || 1;
          const baseFatura = data.fatura?.length === 7 ? data.fatura : data.fatura?.substring(0, 7);

          if (editing) {
            const payload = {
              ...data,
              valor: Number(data.valor),
              parcela: Number(data.parcela) || 1,
              total_parcela: totalParcelas,
              fatura: baseFatura ? `${baseFatura}-01` : data.fatura,
              fatura_original: data.fatura_original || null,
              user_id: session.user.id,
            };
            updateExpense.mutate(
              { id: editing.id, ...payload },
              {
                onSuccess: () => {
                  toast.success("Atualizado!");
                  setFormOpen(false);
                },
              },
            );
          } else if (totalParcelas > 1 && baseFatura) {
            // Generate N installment records
            const [year, month] = baseFatura.split("-").map(Number);
            const installments = [];
            for (let i = 0; i < totalParcelas; i++) {
              const faturaDate = new Date(year, month - 1 + i, 1);
              const faturaStr = `${faturaDate.getFullYear()}-${String(faturaDate.getMonth() + 1).padStart(2, "0")}-01`;
              installments.push({
                banco: data.banco,
                cartao: data.cartao,
                valor: Number(data.valor),
                data: data.data,
                despesa: data.despesa,
                justificativa: data.justificativa,
                classificacao: data.classificacao,
                parcela: i + 1,
                total_parcela: totalParcelas,
                fatura: faturaStr,
                fatura_original: null,
                user_id: session.user.id,
              });
            }
            bulkAddExpenses.mutate(installments, {
              onSuccess: () => {
                toast.success(`${totalParcelas} parcelas criadas!`);
                setFormOpen(false);
              },
            });
          } else {
            const payload = {
              ...data,
              valor: Number(data.valor),
              parcela: 1,
              total_parcela: 1,
              fatura: baseFatura ? `${baseFatura}-01` : data.fatura,
              fatura_original: null,
              user_id: session.user.id,
            };
            addExpense.mutate(payload, {
              onSuccess: () => {
                toast.success("Adicionado!");
                setFormOpen(false);
              },
            });
          }
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
                if (deleting)
                  deleteExpense.mutate(deleting, {
                    onSuccess: () => {
                      toast.success("Removido!");
                      setDeleting(null);
                    },
                  });
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
