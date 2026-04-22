import { useEffect, useMemo, useState } from "react";
import { useSubscriptions, type Subscription } from "@/hooks/useSubscriptions";
import { useExpenses, type Expense } from "@/hooks/useExpenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pause, Play, Pencil, Trash2, Sparkles, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  userId: string;
  expenses: Expense[];
}

const emptyForm = {
  nome: "",
  valor: 0,
  dia_cobranca: 1,
  banco: "",
  cartao: "",
  classificacao: "Assinatura",
  justificativa: "",
};

export function Subscriptions({ userId, expenses }: Props) {
  const { data: subs = [], addSubscription, updateSubscription, deleteSubscription, togglePause } = useSubscriptions();
  const { addExpense } = useExpenses();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState<string | null>(null);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (s: Subscription) => {
    setEditing(s);
    setForm({
      nome: s.nome,
      valor: Number(s.valor),
      dia_cobranca: s.dia_cobranca,
      banco: s.banco || "",
      cartao: s.cartao || "",
      classificacao: s.classificacao || "Assinatura",
      justificativa: s.justificativa || "",
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.nome.trim()) {
      toast.error("Informe o nome da assinatura.");
      return;
    }
    const payload = {
      nome: form.nome.trim(),
      valor: Number(form.valor) || 0,
      dia_cobranca: Math.min(Math.max(Number(form.dia_cobranca) || 1, 1), 31),
      banco: form.banco || null,
      cartao: form.cartao || null,
      classificacao: form.classificacao || "Assinatura",
      justificativa: form.justificativa || null,
      paused: false,
      last_generated_month: null as string | null,
      user_id: userId,
    };
    if (editing) {
      updateSubscription.mutate(
        { id: editing.id, ...payload },
        {
          onSuccess: () => {
            toast.success("Assinatura atualizada!");
            setOpen(false);
          },
        },
      );
    } else {
      addSubscription.mutate(payload, {
        onSuccess: () => {
          toast.success("Assinatura criada!");
          setOpen(false);
        },
      });
    }
  };

  // Sugestões: despesas com classificação Assinatura/Assinaturas que ainda não foram cadastradas como subscription.
  const suggestions = useMemo(() => {
    const subNames = new Set(subs.map((s) => s.nome.toLowerCase().trim()));
    const groups = new Map<string, { despesa: string; valor: number; dia: number; banco: string; cartao: string; justificativa: string | null }>();
    for (const e of expenses) {
      const cls = (e.classificacao || "").toLowerCase();
      if (cls !== "assinatura" && cls !== "assinaturas") continue;
      if (!e.despesa) continue;
      const key = e.despesa.toLowerCase().trim();
      if (subNames.has(key)) continue;
      const dia = e.data ? Number(e.data.substring(8, 10)) || 1 : 1;
      if (!groups.has(key)) {
        groups.set(key, {
          despesa: e.despesa,
          valor: Number(e.valor) || 0,
          dia,
          banco: e.banco,
          cartao: e.cartao,
          justificativa: e.justificativa,
        });
      }
    }
    return Array.from(groups.values());
  }, [expenses, subs]);

  const importSuggestion = (s: typeof suggestions[number]) => {
    addSubscription.mutate(
      {
        nome: s.despesa,
        valor: s.valor,
        dia_cobranca: s.dia,
        banco: s.banco || null,
        cartao: s.cartao || null,
        classificacao: "Assinatura",
        justificativa: s.justificativa,
        paused: false,
        last_generated_month: null,
        user_id: userId,
      },
      { onSuccess: () => toast.success(`"${s.despesa}" virou assinatura!`) },
    );
  };

  // Auto-lançamento: para cada assinatura ativa, se ainda não gerou despesa do mês corrente, gera.
  useEffect(() => {
    if (!userId || subs.length === 0) return;
    const now = new Date();
    const currentMonthKey = format(now, "yyyy-MM"); // mês corrente real
    // Fatura alvo = mês seguinte (regra do app)
    const faturaDate = addMonths(now, 1);
    const faturaStr = `${faturaDate.getFullYear()}-${String(faturaDate.getMonth() + 1).padStart(2, "0")}-01`;

    subs.forEach((s) => {
      if (s.paused) return;
      if (s.last_generated_month === currentMonthKey) return;

      // Verifica se já existe despesa do mês corrente para esta assinatura (evita duplicar)
      const alreadyExists = expenses.some(
        (e) =>
          e.despesa?.toLowerCase().trim() === s.nome.toLowerCase().trim() &&
          e.data?.substring(0, 7) === currentMonthKey,
      );
      if (alreadyExists) {
        updateSubscription.mutate({ id: s.id, last_generated_month: currentMonthKey });
        return;
      }

      const dia = Math.min(s.dia_cobranca, 28); // segurança contra meses curtos
      const dataStr = `${currentMonthKey}-${String(dia).padStart(2, "0")}`;

      addExpense.mutate(
        {
          banco: s.banco || "Desconhecido",
          cartao: s.cartao || "",
          valor: Number(s.valor),
          data: dataStr,
          parcela: 1,
          total_parcela: 1,
          despesa: s.nome,
          justificativa: s.justificativa,
          classificacao: s.classificacao || "Assinatura",
          fatura: faturaStr,
          fatura_original: null,
        } as any,
        {
          onSuccess: () => {
            updateSubscription.mutate({ id: s.id, last_generated_month: currentMonthKey });
          },
        },
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subs.length, userId]);

  const ativas = subs.filter((s) => !s.paused);
  const pausadas = subs.filter((s) => s.paused);
  const totalMensal = ativas.reduce((acc, s) => acc + Number(s.valor), 0);

  return (
    <div className="space-y-4">
      {/* Nota informativa */}
      <div className="bg-amber-50/60 border border-amber-200 text-amber-900 rounded-2xl px-4 py-3 text-xs font-bold leading-relaxed">
        ℹ️ Algumas faturas trazem mais de uma cobrança da mesma assinatura no mês (ex: cobrança retroativa).
        A tabela do Dashboard mostra todos os lançamentos reais; aqui você vê apenas o cadastro recorrente.
      </div>

      {/* Resumo + ações */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">
            <Repeat size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Mensal Ativo</p>
            <h3 className="text-xl font-black text-indigo-700">{formatCurrency(totalMensal)}</h3>
          </div>
        </div>
        <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700 font-black">
          <Plus size={16} className="mr-1" /> Nova Assinatura
        </Button>
      </div>

      {/* Sugestões */}
      {suggestions.length > 0 && (
        <div className="bg-purple-50/40 p-4 rounded-2xl border border-purple-100">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-purple-600" />
            <p className="text-[11px] font-black uppercase tracking-widest text-purple-700">
              Sugestões das suas despesas
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Button
                key={s.despesa}
                variant="outline"
                size="sm"
                onClick={() => importSuggestion(s)}
                className="font-bold text-xs bg-white hover:bg-purple-100 border-purple-200"
              >
                <Plus size={12} className="mr-1" />
                {s.despesa} · {formatCurrency(s.valor)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-black text-[10px] uppercase py-4">Nome</TableHead>
              <TableHead className="font-black text-[10px] uppercase text-right">Valor</TableHead>
              <TableHead className="font-black text-[10px] uppercase text-center">Dia</TableHead>
              <TableHead className="font-black text-[10px] uppercase">Cartão</TableHead>
              <TableHead className="font-black text-[10px] uppercase text-center">Status</TableHead>
              <TableHead className="font-black text-[10px] uppercase text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-slate-400 font-bold italic">
                  Nenhuma assinatura cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              [...ativas, ...pausadas].map((s) => (
                <TableRow
                  key={s.id}
                  className={cn("hover:bg-indigo-50/50 transition-colors", s.paused && "opacity-60")}
                >
                  <TableCell className="font-bold text-sm">{s.nome}</TableCell>
                  <TableCell className="text-right font-black text-indigo-600">
                    {formatCurrency(Number(s.valor))}
                  </TableCell>
                  <TableCell className="text-center text-xs font-bold text-slate-500">
                    Dia {s.dia_cobranca}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-500">
                    {[s.banco, s.cartao].filter(Boolean).join(" ••") || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.paused ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-black text-[9px]">
                        PAUSADA
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-black text-[9px]">
                        ATIVA
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8", s.paused ? "text-emerald-600" : "text-amber-600")}
                        onClick={() => togglePause.mutate({ id: s.id, paused: !s.paused })}
                        title={s.paused ? "Retomar" : "Pausar"}
                      >
                        {s.paused ? <Play size={14} /> : <Pause size={14} />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-500"
                        onClick={() => openEdit(s)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        onClick={() => setDeleting(s.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl border-none max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black text-indigo-900 uppercase">
              {editing ? "Editar Assinatura" : "Nova Assinatura"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-[10px] font-black uppercase">Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Netflix, Spotify..."
                className="bg-slate-50 border-none font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] font-black uppercase">Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
                  className="bg-slate-50 border-none font-bold"
                />
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase">Dia Cobrança</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.dia_cobranca}
                  onChange={(e) => setForm({ ...form, dia_cobranca: Number(e.target.value) })}
                  className="bg-slate-50 border-none font-bold"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] font-black uppercase">Banco</Label>
                <Input
                  value={form.banco}
                  onChange={(e) => setForm({ ...form, banco: e.target.value })}
                  className="bg-slate-50 border-none font-bold"
                />
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase">Cartão (4 últimos)</Label>
                <Input
                  value={form.cartao}
                  onChange={(e) => setForm({ ...form, cartao: e.target.value })}
                  className="bg-slate-50 border-none font-bold"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase">Justificativa</Label>
              <Input
                value={form.justificativa}
                onChange={(e) => setForm({ ...form, justificativa: e.target.value })}
                className="bg-slate-50 border-none font-bold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="w-full bg-indigo-600 font-black h-12 rounded-2xl">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent className="rounded-3xl border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black">Excluir assinatura?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">Não</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 font-black"
              onClick={() => {
                if (deleting)
                  deleteSubscription.mutate(deleting, {
                    onSuccess: () => {
                      toast.success("Removida!");
                      setDeleting(null);
                    },
                  });
              }}
            >
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
