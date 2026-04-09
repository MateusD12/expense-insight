import { useState, useMemo } from "react";
import { useExpenses, type Expense } from "@/hooks/useExpenses";
import { ExpenseForm } from "@/components/ExpenseForm";
import { SummaryCards } from "@/components/SummaryCards";
import { RankedList } from "@/components/RankedList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Upload } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const COLORS = [
  "hsl(220,70%,50%)", "hsl(340,70%,50%)", "hsl(160,70%,40%)",
  "hsl(30,80%,50%)", "hsl(270,60%,50%)", "hsl(190,70%,45%)",
  "hsl(0,70%,50%)", "hsl(50,80%,45%)", "hsl(120,50%,40%)", "hsl(300,50%,50%)",
];

const BADGE_COLORS: Record<string, string> = {
  Estudos: "bg-blue-100 text-blue-800",
  Saúde: "bg-red-100 text-red-800",
  Lazer: "bg-purple-100 text-purple-800",
  Alimentação: "bg-orange-100 text-orange-800",
  Compras: "bg-pink-100 text-pink-800",
  Transporte: "bg-green-100 text-green-800",
  Assinatura: "bg-indigo-100 text-indigo-800",
  Presente: "bg-yellow-100 text-yellow-800",
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string | null) => {
  if (!d) return "-";
  try { return format(new Date(d + "T12:00:00"), "dd/MM/yyyy"); } catch { return d; }
};

const formatFatura = (d: string | null) => {
  if (!d) return "-";
  try { return format(new Date(d + "T12:00:00"), "MMM/yyyy", { locale: ptBR }); } catch { return d; }
};

interface Filters {
  search: string;
  fatura: string;
  banco: string;
  cartao: string;
  classificacao: string;
}

