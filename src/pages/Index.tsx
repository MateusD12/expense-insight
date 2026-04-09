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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup" | "recovery">("login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsCheckingAuth(false);
      if (window.location.hash || window.location.search.includes("access_token")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
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
        toast.success("Verifique seu e-mail!");
      } else if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      } else if (authMode === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(authEmail, { redirectTo: window.location.origin });
        if (error) throw error;
        toast.success("E-mail enviado!");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.info("Sessão encerrada.");
  };

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
    if (!session?.user?.id) return;
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
          user_id: session.user.id,
        });
      }
      toast.success("Importação concluída com sucesso!");
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
      if (e.fatura) {
        const fat = e.fatura.slice(0, 7);
        map[fat] = (map[fat] || 0) + Number(e.valor);
      }
    });
    return Object.entries(map)
      .sort()
      .map(([f, valor]) => ({ name: format(new Date(f + "-01T12:00:00"), "MMM/yy", { locale: ptBR }), valor }));
  }, [filteredAndSorted]);

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
  const remainingBudget = budget - totalSpent;

  if (isCheckingAuth)
    return (
      <div className="h-screen flex items-center justify-center font-bold text-slate-500 italic">Autenticando...</div>
    );

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-br from-blue-600 to-purple-700 p-10 text-center text-white">
            <Wallet size={48} className="mx-auto mb-4" />
            <h1 className="text-3xl font-black">Financeiro</h1>
            <p className="text-blue-100 text-xs uppercase tracking-widest mt-2">Controle de Gastos</p>
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
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-bold">Ou e-mail</span>
              </div>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              <Input
                type="email"
                placeholder="E-mail"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                className="h-12 bg-slate-50"
              />
              {authMode !== "recovery" && (
                <Input
                  type="password"
                  placeholder="Senha"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                  className="h-12 bg-slate-50"
                />
              )}
              <Button
                type="submit"
                disabled={isAuthLoading}
                className="w-full h-12 font-black bg-blue-600 hover:bg-blue-700"
              >
                {isAuthLoading
                  ? "Aguarde..."
                  : authMode === "signup"
                    ? "Criar Conta"
                    : authMode === "recovery"
                      ? "Recuperar Senha"
                      : "Entrar"}
              </Button>
            </form>
            <div className="text-center space-y-2">
              <button
                onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
                className="text-sm font-bold text-slate-500 hover:text-blue-600 block w-full"
              >
                {authMode === "signup" ? "Já tem conta? Login" : "Criar nova conta"}
              </button>
              {authMode === "login" && (
                <button
                  onClick={() => setAuthMode("recovery")}
                  className="text-xs font-bold text-slate-400 block w-full"
                >
                  Esqueci a senha
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pegando dados do perfil do Google
  const userName = session.user.user_metadata?.full_name || session.user.email;
  const userAvatar = session.user.user_metadata?.avatar_url;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white px-6 py-8 shadow-lg">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-white/20 shadow-md">
              <AvatarImage src={userAvatar} />
              <AvatarFallback className="bg-blue-800 font-bold">
                {userName?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase">Olá, {userName?.split(" ")[0]}</h1>
              <p className="text-blue-100 text-xs font-bold opacity-70">Painel de Controle Financeiro</p>
            </div>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-600 text-white rounded-2xl p-5 shadow-xl">
            <p className="text-[10px] font-black opacity-80 uppercase">Total Gastos</p>
            <h2 className="text-2xl font-black mt-1">{formatCurrency(totalSpent)}</h2>
          </div>
          <div
            className={cn("text-white rounded-2xl p-5 shadow-xl", remainingBudget < 0 ? "bg-red-500" : "bg-purple-600")}
            onClick={() => setBudgetDialogOpen(true)}
          >
            <p className="text-[10px] font-black uppercase opacity-80">Saldo do Teto</p>
            <h2 className="text-2xl font-black mt-1">{formatCurrency(remainingBudget)}</h2>
          </div>
          <div className="bg-emerald-500 text-white rounded-2xl p-5 shadow-xl">
            <p className="text-[10px] font-black opacity-80 uppercase">Transações</p>
            <h2 className="text-2xl font-black mt-1">{filteredAndSorted.length}</h2>
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
                <h3 className="text-xs font-black text-slate-400 mb-6 uppercase">Divisão por Banco</h3>
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
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-xs font-black text-slate-400 mb-6 uppercase">Evolução Mensal</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={areaData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" className="text-[10px]" />
                    <YAxis tickFormatter={(v) => `R$${v / 1000}k`} className="text-[10px]" />
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
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-xs font-black text-slate-400 mb-6 uppercase">Acompanhamento de Parcelas</h3>
              <ResponsiveContainer width="100%" height={Math.max(300, installmentsData.data.length * 40)}>
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
                  <Legend />
                  <Bar dataKey="Pagas" stackId="a" fill="#10b981" />
                  <Bar dataKey="Restantes" stackId="a" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="tabela">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-black text-[10px] uppercase">Banco</TableHead>
                    <TableHead className="text-right font-black text-[10px] uppercase">Valor</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Parcela</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Despesa</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-bold">{e.banco}</TableCell>
                      <TableCell className="text-right font-black text-blue-600">
                        {formatCurrency(Number(e.valor))}
                      </TableCell>
                      <TableCell className="font-black text-xs text-slate-400">
                        {e.parcela}/{e.total_parcela}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold">{e.despesa}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">{e.justificativa}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
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
                            className="text-red-500"
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
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black">Ajustar Teto</DialogTitle>
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
              className="w-full bg-blue-600 font-black h-14 rounded-2xl"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[600px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black">Confirmar Importação</DialogTitle>
          </DialogHeader>
          <div className="max-h-[300px] overflow-auto">
            <Table>
              <TableBody>
                {importPreview.slice(0, 5).map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{item.despesa}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(Number(item.valor))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={confirmImport} className="bg-emerald-600 font-black w-full h-12 rounded-xl">
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
                  toast.success("Atualizado!");
                  setFormOpen(false);
                },
              },
            );
          else
            addExpense.mutate(payload, {
              onSuccess: () => {
                toast.success("Adicionado!");
                setFormOpen(false);
              },
            });
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent className="rounded-3xl border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black">Excluir?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">Não</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 font-black"
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
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
