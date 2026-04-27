import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useExpenses, type Expense } from "@/hooks/useExpenses";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { addMonths, format, parseISO } from "date-fns";
import { useInvoiceCutoffs } from "@/hooks/useInvoiceCutoffs";
import { resolveFatura } from "@/lib/faturaResolver";

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Expense | null;
  onSubmit: (data: any) => void;
}

export function ExpenseForm({ open, onOpenChange, initialData, onSubmit }: ExpenseFormProps) {
  const { data: allExpenses = [], bulkAddExpenses } = useExpenses();
  const { data: cutoffs = [] } = useInvoiceCutoffs();
  const [inputMensal, setInputMensal] = useState("");
  const [inputTotal, setInputTotal] = useState("");
  const [faturaTouched, setFaturaTouched] = useState(false);

  const [formData, setFormData] = useState<Partial<Expense>>({
    banco: "",
    cartao: "",
    valor: 0,
    data: new Date().toISOString().split("T")[0],
    despesa: "",
    justificativa: "",
    classificacao: "",
    parcela: 1,
    total_parcela: 1,
    fatura: format(addMonths(new Date(), 1), "yyyy-MM"),
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        data: initialData.data.substring(0, 10),
        fatura: initialData.fatura?.substring(0, 7),
      });
      setInputMensal(initialData.valor.toString());
      setInputTotal((initialData.valor * (initialData.total_parcela || 1)).toFixed(2));
      setFaturaTouched(true); // editing: keep stored fatura, don't auto-overwrite
    } else {
      const hoje = new Date();
      setFormData({
        banco: "",
        cartao: "",
        valor: 0,
        data: hoje.toISOString().split("T")[0],
        despesa: "",
        justificativa: "",
        classificacao: "",
        parcela: 1,
        total_parcela: 1,
        fatura: format(addMonths(hoje, 1), "yyyy-MM"),
      });
      setInputMensal("");
      setInputTotal("");
      setFaturaTouched(false);
    }
  }, [initialData, open]);

  // Auto-suggest fatura from cutoffs when banco/cartao/data change (only if user hasn't manually picked).
  useEffect(() => {
    if (faturaTouched) return;
    if (!formData.banco || !formData.cartao || !formData.data) return;
    const resolved = resolveFatura(formData.banco, formData.cartao, formData.data, cutoffs);
    if (resolved) {
      setFormData((f) => ({ ...f, fatura: resolved.substring(0, 7) }));
    }
  }, [formData.banco, formData.cartao, formData.data, cutoffs, faturaTouched]);

  const handleSave = () => {
    const totalParcelas = Number(formData.total_parcela) || 1;
    if (initialData) {
      onSubmit({ ...formData, valor: Number(formData.valor) });
    } else if (totalParcelas > 1) {
      const installments = [];
      const [year, month] = (formData.fatura || "").split("-").map(Number);
      const purchaseDate = parseISO(formData.data!);

      for (let i = 0; i < totalParcelas; i++) {
        // Incrementa o DIA real da despesa para cada parcela
        const dataOriginal = parseISO(formData.data!);
        const dataDaParcela = format(addMonths(dataOriginal, i), "yyyy-MM-dd");

        // Incrementa o MÊS da fatura
        const [ano, mes] = (formData.fatura || "").split("-").map(Number);
        const dataFatura = format(new Date(ano, mes - 1 + i, 1), "yyyy-MM-dd");

        installments.push({
          ...formData,
          valor: Number(formData.valor),
          parcela: i + 1,
          total_parcela: totalParcelas,
          data: dataDaParcela, // Agora Parcela 1 é Abril, Parcela 2 é Maio...
          fatura: dataFatura,
        });
      }
      bulkAddExpenses.mutate(installments, { onSuccess: () => onOpenChange(false) });
    } else {
      onSubmit({ ...formData, valor: Number(formData.valor) });
    }
  };

  const getUnique = (key: keyof Expense) =>
    Array.from(new Set(allExpenses.map((e) => e[key]).filter(Boolean))).sort() as string[];

  const ComboboxField = ({ label, value, options, onChange }: any) => {
    const [openCombo, setOpenCombo] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    return (
      <div className="space-y-2 flex flex-col w-full">
        <Label className="text-[10px] font-black text-slate-500 uppercase">{label}</Label>
        <Popover open={openCombo} onOpenChange={setOpenCombo}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between bg-slate-50 border-slate-200">
              <span className="truncate">{value || "Selecionar..."}</span>
              <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder={`Buscar...`} onValueChange={setSearchValue} />
              <CommandList>
                <CommandEmpty className="p-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-blue-600"
                    onClick={() => {
                      onChange(searchValue);
                      setOpenCombo(false);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add "{searchValue}"
                  </Button>
                </CommandEmpty>
                <CommandGroup>
                  {options.map((o: string) => (
                    <CommandItem
                      key={o}
                      onSelect={() => {
                        onChange(o);
                        setOpenCombo(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === o ? "opacity-100" : "opacity-0")} /> {o}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight">
            {initialData ? "Editar" : "Novo"} Gasto
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase">Parcelas</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={formData.parcela}
                  onChange={(e) => setFormData({ ...formData, parcela: Number(e.target.value) })}
                  className="bg-white"
                />
                <span className="font-bold text-slate-400">/</span>
                <Input
                  type="number"
                  value={formData.total_parcela}
                  onChange={(e) => setFormData({ ...formData, total_parcela: Number(e.target.value) })}
                  className="bg-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-blue-600">Valor Parcela</Label>
              <Input
                type="number"
                step="0.01"
                value={inputMensal}
                onChange={(e) => {
                  setInputMensal(e.target.value);
                  const num = parseFloat(e.target.value) || 0;
                  setFormData({ ...formData, valor: num });
                }}
                className="border-blue-200 font-bold text-blue-600 text-lg"
              />
            </div>
          </div>
          <ComboboxField
            label="Despesa / Estabelecimento"
            value={formData.despesa}
            options={getUnique("despesa")}
            onChange={(v: any) => setFormData({ ...formData, despesa: v })}
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase">Data Compra</Label>
              <Input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase">Mês Fatura</Label>
              <Input
                type="month"
                value={formData.fatura}
                onChange={(e) => {
                  setFaturaTouched(true);
                  setFormData({ ...formData, fatura: e.target.value });
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ComboboxField
              label="Banco"
              value={formData.banco}
              options={getUnique("banco")}
              onChange={(v: any) => setFormData({ ...formData, banco: v })}
            />
            <ComboboxField
              label="Cartão"
              value={formData.cartao}
              options={getUnique("cartao")}
              onChange={(v: any) => setFormData({ ...formData, cartao: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ComboboxField
              label="Categoria"
              value={formData.classificacao}
              options={getUnique("classificacao")}
              onChange={(v: any) => setFormData({ ...formData, classificacao: v })}
            />
            <ComboboxField
              label="Justificativa"
              value={formData.justificativa}
              options={getUnique("justificativa")}
              onChange={(v: any) => setFormData({ ...formData, justificativa: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSave}
            className="bg-blue-600 font-black h-12 w-full text-white uppercase tracking-widest"
          >
            Salvar Gasto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
