import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Expense, ExpenseInsert } from "@/hooks/useExpenses";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ExpenseInsert) => void;
  initialData?: Expense | null;
}

const defaultForm: ExpenseInsert = {
  banco: "",
  cartao: "",
  valor: 0,
  data: null,
  parcela: 0,
  total_parcela: 0,
  despesa: "",
  justificativa: "",
  classificacao: "",
  fatura: null,
};

export function ExpenseForm({ open, onOpenChange, onSubmit, initialData }: Props) {
  const [form, setForm] = useState<ExpenseInsert>(defaultForm);

  useEffect(() => {
    if (initialData) {
      setForm({
        banco: initialData.banco,
        cartao: initialData.cartao,
        valor: initialData.valor,
        data: initialData.data,
        parcela: initialData.parcela,
        total_parcela: initialData.total_parcela,
        despesa: initialData.despesa,
        justificativa: initialData.justificativa,
        classificacao: initialData.classificacao,
        fatura: initialData.fatura,
      });
    } else {
      setForm(defaultForm);
    }
  }, [initialData, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
    onOpenChange(false);
  };

  const set = (key: keyof ExpenseInsert, value: string | number | null) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Gasto" : "Novo Gasto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div>
            <Label>Banco</Label>
            <Input value={form.banco} onChange={(e) => set("banco", e.target.value)} required />
          </div>
          <div>
            <Label>Cartão</Label>
            <Input value={form.cartao} onChange={(e) => set("cartao", e.target.value)} required />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={form.valor} onChange={(e) => set("valor", parseFloat(e.target.value) || 0)} required />
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={form.data || ""} onChange={(e) => set("data", e.target.value || null)} />
          </div>
          <div>
            <Label>Parcela</Label>
            <Input type="number" value={form.parcela} onChange={(e) => set("parcela", parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Total Parcelas</Label>
            <Input type="number" value={form.total_parcela} onChange={(e) => set("total_parcela", parseInt(e.target.value) || 0)} />
          </div>
          <div className="col-span-2">
            <Label>Despesa</Label>
            <Input value={form.despesa || ""} onChange={(e) => set("despesa", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Justificativa</Label>
            <Input value={form.justificativa || ""} onChange={(e) => set("justificativa", e.target.value)} />
          </div>
          <div>
            <Label>Classificação</Label>
            <Input value={form.classificacao || ""} onChange={(e) => set("classificacao", e.target.value)} />
          </div>
          <div>
            <Label>Fatura</Label>
            <Input type="date" value={form.fatura || ""} onChange={(e) => set("fatura", e.target.value || null)} />
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
