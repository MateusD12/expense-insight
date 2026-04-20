import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, AlertTriangle, Link2, Loader2, FileText, ArrowUpDown, ChevronDown, ChevronRight, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { ParsedInvoice, ParsedTransaction } from "@/lib/parseItauPdf";
import type { Expense, ExpenseInsert } from "@/hooks/useExpenses";
import { ComboCell } from "@/components/ComboCell";

type Status = "new" | "duplicate" | "installment";
type Action = "import" | "skip";
type SortKey = "data" | "despesa" | "valor";

interface ReviewItem {
  tx: ParsedTransaction;
  status: Status;
  match?: Expense;
  action: Action;
  despesa: string;
  classificacao: string;
  justificativa: string;
  touched: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: ParsedInvoice | null;
  allExpenses: Expense[];
  banco: string;
  userId: string;
  onImport: (items: ExpenseInsert[]) => Promise<void>;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}

function findMatch(tx: ParsedTransaction, allExpenses: Expense[]): { status: Status; match?: Expense } {
  const txBaseNorm = normalize(tx.estabelecimentoBase);
  const txCart = tx.cartao;
  const txFatura = tx.fatura;

  if (tx.totalParcela > 1) {
    const prevParcela = tx.parcela - 1;
    const prev = allExpenses.find((e) => {
      if (e.cartao !== txCart) return false;
      if ((e.total_parcela || 0) !== tx.totalParcela) return false;
      if ((e.parcela || 0) !== prevParcela && (e.parcela || 0) !== tx.parcela) return false;
      const eNorm = normalize(e.despesa || "");
      return eNorm.includes(txBaseNorm) || txBaseNorm.includes(eNorm);
    });
    if (prev) {
      if ((prev.parcela || 0) === tx.parcela) return { status: "duplicate", match: prev };
      return { status: "installment", match: prev };
    }
  }

  const dup = allExpenses.find((e) => {
    if (e.cartao !== txCart) return false;
    if (!e.fatura || e.fatura.slice(0, 7) !== txFatura.slice(0, 7)) return false;
    if (Math.abs(Number(e.valor) - tx.valor) > 0.01) return false;
    const eNorm = normalize(e.despesa || "");
    return eNorm.includes(txBaseNorm) || txBaseNorm.includes(eNorm);
  });
  if (dup) return { status: "duplicate", match: dup };

  return { status: "new" };
}

