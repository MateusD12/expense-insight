import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, Link2, Loader2, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { ParsedInvoice, ParsedTransaction } from "@/lib/parseItauPdf";
import type { Expense, ExpenseInsert } from "@/hooks/useExpenses";

type Status = "new" | "duplicate" | "installment";
type Action = "import" | "skip";

interface ReviewItem {
  tx: ParsedTransaction;
  status: Status;
  match?: Expense; // possível duplicata ou parcela anterior
  action: Action;
  // Campos editáveis
  despesa: string;
  classificacao: string;
  justificativa: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: ParsedInvoice | null;
  allExpenses: Expense[];
  banco: string; // ex: "Itaú"
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

  // 1) Parcela detectada (XX/YY com YY>1): procura parcela imediatamente anterior já cadastrada
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
      // Se a parcela com mesmo número já existe, é duplicata
      if ((prev.parcela || 0) === tx.parcela) return { status: "duplicate", match: prev };
      return { status: "installment", match: prev };
    }
  }

  // 2) Duplicata simples: mesmo cartão + mesma fatura + valor idêntico + nome similar
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
        // Por padrão, duplicatas são puladas; parcelas/novas são importadas
        action: m.status === "duplicate" ? "skip" : "import",
        despesa: tx.estabelecimentoBase || tx.estabelecimento,
        classificacao: tx.classificacao,
        justificativa: tx.totalParcela > 1 ? tx.estabelecimentoBase : "",
      };
    });
  }, [invoice, allExpenses]);

  const [items, setItems] = useState<ReviewItem[]>(initialItems);
  const [importing, setImporting] = useState(false);

  // Reset ao abrir nova fatura
  useMemo(() => setItems(initialItems), [initialItems]);

  const updateItem = (idx: number, patch: Partial<ReviewItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const stats = useMemo(() => {
    let toImport = 0,
      toSkip = 0,
      total = 0;
    items.forEach((it) => {
      if (it.action === "import") {
        toImport++;
        total += it.tx.valor;
      } else toSkip++;
    });
    return { toImport, toSkip, total };
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
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
          <CheckCircle2 size={12} /> Nova
        </Badge>
      );
    if (status === "duplicate")
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1">
          <AlertTriangle size={12} /> Duplicata
        </Badge>
      );
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1">
        <Link2 size={12} /> Parcela
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={20} /> Revisar Fatura — Cartão •••• {invoice.cartao}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-3 text-sm bg-slate-50 p-3 rounded-lg">
          <div>
            <span className="text-slate-500">Vencimento:</span>{" "}
            <strong>{format(parseISO(invoice.vencimento), "dd/MM/yyyy", { locale: ptBR })}</strong>
          </div>
          <div>
            <span className="text-slate-500">Fatura:</span>{" "}
            <strong>{format(parseISO(invoice.fatura), "MMM/yy", { locale: ptBR })}</strong>
          </div>
          <div>
            <span className="text-slate-500">Total PDF:</span>{" "}
            <strong>{formatCurrency(invoice.totalFatura)}</strong>
          </div>
          <div className="ml-auto flex gap-2">
            <Badge variant="outline">A importar: {stats.toImport}</Badge>
            <Badge variant="outline">A pular: {stats.toSkip}</Badge>
            <Badge className="bg-blue-600">{formatCurrency(stats.total)}</Badge>
          </div>
        </div>

        <div className="overflow-auto flex-1 border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={items.every((it) => it.action === "import")}
                    onCheckedChange={(checked) =>
                      setItems((prev) => prev.map((it) => ({ ...it, action: checked ? "import" : "skip" })))
                    }
                  />
                </TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Despesa</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Justificativa</TableHead>
                <TableHead className="text-center">Parcela</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={idx} className={it.action === "skip" ? "opacity-50" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={it.action === "import"}
                      onCheckedChange={(checked) => updateItem(idx, { action: checked ? "import" : "skip" })}
                    />
                  </TableCell>
                  <TableCell className="text-xs">
                    {format(parseISO(it.tx.data), "dd/MM/yy")}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={it.despesa}
                      onChange={(e) => updateItem(idx, { despesa: e.target.value })}
                      className="h-8 text-xs min-w-[160px]"
                    />
                    {it.match && (
                      <div className="text-[10px] text-slate-500 mt-1">
                        ↪ {it.match.despesa} ({it.match.parcela}/{it.match.total_parcela})
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={it.classificacao}
                      onChange={(e) => updateItem(idx, { classificacao: e.target.value })}
                      className="h-8 text-xs w-[110px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={it.justificativa}
                      onChange={(e) => updateItem(idx, { justificativa: e.target.value })}
                      className="h-8 text-xs w-[120px]"
                      placeholder="-"
                    />
                  </TableCell>
                  <TableCell className="text-center text-xs whitespace-nowrap">
                    {it.tx.parcela}/{it.tx.totalParcela}
                  </TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap">
                    {formatCurrency(it.tx.valor)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={it.status} />
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-slate-500">
                    Nenhuma transação encontrada no PDF.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={importing || stats.toImport === 0}>
            {importing && <Loader2 size={16} className="animate-spin mr-2" />}
            Importar {stats.toImport} despesa(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
