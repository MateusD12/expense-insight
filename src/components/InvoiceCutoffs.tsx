import { useMemo, useState } from "react";
import { format, parseISO, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2, Scissors, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Expense } from "@/hooks/useExpenses";
import { useInvoiceCutoffs } from "@/hooks/useInvoiceCutoffs";

interface Props {
  expenses: Expense[];
  userId: string;
}

interface DraftCutoff {
  banco: string;
  cartao: string;
  fatura: Date | undefined;
  data_corte: Date | undefined;
  data_vencimento: Date | undefined;
  editingId?: string;
}

const emptyDraft = (): DraftCutoff => ({
  banco: "",
  cartao: "",
  fatura: undefined,
  data_corte: undefined,
  data_vencimento: undefined,
});

const toISODate = (d: Date) => format(d, "yyyy-MM-dd");

export function InvoiceCutoffs({ expenses, userId }: Props) {
  const { data: cutoffs = [], upsertCutoff, deleteCutoff } = useInvoiceCutoffs();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<DraftCutoff>(emptyDraft());

  // Unique cards from expenses
  const cards = useMemo(() => {
    const seen = new Map<string, { banco: string; cartao: string }>();
    expenses.forEach((e) => {
      if (!e.banco || !e.cartao) return;
      const key = `${e.banco}::${e.cartao}`;
      if (!seen.has(key)) seen.set(key, { banco: e.banco, cartao: e.cartao });
    });
    return Array.from(seen.values()).sort((a, b) =>
      a.banco.localeCompare(b.banco) || a.cartao.localeCompare(b.cartao),
    );
  }, [expenses]);

  const cutoffsByCard = useMemo(() => {
    const map = new Map<string, typeof cutoffs>();
    cutoffs.forEach((c) => {
      const key = `${c.banco}::${c.cartao}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    map.forEach((list) => list.sort((a, b) => a.fatura.localeCompare(b.fatura)));
    return map;
  }, [cutoffs]);

  const openNew = (banco?: string, cartao?: string, faturaSeed?: Date) => {
    setDraft({
      ...emptyDraft(),
      banco: banco || "",
      cartao: cartao || "",
      fatura: faturaSeed,
    });
    setDialogOpen(true);
  };

  const openEdit = (c: (typeof cutoffs)[number]) => {
    setDraft({
      banco: c.banco,
      cartao: c.cartao,
      fatura: parseISO(c.fatura),
      data_corte: parseISO(c.data_corte),
      data_vencimento: parseISO(c.data_vencimento),
      editingId: c.id,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!draft.banco || !draft.cartao || !draft.fatura || !draft.data_corte || !draft.data_vencimento) {
      toast.error("Preencha banco, cartão, fatura, corte e vencimento.");
      return;
    }
    try {
      // Normalise fatura to first day of month
      const f = new Date(draft.fatura.getFullYear(), draft.fatura.getMonth(), 1);
      await upsertCutoff.mutateAsync({
        user_id: userId,
        banco: draft.banco,
        cartao: draft.cartao,
        fatura: toISODate(f),
        data_corte: toISODate(draft.data_corte),
        data_vencimento: toISODate(draft.data_vencimento),
      });
      toast.success("Corte salvo!");
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar corte.");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este corte?")) return;
    try {
      await deleteCutoff.mutateAsync(id);
      toast.success("Corte excluído.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir.");
    }
  };

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scissors size={18} className="text-blue-600" /> Datas de corte e vencimento
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Defina, por cartão, até que dia entram as despesas em cada fatura. Despesas do dia seguinte ao corte vão
              automaticamente para a fatura seguinte.
            </p>
          </div>
          <Button onClick={() => openNew()} size="sm">
            <Plus size={14} className="mr-1" /> Definir corte
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {cards.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              Nenhum cartão detectado nas despesas ainda.
            </p>
          )}
          {cards.map(({ banco, cartao }) => {
            const list = cutoffsByCard.get(`${banco}::${cartao}`) || [];
            const lastCutoff = list[list.length - 1];
            const needsNext = !lastCutoff || lastCutoff.data_corte < today;
            const suggestedNextFatura = lastCutoff
              ? addMonths(parseISO(lastCutoff.fatura), 1)
              : addMonths(new Date(), 1);

            return (
              <div key={`${banco}-${cartao}`} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="font-semibold text-sm">
                    {banco} <span className="text-muted-foreground">•••• {cartao}</span>
                  </div>
                  {needsNext && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openNew(banco, cartao, suggestedNextFatura)}
                      className="text-xs"
                    >
                      <AlertCircle size={12} className="mr-1 text-amber-500" />
                      Definir próxima fatura
                    </Button>
                  )}
                </div>

                {list.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhum corte cadastrado.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {list.map((c) => {
                      const isOpen = c.data_corte >= today;
                      return (
                        <div
                          key={c.id}
                          className={cn(
                            "flex items-center justify-between rounded-md border px-3 py-2 text-xs",
                            isOpen ? "bg-emerald-50/50 border-emerald-200" : "bg-slate-50",
                          )}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-bold uppercase">
                                {format(parseISO(c.fatura), "MMM/yy", { locale: ptBR })}
                              </Badge>
                              {isOpen && (
                                <Badge className="bg-emerald-600 text-white text-[10px]">Aberta</Badge>
                              )}
                            </div>
                            <div className="text-muted-foreground">
                              Corte: <strong>{format(parseISO(c.data_corte), "dd/MM/yyyy")}</strong> · Vence:{" "}
                              <strong>{format(parseISO(c.data_vencimento), "dd/MM/yyyy")}</strong>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(c)}>
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-destructive"
                              onClick={() => remove(c.id)}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{draft.editingId ? "Editar corte" : "Definir corte"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Banco</Label>
                {cards.length > 0 ? (
                  <Select
                    value={draft.banco && draft.cartao ? `${draft.banco}::${draft.cartao}` : ""}
                    onValueChange={(v) => {
                      const [b, c] = v.split("::");
                      setDraft((d) => ({ ...d, banco: b, cartao: c }));
                    }}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {cards.map((c) => (
                        <SelectItem key={`${c.banco}::${c.cartao}`} value={`${c.banco}::${c.cartao}`}>
                          {c.banco} •••• {c.cartao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={draft.banco} onChange={(e) => setDraft((d) => ({ ...d, banco: e.target.value }))} />
                )}
              </div>
              <div>
                <Label className="text-xs">Cartão (final)</Label>
                <Input
                  value={draft.cartao}
                  onChange={(e) => setDraft((d) => ({ ...d, cartao: e.target.value }))}
                  placeholder="0123"
                />
              </div>
            </div>

            <DateField
              label="Fatura (mês de referência)"
              value={draft.fatura}
              onChange={(d) => setDraft((s) => ({ ...s, fatura: d }))}
            />
            <DateField
              label="Data de corte"
              value={draft.data_corte}
              onChange={(d) => setDraft((s) => ({ ...s, data_corte: d }))}
            />
            <DateField
              label="Data de vencimento"
              value={draft.data_vencimento}
              onChange={(d) => setDraft((s) => ({ ...s, data_vencimento: d }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={upsertCutoff.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full justify-start text-left font-normal h-9", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd/MM/yyyy") : "Selecionar..."}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
