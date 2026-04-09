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
  Download,
  Target,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LogOut,
  Wallet,
  Upload,
  Check,
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

  // Estados para Importação
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatFatura = (d: string | null) => {
    if (!d) return "-";
    try {
      return format(new Date(d.substring(0, 7) + "-01T12:00:00"), "MMM/yy", { locale: ptBR });
    } catch {
      return d;
    }
  };

  // --- EXPORTAR ---
  const exportToCSV = () => {
    if (allExpenses.length === 0) return toast.error("Sem dados.");
    const headers = [
      "Banco",
      "Cartao",
      "Valor",
      "Data",
      "Despesa",
      "Classificacao",
      "Justificativa",
      "Parcela",
      "Total_Parcelas",
      "Fatura",
    ];
    const rows = allExpenses.map((e) => [
      e.banco,
      e.cartao,
      e.valor.toString().replace(".", ","),
      e.data,
      `"${e.despesa}"`,
      e.classificacao,
      `"${e.justificativa}"`,
      e.parcela,
      e.total_parcela,
      e.fatura,
    ]);
    const csvContent = "\uFEFF" + [headers, ...rows].map((e) => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `backup_despesas.csv`;
    link.click();
    toast.success("Backup baixado!");
  };

  // --- IMPORTAR COM PRÉ-VISUALIZAÇÃO ---
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim() !== "");
      const headers = lines[0].toLowerCase().split(/[;,]/); // Aceita vírgula ou ponto e vírgula

      const parsedData = lines.slice(1).map((line) => {
        const values = line.split(/[;,]/);
        const obj: any = {};
        headers.forEach((header, i) => {
          let val = values[i]?.replace(/"/g, "").trim();

          // Tratamento especial para Valor (converte 14,48 para 14.48)
          if (header.includes("valor")) {
            val = val?.replace(",", ".");
          }
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
      toast.success("Todos os dados foram importados!");
      setShowImportDialog(false);
      setImportPreview([]);
    } catch (err) {
      toast.error("Erro durante a importação em massa.");
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
      return sortConfig.direction === "asc" ? (aVal < bVal ? -1 : 1) : aVal < bVal ? 1 : -1;
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

  if (isLoading)
    return <div className="h-screen flex items-center justify-center font-bold text-slate-500">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-8">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">💳 Controle de Gastos</h1>
            <p className="text-blue-100 text-sm mt-1">Gestão financeira e backup de segurança</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="bg-white/10 hover:bg-white/20 border-white/30 text-white"
              onClick={exportToCSV}
            >
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
                title="Importar CSV"
              />
              <Button className="bg-emerald-500 hover:bg-emerald-600 border-none font-bold">
                <Upload className="mr-2 h-4 w-4" /> Importar CSV
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
        {/* Barra de Filtros Simplificada */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap gap-3 items-center">
          <Input
            className="pl-4 h-10 flex-1 min-w-[200px]"
            placeholder="Buscar..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <Select value={filters.fatura} onValueChange={(v) => setFilters((f) => ({ ...f, fatura: v }))}>
            <SelectTrigger className="w-[160px] h-10">
              <SelectValue placeholder="Fatura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Faturas</SelectItem>
              {unique("fatura").map((f) => (
                <SelectItem key={f} value={f}>
                  {formatFatura(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="tabela">
          <TabsList className="bg-transparent space-x-2 p-0 mb-6">
            <TabsTrigger
              value="tabela"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg border border-slate-200"
            >
              Tabela de Gastos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tabela">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Banco</TableHead>
                    <TableHead className="text-right">Valor Parcela</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Despesa</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-bold text-slate-700">{e.banco}</TableCell>
                      <TableCell className="text-right font-black text-blue-600">
                        {formatCurrency(Number(e.valor))}
                      </TableCell>
                      <TableCell>{format(parseISO(e.data), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-bold text-xs">
                        {e.parcela}/{e.total_parcela}
                      </TableCell>
                      <TableCell className="font-bold">{e.despesa}</TableCell>
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
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* MODAL DE PRÉ-VISUALIZAÇÃO DA IMPORTAÇÃO */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">CONFERIR DADOS ANTES DE IMPORTAR</DialogTitle>
            <DialogDescription>
              Verifique se os valores abaixo estão corretos. Note que os valores foram convertidos para o formato de
              moeda.
            </DialogDescription>
          </DialogHeader>

          <div className="border rounded-lg overflow-hidden my-4">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Despesa</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Fatura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreview.slice(0, 10).map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.despesa}</TableCell>
                    <TableCell>{item.banco}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">
                      {formatCurrency(Number(item.valor))}
                    </TableCell>
                    <TableCell>
                      {item.parcela}/{item.total_parcelas || item.total_parcela}
                    </TableCell>
                    <TableCell className="text-xs uppercase">{formatFatura(item.fatura)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {importPreview.length > 10 && (
              <div className="p-3 text-center bg-slate-50 text-xs text-slate-500 font-bold border-t">
                ... e mais {importPreview.length - 10} linhas.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false);
                setImportPreview([]);
              }}
              className="font-bold"
            >
              Cancelar
            </Button>
            <Button onClick={confirmImport} className="bg-emerald-600 font-bold">
              <Check className="mr-2 h-4 w-4" /> Confirmar e Salvar {importPreview.length} Itens
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExpenseForm open={formOpen} onOpenChange={setFormOpen} initialData={editing} onSubmit={() => {}} />
    </div>
  );
}
