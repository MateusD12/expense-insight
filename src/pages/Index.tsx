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
import { Plus, Pencil, Trash2, Upload, LogOut, Chrome, Wallet } from "lucide-react";
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
import { format } from "date-fns";
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
  const [budget, setBudget] = useState<number>(4000);
  const [tempBudget, setTempBudget] = useState(4000);

  // Estados de Auth
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup" | "recovery">("login");

  // Hook de despesas
  const { data: allExpenses = [], addExpense, updateExpense, deleteExpense } = useExpenses();

  const [filters, setFilters] = useState({ search: "", fatura: "all" });
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
    const { data } = await supabase.from("profiles").select("budget").eq("id", uid).single();
    if (data) {
      setBudget(Number(data.budget));
      setTempBudget(Number(data.budget));
    }
  };

  const handleSaveBudget = async () => {
    if (!session?.user?.id) return;
    const { error } = await supabase.from("profiles").upsert({ id: session.user.id, budget: tempBudget });
    if (!error) {
      setBudget(tempBudget);
      setBudgetDialogOpen(false);
      toast.success("Teto atualizado no seu perfil!");
    }
  };

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
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const loginWithGoogle = () =>
    supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  const handleLogout = () => supabase.auth.signOut();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim() !== "");
      const headers = lines[0].toLowerCase().split(/[;,]/);
      const parsed = lines.slice(1).map((line) => {
        const values = line.split(/[;,]/);
        const obj: any = {};
        headers.forEach((h, i) => {
          let v = values[i]?.replace(/"/g, "").trim();
          if (h.includes("valor")) v = v?.replace(",", ".");
          obj[h.trim()] = v;
        });
        return obj;
      });
      setImportPreview(parsed);
      setShowImportDialog(true);
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (!session?.user?.id) return;
    try {
      for (const item of importPreview) {
        await addExpense.mutateAsync({
          ...item,
          valor: Number(item.valor) || 0,
          parcela: Number(item.parcela) || 1,
          total_parcela: Number(item.total_parcelas || item.total_parcela) || 1,
          user_id: session.user.id,
        });
      }
      toast.success("Importado com sucesso!");
      setShowImportDialog(false);
    } catch (err) {
      toast.error("Erro na importação.");
    }
  };

  const filteredAndSorted = useMemo(() => {
    return allExpenses
      .filter((e) => {
        const matchSearch =
          e.despesa?.toLowerCase().includes(filters.search.toLowerCase()) ||
          e.justificativa?.toLowerCase().includes(filters.search.toLowerCase());
        const faturafmt = e.fatura ? e.fatura.slice(0, 7) : "all";
        const matchFatura = filters.fatura === "all" || faturafmt === filters.fatura;
        return matchSearch && matchFatura;
      })
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [allExpenses, filters]);

  // Lógica dos Gráficos (Pizza Corrigida e Classificação/Justificativa de volta)
  const chartData = useMemo(() => {
    const banks: Record<string, number> = {};
    const cats: Record<string, number> = {};
    const justs: Record<string, number> = {};
    const temporal: Record<string, number> = {};

    filteredAndSorted.forEach((e) => {
      const val = Number(e.valor);
      const bankKey = `${e.banco} ••${e.cartao}`;
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
        .slice(0, 8)
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
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email;

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
            <h1 className="text-3xl font-black">Financeiro</h1>
          </div>
          <div className="p-8 space-y-6">
            <Button onClick={loginWithGoogle} variant="outline" className="w-full h-12 font-bold flex gap-3">
              <Chrome size={20} className="text-blue-500" /> Entrar com Google
            </Button>
            <form onSubmit={handleAuth} className="space-y-4">
              <Input
                type="email"
                placeholder="E-mail"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Senha"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
              />
              <Button type="submit" className="w-full h-12 font-black bg-blue-600">
                {authMode === "login" ? "Entrar" : "Cadastrar"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white px-6 py-8 shadow-lg">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-white/20">
              <AvatarImage src={session.user.user_metadata?.avatar_url} />
              <AvatarFallback>{userName?.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-black uppercase">Olá, {userName?.split(" ")[0]}</h1>
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
              <Button variant="outline" className="bg-white/10 text-white font-bold">
                <Upload size={18} className="mr-2" /> Importar
              </Button>
            </div>
            <Button
              className="bg-white text-blue-700 font-black"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus size={18} className="mr-2" /> Novo Gasto
            </Button>
            <Button variant="ghost" onClick={handleLogout} className="text-white hover:bg-red-500/20">
              <LogOut size={20} />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 mt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-600 text-white rounded-2xl p-5 shadow-xl">
            <p className="text-[10px] font-black opacity-80 uppercase">Total Gastos</p>
            <h2 className="text-2xl font-black">{formatCurrency(totalSpent)}</h2>
          </div>
          <div
            className={cn(
              "text-white rounded-2xl p-5 shadow-xl cursor-pointer",
              totalSpent > budget ? "bg-red-500" : "bg-purple-600",
            )}
            onClick={() => setBudgetDialogOpen(true)}
          >
            <p className="text-[10px] font-black uppercase opacity-80">Saldo do Teto ({formatCurrency(budget)})</p>
            <h2 className="text-2xl font-black">{formatCurrency(budget - totalSpent)}</h2>
          </div>
          <div className="bg-emerald-500 text-white rounded-2xl p-5 shadow-xl">
            <p className="text-[10px] font-black opacity-80 uppercase">Transações</p>
            <h2 className="text-2xl font-black">{filteredAndSorted.length}</h2>
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="bg-slate-200/50 p-1 mb-6 rounded-xl">
            <TabsTrigger value="dashboard" className="px-8 font-bold">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="tabela" className="px-8 font-bold">
              Tabela
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-xs font-black text-slate-400 mb-6 uppercase">Gastos por Banco</h3>
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
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {chartData.banks.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-xs font-black text-slate-400 mb-6 uppercase">Classificação dos Gastos</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData.cats} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fontWeight: "bold" }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 md:col-span-2">
                <h3 className="text-xs font-black text-slate-400 mb-6 uppercase">Top 8 Justificativas</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.justs}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
            <DialogTitle className="font-black">Ajustar Teto Global</DialogTitle>
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
            <Button onClick={handleSaveBudget} className="w-full bg-blue-600 font-black h-14 rounded-2xl">
              Salvar no Perfil
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
          if (editing) updateExpense.mutate({ id: editing.id, ...payload }, { onSuccess: () => setFormOpen(false) });
          else addExpense.mutate(payload, { onSuccess: () => setFormOpen(false) });
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
