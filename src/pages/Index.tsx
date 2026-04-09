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
import { Plus, Pencil, Trash2, Search, Upload, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"; // Adicionei ícones aqui
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

// Novo: Interface para ordenação
interface SortConfig {
  key: keyof Expense | null;
  direction: 'asc' | 'desc';
}

export default function Index() {
  const { data: allExpenses = [], isLoading, addExpense, updateExpense, deleteExpense } = useExpenses();
  const [filters, setFilters] = useState<Filters>({ search: "", fatura: "all", banco: "all", cartao: "all", classificacao: "all" });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // 1. Estado de ordenação
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'data', direction: 'desc' });

  // 2. Lógica de filtrar E