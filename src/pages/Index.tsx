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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Pencil, Trash2, Upload, LogOut, Chrome, Wallet, Target } from "lucide-react";
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
    if (data && data.budget !== null) {
      setBudget(Number(data.budget));
    } else {
      setBudget(null);
    }
  };

  const handleSaveBudget = async () => {
    if (!session?.user?.id) return;
    const { error } = await supabase.from("profiles").upsert({ id: session.user.id, budget: tempBudget });
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

  // MOTOR DE IMPORTAÇÃO BLINDADO
  const confirmImport = async () => {
    if (!session?.user?.id) return;
    try {
      for (const item of importPreview) {
        // Conversão segura de data (DD/MM/YYYY para YYYY-MM-DD)
        let dataSegura = item.data;
        if (dataSegura && dataSegura.includes("/")) {
          const p = dataSegura.split("/");
          if (p.length === 3) dataSegura = `${p[2]}-${p[1]}-${p[0]}`;
        }

        // Tratamento para fatura vazia não bugar o banco
        let faturaSegura = null;
        if (item.fatura && item.fatura.trim() !== "") {
          faturaSegura = item.fatura.length === 7 ? `${item.fatura}-01` : item.fatura;
        }

        const payload = {
          banco: item.banco || "Desconhecido",
          cartao: item.cartao || "",
          valor: Number(item.valor) || 0,
          data: dataSegura || new Date().toISOString().split("T")[0],
          despesa: item.despesa || "Importado",
          classificacao: item.classificacao || "Outros",
          justificativa: item.justificativa || "",
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

  const chartData = useMemo(() => {
    const banks: Record<string, number> = {};
    const cats: Record<string, number> = {};
    const justs: Record<string, number> = {};

    filteredAndSorted.forEach((e) => {
      const val = Number(e.valor);
      const bankKey = `${e.banco} ••${e.cartao}`;
      banks[bankKey] = (banks[bankKey] || 0) + val;
      cats[e.classificacao || "Outros"] = (cats[e.classificacao || "Outros"] || 0) + val;
      justs[e.justificativa || "Outros"] = (justs[e.justificativa || "Outros"] || 0) + val;
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
    };
  }, [filteredAndSorted]);

  const totalSpent = useMemo(() => filteredAndSorted.reduce((acc, e) => acc + Number(e.valor), 0), [filteredAndSorted]);
  const uniqueFaturas = useMemo(
    () => [...new Set(allExpenses.map((e) => e.fatura?.slice(0, 7)).filter(Boolean))].sort(),
    [allExpenses],
  );

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
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-3 items-center">
          <Input
            className="pl-4 h-11 flex-1 min-w-[200px] bg-slate-50 border-none"
            placeholder="Buscar despesa ou justificativa..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <Select value={filters.fatura} onValueChange={(v) => setFilters((f) => ({ ...f, fatura: v }))}>
            <SelectTrigger className="w-[160px] h-11 bg-slate-50 border-none font-bold">
              <SelectValue placeholder="Faturas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {uniqueFaturas.map((f) => (
                <SelectItem key={f} value={f}>
                  {formatFatura(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <h3 className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest">
                  Gastos por Banco
                </h3>
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
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest">
                  Ranking por Categoria
                </h3>
                <ResponsiveContainer width="100%" height={250}>
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
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 md:col-span-2">
                <h3 className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest">
                  Top 8 Justificativas
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.justs} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: "bold" }} angle={-15} textAnchor="end" />
                    <YAxis tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
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
                  <TableRow className="bg-slate-50 border-none">
                    <TableHead className="font-black text-[10px] uppercase tracking-widest">Banco</TableHead>
                    <TableHead className="text-right font-black text-[10px] uppercase tracking-widest">Valor</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest">Data</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest">Despesa</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((e) => (
                    <TableRow key={e.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-slate-700">{e.banco}</TableCell>
                      <TableCell className="text-right">
                        <div className="font-black text-blue-600">{formatCurrency(Number(e.valor))}</div>
                        {e.total_parcela > 1 && (
                          <div className="text-[9px] text-orange-500 font-black uppercase">
                            {e.parcela}/{e.total_parcela}
                          </div>
                        )}
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
        <DialogContent className="rounded-3xl border-none">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-center">
              Ajustar Teto de Gastos
            </DialogTitle>
            <DialogDescription className="text-center font-bold">
              Deixe em zero para remover o limite do perfil.
            </DialogDescription>
          </DialogHeader>
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
        <DialogContent className="sm:max-w-[600px] rounded-3xl border-none">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-xl">Conferir Importação</DialogTitle>
            <DialogDescription className="hidden">
              Confirme os dados extraídos do arquivo para inserir no sistema.
            </DialogDescription>
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
        <AlertDialogContent className="rounded-3xl border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-xl">Excluir este registro?</AlertDialogTitle>
            <AlertDialogDescription className="hidden">
              Tem certeza que deseja apagar essa despesa?
            </AlertDialogDescription>
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
