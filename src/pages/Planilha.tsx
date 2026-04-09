import { useState } from "react";
import { useExpenses, type Expense } from "@/hooks/useExpenses";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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

export default function Planilha() {
  const { data: expenses = [], isLoading, addExpense, updateExpense, deleteExpense } = useExpenses();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const total = expenses.reduce((s, e) => s + Number(e.valor), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planilha de Gastos</h1>
          <p className="text-muted-foreground text-sm">{expenses.length} registros · Total: {formatCurrency(total)}</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Novo Gasto
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
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
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : expenses.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhum gasto cadastrado</TableCell></TableRow>
            ) : expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.banco}</TableCell>
                <TableCell>{e.cartao}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(Number(e.valor))}</TableCell>
                <TableCell>{formatDate(e.data)}</TableCell>
                <TableCell>{e.parcela > 0 ? `${e.parcela}/${e.total_parcela}` : "-"}</TableCell>
                <TableCell className="max-w-[200px] truncate">{e.despesa || "-"}</TableCell>
                <TableCell>{e.justificativa || "-"}</TableCell>
                <TableCell>{e.classificacao || "-"}</TableCell>
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