export default function Index() {
  const { data: allExpenses = [], isLoading, addExpense, updateExpense, deleteExpense } = useExpenses();
  const [filters, setFilters] = useState<Filters>({ search: "", fatura: "all", banco: "all", cartao: "all", classificacao: "all" });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return allExpenses.filter((e) => {
      if (filters.fatura !== "all" && e.fatura !== filters.fatura) return false;
      if (filters.banco !== "all" && e.banco !== filters.banco) return false;
      if (filters.cartao !== "all" && e.cartao !== filters.cartao) return false;
      if (filters.classificacao !== "all" && e.classificacao !== filters.classificacao) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!(e.despesa?.toLowerCase().includes(s) || e.justificativa?.toLowerCase().includes(s) || e.classificacao?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [allExpenses, filters]);

  const unique = (key: keyof Expense) =>
    [...new Set(allExpenses.map((e) => e[key]).filter(Boolean) as string[])].sort();

  const cartoes = filters.banco === "all"
    ? unique("cartao")
    : [...new Set(allExpenses.filter((e) => e.banco === filters.banco).map((e) => e.cartao))].sort();

  // Chart data
  const areaData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => { if (e.fatura) map[e.fatura] = (map[e.fatura] || 0) + Number(e.valor); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([f, v]) => ({
      name: format(new Date(f + "T12:00:00"), "MMM/yy", { locale: ptBR }),
      valor: Math.round(v * 100) / 100,
    }));
  }, [filtered]);

  const pieData = useMemo(() => {
    const map: Record<string, { valor: number; cartoes: Set<string> }> = {};
    filtered.forEach((e) => {
      if (!map[e.banco]) map[e.banco] = { valor: 0, cartoes: new Set() };
      map[e.banco].valor += Number(e.valor);
      map[e.banco].cartoes.add(e.cartao);
    });
    const entries = Object.entries(map).map(([banco, { valor, cartoes }]) => ({
      name: banco, sub: [...cartoes].map(c => `••${c}`).join(", "),
      valor: Math.round(valor * 100) / 100,
    }));
    const t = entries.reduce((s, e) => s + e.valor, 0);
    return entries.map((e) => ({ ...e, pct: t > 0 ? Math.round((e.valor / t) * 1000) / 10 : 0 }));
  }, [filtered]);

  const topClassificacao = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => { if (e.classificacao) map[e.classificacao] = (map[e.classificacao] || 0) + Number(e.valor); });
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, valor]) => ({ name, valor: Math.round(valor * 100) / 100 }));
  }, [filtered]);

  const topJustificativa = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => { if (e.justificativa) map[e.justificativa] = (map[e.justificativa] || 0) + Number(e.valor); });
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, valor]) => ({ name, valor: Math.round(valor * 100) / 100 }));
  }, [filtered]);

  if (isLoading) return <div className="flex items-center justify-center h-screen text-muted-foreground">Carregando...</div>;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">💳 Controle de Gastos</h1>
              <p className="text-blue-100 text-sm mt-1">Gerencie seus gastos de cartão de crédito</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Upload className="mr-1 h-4 w-4" /> Importar Planilha
              </Button>
              <Button className="bg-white text-blue-700 hover:bg-blue-50" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="mr-1 h-4 w-4" /> Novo Gasto
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar despesa..."
              className="pl-9"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          <Select value={filters.banco} onValueChange={(v) => setFilters((f) => ({ ...f, banco: v, cartao: "all" }))}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Banco" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Bancos</SelectItem>
              {unique("banco").map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.cartao} onValueChange={(v) => setFilters((f) => ({ ...f, cartao: v }))}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Cartão" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Cartões</SelectItem>
              {cartoes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.classificacao} onValueChange={(v) => setFilters((f) => ({ ...f, classificacao: v }))}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {unique("classificacao").map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.fatura} onValueChange={(v) => setFilters((f) => ({ ...f, fatura: v }))}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Fatura" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Faturas</SelectItem>
              {unique("fatura").map((f) => (
                <SelectItem key={f} value={f}>{formatFatura(f)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <SummaryCards expenses={filtered} />

        {/* Tabs */}
        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="tabela">Tabela</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-5 mt-4">
            <div className="grid gap-5 md:grid-cols-2">
              {/* Donut Chart */}
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-2">Gastos por Banco / Cartão</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="valor" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 justify-center mt-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-foreground font-medium">{d.name}</span>
                      <span className="text-muted-foreground">({d.sub}) {d.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Area Chart */}
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-2">Evolução por Fatura</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={areaData}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(250,70%,60%)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(250,70%,60%)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `R$${v}`} className="text-xs" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Area type="monotone" dataKey="valor" stroke="hsl(250,70%,60%)" fill="url(#areaGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <RankedList data={topClassificacao} title="Top 10 — Classificação" />
              <RankedList data={topJustificativa} title="Top 10 — Justificativa" />
            </div>
          </TabsContent>

          <TabsContent value="tabela" className="mt-4">
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Banco</TableHead>
                    <TableHead>Cartão</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Despesa</TableHead>
                    <TableHead>Justificativa</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Fatura</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhum gasto encontrado</TableCell></TableRow>
                  ) : filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.banco}</TableCell>
                      <TableCell>••{e.cartao}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">{formatCurrency(Number(e.valor))}</TableCell>
                      <TableCell>{formatDate(e.data)}</TableCell>
                      <TableCell>{e.parcela > 0 ? `${e.parcela}/${e.total_parcela}` : "-"}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{e.despesa || "-"}</TableCell>
                      <TableCell>{e.justificativa || "-"}</TableCell>
                      <TableCell>
                        {e.classificacao ? (
                          <Badge className={`${BADGE_COLORS[e.classificacao] || "bg-gray-100 text-gray-800"} border-0 font-medium`}>
                            {e.classificacao}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{formatFatura(e.fatura)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(e); setFormOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(e.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* Form Dialog */}
      <ExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editing}
        onSubmit={(data) => {
          if (editing) {
            updateExpense.mutate({ id: editing.id, ...data }, {
              onSuccess: () => toast.success("Gasto atualizado!"),
              onError: () => toast.error("Erro ao atualizar"),
            });
          } else {
            addExpense.mutate(data, {
              onSuccess: () => toast.success("Gasto adicionado!"),
              onError: () => toast.error("Erro ao adicionar"),
            });
          }
        }}
      />

      {/* Delete Dialog */}
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir gasto?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deleting) deleteExpense.mutate(deleting, {
                onSuccess: () => { toast.success("Excluído!"); setDeleting(null); },
                onError: () => toast.error("Erro ao excluir"),
              });
            }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