export function InvoiceImport({ open, onOpenChange, invoice, allExpenses, banco, userId, onImport }: Props) {
  const initialItems: ReviewItem[] = useMemo(() => {
    if (!invoice) return [];
    return invoice.transacoes.map((tx) => {
      const m = findMatch(tx, allExpenses);
      return {
        tx,
        status: m.status,
        match: m.match,
        action: m.status === "duplicate" ? "skip" : "import",
        despesa: tx.estabelecimentoBase || tx.estabelecimento,
        classificacao: tx.classificacao,
        justificativa: tx.totalParcela > 1 ? tx.estabelecimentoBase : "",
        touched: false,
      };
    });
  }, [invoice, allExpenses]);

  const [items, setItems] = useState<ReviewItem[]>(initialItems);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [hideClassified, setHideClassified] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortAsc, setSortAsc] = useState(true);
  const [classifiedOpen, setClassifiedOpen] = useState(false);

  useMemo(() => setItems(initialItems), [initialItems]);

  const classificacoesExistentes = useMemo(
    () => Array.from(new Set(allExpenses.map((e) => e.classificacao).filter(Boolean) as string[])).sort(),
    [allExpenses],
  );
  const justificativasExistentes = useMemo(
    () => Array.from(new Set(allExpenses.map((e) => e.justificativa).filter(Boolean) as string[])).sort(),
    [allExpenses],
  );

  const updateItem = (idx: number, patch: Partial<ReviewItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch, touched: true } : it)));
  };
  const toggleAction = (idx: number, checked: boolean) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, action: checked ? "import" : "skip" } : it)));
  };

  // Sort + filter
  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "data") cmp = a.tx.data.localeCompare(b.tx.data);
      else if (sortKey === "despesa") cmp = a.despesa.localeCompare(b.despesa);
      else cmp = a.tx.valor - b.tx.valor;
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [items, sortKey, sortAsc]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    const min = parseFloat(valorMin.replace(",", ".")) || -Infinity;
    const max = parseFloat(valorMax.replace(",", ".")) || Infinity;
    return sorted.filter((it) => {
      if (statusFilter !== "all" && it.status !== statusFilter) return false;
      if (it.tx.valor < min || it.tx.valor > max) return false;
      if (q) {
        const hay = normalize(`${it.despesa} ${it.classificacao} ${it.justificativa}`);
        if (!hay.includes(q)) return false;
      }
      if (hideClassified && it.touched && it.classificacao && it.justificativa) return false;
      return true;
    });
  }, [sorted, search, valorMin, valorMax, statusFilter, hideClassified]);

  // Indices originais para updates
  const indexOf = (item: ReviewItem) => items.indexOf(item);

  // Split: pendentes (não tocados) vs classificadas (tocadas)
  const pendentes = filtered.filter((it) => !it.touched);
  const classificadas = filtered.filter((it) => it.touched);

  const stats = useMemo(() => {
    let toImport = 0, toSkip = 0, total = 0, dup = 0;
    items.forEach((it) => {
      if (it.status === "duplicate") dup++;
      if (it.action === "import") { toImport++; total += it.tx.valor; } else toSkip++;
    });
    return { toImport, toSkip, total, dup, pendentes: items.filter((i) => !i.touched).length, classificadas: items.filter((i) => i.touched).length };
  }, [items]);

  if (!invoice) return null;

  const handleImport = async () => {
    const selected = items.filter((it) => it.action === "import");
    if (selected.length === 0) {
      toast.error("Nenhuma transação selecionada para importar.");
      return;
    }
    setImporting(true);
    try {
      const payloads: ExpenseInsert[] = selected.map((it) => ({
        banco,
        cartao: it.tx.cartao,
        valor: it.tx.valor,
        data: it.tx.data,
        despesa: it.despesa,
        classificacao: it.classificacao,
        justificativa: it.justificativa || null,
        parcela: it.tx.parcela,
        total_parcela: it.tx.totalParcela,
        fatura: it.tx.fatura,
        fatura_original: null,
        user_id: userId,
      }));
      await onImport(payloads);
      toast.success(`${selected.length} transação(ões) importada(s)!`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar.");
    } finally {
      setImporting(false);
    }
  };

  const StatusBadge = ({ status }: { status: Status }) => {
    if (status === "new")
      return <Badge className="bg-green-100 text-green-800 border-green-200 gap-1"><CheckCircle2 size={12} /> Nova</Badge>;
    if (status === "duplicate")
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1"><AlertTriangle size={12} /> Duplicata</Badge>;
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1"><Link2 size={12} /> Parcela</Badge>;
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortHeader = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button onClick={() => toggleSort(k)} className="flex items-center gap-1 hover:text-foreground">
        {children} <ArrowUpDown size={12} className={sortKey === k ? "opacity-100" : "opacity-40"} />
      </button>
    </TableHead>
  );

  const renderRow = (it: ReviewItem) => {
    const idx = indexOf(it);
    return (
      <TableRow key={idx} className={it.action === "skip" ? "opacity-50" : ""}>
        <TableCell>
          <Checkbox checked={it.action === "import"} onCheckedChange={(c) => toggleAction(idx, !!c)} />
        </TableCell>
        <TableCell className="text-xs">{format(parseISO(it.tx.data), "dd/MM/yy")}</TableCell>
        <TableCell>
          <Input
            value={it.despesa}
            onChange={(e) => updateItem(idx, { despesa: e.target.value })}
            className="h-8 text-xs min-w-[160px]"
          />
          {it.match && (
            <div className="text-[10px] text-muted-foreground mt-1">
              ↪ {it.match.despesa} ({it.match.parcela}/{it.match.total_parcela})
            </div>
          )}
        </TableCell>
        <TableCell>
          <ComboCell
            value={it.classificacao}
            options={classificacoesExistentes}
            onChange={(v) => updateItem(idx, { classificacao: v })}
            width="w-[120px]"
          />
        </TableCell>
        <TableCell>
          <ComboCell
            value={it.justificativa}
            options={justificativasExistentes}
            onChange={(v) => updateItem(idx, { justificativa: v })}
            placeholder="-"
            width="w-[130px]"
          />
        </TableCell>
        <TableCell className="text-center text-xs whitespace-nowrap">{it.tx.parcela}/{it.tx.totalParcela}</TableCell>
        <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrency(it.tx.valor)}</TableCell>
        <TableCell><StatusBadge status={it.status} /></TableCell>
      </TableRow>
    );
  };

  const TableHeaderRow = () => (
    <TableHeader className="sticky top-0 bg-background z-10">
      <TableRow>
        <TableHead className="w-12">
          <Checkbox
            checked={items.every((it) => it.action === "import")}
            onCheckedChange={(checked) =>
              setItems((prev) => prev.map((it) => ({ ...it, action: checked ? "import" : "skip" })))
            }
          />
        </TableHead>
        <SortHeader k="data">Data</SortHeader>
        <SortHeader k="despesa">Despesa</SortHeader>
        <TableHead>Classificação</TableHead>
        <TableHead>Justificativa</TableHead>
        <TableHead className="text-center">Parcela</TableHead>
        <SortHeader k="valor" className="text-right">Valor</SortHeader>
        <TableHead>Status</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={20} /> Revisar Fatura {banco} — Cartão •••• {invoice.cartao}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-3 text-sm bg-muted p-3 rounded-lg">
          <div><span className="text-muted-foreground">Vencimento:</span> <strong>{format(parseISO(invoice.vencimento), "dd/MM/yyyy", { locale: ptBR })}</strong></div>
          <div><span className="text-muted-foreground">Fatura:</span> <strong>{format(parseISO(invoice.fatura), "MMM/yy", { locale: ptBR })}</strong></div>
          <div><span className="text-muted-foreground">Total PDF:</span> <strong>{formatCurrency(invoice.totalFatura)}</strong></div>
          <div className="ml-auto flex gap-2 flex-wrap">
            <Badge variant="outline">A importar: {stats.toImport}</Badge>
            <Badge variant="outline">A pular: {stats.toSkip}</Badge>
            <Badge className="bg-blue-600">{formatCurrency(stats.total)}</Badge>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar despesa, classificação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 text-xs"
            />
          </div>
          <Input
            placeholder="Valor min"
            value={valorMin}
            onChange={(e) => setValorMin(e.target.value)}
            className="h-8 w-24 text-xs"
          />
          <Input
            placeholder="Valor max"
            value={valorMax}
            onChange={(e) => setValorMax(e.target.value)}
            className="h-8 w-24 text-xs"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="new">Novas</SelectItem>
              <SelectItem value="duplicate">Duplicatas</SelectItem>
              <SelectItem value="installment">Parcelas</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1 text-xs cursor-pointer">
            <Checkbox checked={hideClassified} onCheckedChange={(c) => setHideClassified(!!c)} />
            Esconder classificadas
          </label>
        </div>

        <div className="overflow-auto flex-1 border rounded-lg">
          <Table>
            <TableHeaderRow />
            <TableBody>
              {pendentes.length > 0 && (
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={8} className="text-xs font-semibold py-1.5">
                    Pendentes de classificação ({pendentes.length})
                  </TableCell>
                </TableRow>
              )}
              {pendentes.map(renderRow)}
              {classificadas.length > 0 && (
                <>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={8} className="py-1.5">
                      <button
                        onClick={() => setClassifiedOpen((o) => !o)}
                        className="flex items-center gap-1 text-xs font-semibold"
                      >
                        {classifiedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        Já classificadas ({classificadas.length})
                      </button>
                    </TableCell>
                  </TableRow>
                  {classifiedOpen && classificadas.map(renderRow)}
                </>
              )}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    Nenhuma transação corresponde aos filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
          <span>{stats.pendentes} pendentes</span>
          <span>·</span>
          <span>{stats.classificadas} classificadas</span>
          <span>·</span>
          <span>{stats.dup} duplicatas</span>
          <span>·</span>
          <span>Total no PDF: {items.length} transações</span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>Cancelar</Button>
          <Button onClick={handleImport} disabled={importing || stats.toImport === 0}>
            {importing && <Loader2 size={16} className="animate-spin mr-2" />}
            Importar {stats.toImport} despesa(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
