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
import { Plus, Pencil, Trash2, Upload, Target, ArrowUpDown, ArrowUp, ArrowDown, Check, Wallet } from "lucide-react";
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
        const matchJust = filters.justificativa === "all" || e.justificativa === filters.justificativa;
        const faturafmt = e.fatura ? e.fatura.slice(0, 7) : "all";
        const matchFatura = filters.fatura === "all" || faturafmt === filters.fatura;
        return matchSearch && matchBanco && matchCat && matchJust && matchFatura;
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

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
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

  if (isLoading)
    return <div className="h-screen flex items-center justify-center font-bold text-slate-500">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-8">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">💳 Controle de Gastos</h1>
            <p className="text-blue-100 text-sm mt-1">Acompanhamento mensal detalhado</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Button variant="outline" className="bg-white/10 hover:bg-white/20 border-white/30 text-white font-bold">
                <Upload className="mr-2 h-4 w-4" /> Importar
              </Button>
            </div>
            <Button
              className="bg-white text-blue-600 hover:bg-blue-50 border-none font-bold"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Novo Gasto
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 mt-6 space-y-6">
        {/* Filtros */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap gap-3 items-center">
          <Input
            className="pl-4 h-10 flex-1 min-w-[200px]"
            placeholder="Buscar despesa..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <Select value={filters.banco} onValueChange={(v) => setFilters((f) => ({ ...f, banco: v }))}>
            <SelectTrigger className="w-[140px] h-10">
              <SelectValue placeholder="Bancos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos bancos</SelectItem>
              {unique("banco").map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.classificacao} onValueChange={(v) => setFilters((f) => ({ ...f, classificacao: v }))}>
            <SelectTrigger className="w-[140px] h-10">
              <SelectValue placeholder="Categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {unique("classificacao").map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.fatura} onValueChange={(v) => setFilters((f) => ({ ...f, fatura: v }))}>
            <SelectTrigger className="w-[140px] h-10">
              <SelectValue placeholder="Faturas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas faturas</SelectItem>
              {unique("fatura").map((f) => (
                <SelectItem key={f} value={f}>
                  {formatFatura(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Indicadores */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-[#3b82f6] text-white rounded-xl p-5 shadow-sm">
            <p className="text-sm font-medium opacity-90">Total em Gastos</p>
            <h2 className="text-2xl font-bold mt-1">{formatCurrency(totalSpent)}</h2>
          </div>
          <div
            className={cn(
              "text-white rounded-xl p-5 shadow-sm cursor-pointer hover:brightness-110",
              remainingBudget < 0 ? "bg-red-500" : "bg-[#8b5cf6]",
            )}
            onClick={() => setBudgetDialogOpen(true)}
          >
            <div className="flex justify-between items-center opacity-90">
              <p className="text-sm font-medium">Saldo do Teto</p>
              <Target size={16} />
            </div>
            <h2 className="text-2xl font-bold mt-1">{formatCurrency(remainingBudget)}</h2>
          </div>
          <div className="bg-[#10b981] text-white rounded-xl p-5 shadow-sm">
            <p className="text-sm font-medium opacity-90">Transações</p>
            <h2 className="text-2xl font-bold mt-1">{filteredAndSorted.length}</h2>
          </div>
          <div className="bg-[#14b8a6] text-white rounded-xl p-5 shadow-sm">
            <p className="text-sm font-medium opacity-90">Bancos</p>
            <h2 className="text-2xl font-bold mt-1">{uniqueBancos}</h2>
          </div>
          <div className="bg-[#f97316] text-white rounded-xl p-5 shadow-sm">
            <p className="text-sm font-medium opacity-90">Categorias</p>
            <h2 className="text-2xl font-bold mt-1">{uniqueCats}</h2>
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="bg-transparent space-x-2 p-0 mb-6">
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg border border-slate-200"
            >
              ☷ Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="tabela"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg border border-slate-200"
            >
              ⊞ Tabela
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-600 mb-6 uppercase">Gastos por Banco / Cartão</h3>
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
                    <Legend iconType="square" wrapperStyle={{ fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-600 mb-6 uppercase">Evolução por Fatura</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={areaData}>
                    <defs>
                      <linearGradient id="colorPurple" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-xs text-slate-500" />
                    <YAxis
                      tickFormatter={(v) => `R$${v / 1000}k`}
                      axisLine={false}
                      tickLine={false}
                      className="text-xs text-slate-500"
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Area type="monotone" dataKey="valor" stroke="#8b5cf6" fill="url(#colorPurple)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-semibold text-slate-600 uppercase">Acompanhamento de Parcelas</h3>
                <Select value={installmentFilter} onValueChange={setInstallmentFilter}>
                  <SelectTrigger className="w-[200px] h-8 text-xs">
                    <SelectValue placeholder="Filtrar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
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
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip cursor={{ fill: "transparent" }} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="Pagas" stackId="a" fill="#10b981" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="Restantes" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="tabela">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead onClick={() => handleSort("banco")} className="cursor-pointer">
                      Banco {getSortIcon("banco")}
                    </TableHead>
                    <TableHead onClick={() => handleSort("valor")} className="text-right cursor-pointer">
                      Valor {getSortIcon("valor")}
                    </TableHead>
                    <TableHead onClick={() => handleSort("data")} className="cursor-pointer">
                      Data {getSortIcon("data")}
                    </TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Despesa</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((e) => {
                    const vParcela = Number(e.valor);
                    const vFalta = vParcela * (e.total_parcela - e.parcela + 1);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-bold">{e.banco}</TableCell>
                        <TableCell className="text-right">
                          <div className="font-black text-blue-600">{formatCurrency(vParcela)}</div>
                          {e.total_parcela > 1 && (
                            <div className="text-[9px] text-orange-600 font-bold uppercase">
                              Falta: {formatCurrency(vFalta)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{format(parseISO(e.data), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="font-bold text-xs">
                          {e.parcela}/{e.total_parcela}
                        </TableCell>
                        <TableCell>
                          <div className="font-bold">{e.despesa}</div>
                          <div className="text-[10px] text-slate-400 italic">{e.justificativa}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className="font-bold text-[10px] uppercase">{e.classificacao}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 justify-end">
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* DIALOGS */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Ajustar Teto</DialogTitle>
            <DialogDescription>Seu limite de gastos.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              value={tempBudget}
              onChange={(e) => setTempBudget(Number(e.target.value))}
              className="text-3xl font-black text-center h-16"
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
              className="w-full bg-blue-600 font-bold h-12"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black">CONFERIR DADOS</DialogTitle>
            <DialogDescription>Verifique se os valores estão corretos.</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Despesa</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Fatura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {importPreview.slice(0, 10).map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>{item.despesa}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(Number(item.valor))}</TableCell>
                  <TableCell>{formatFatura(item.fatura)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmImport} className="bg-emerald-600 font-bold">
              <Check className="mr-2 h-4 w-4" /> Confirmar {importPreview.length} Itens
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
            updateExpense.mutate({ id: editing.id, ...payload }, { onSuccess: () => toast.success("Atualizado!") });
          } else {
            addExpense.mutate(payload, { onSuccess: () => toast.success("Adicionado!") });
          }
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir?</AlertDialogTitle>
            <AlertDialogDescription>Isso não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600"
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
