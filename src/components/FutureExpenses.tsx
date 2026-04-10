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
import { addMonths, format } from "date-fns";

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Expense | null;
  onSubmit: (data: any) => void;
}

export function ExpenseForm({ open, onOpenChange, initialData, onSubmit }: ExpenseFormProps) {
  const { data: allExpenses = [], bulkAddExpenses, addExpense, updateExpense } = useExpenses();
  const [inputMensal, setInputMensal] = useState("");
  const [inputTotal, setInputTotal] = useState("");

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
    } else {
      setFormData({
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
      setInputMensal("");
      setInputTotal("");
    }
  }, [initialData, open]);

  const handleSave = () => {
    const totalParcelas = Number(formData.total_parcela) || 1;
    const baseFatura = formData.fatura; // Ex: "2026-05"

    if (initialData) {
      onSubmit({ ...formData, valor: Number(formData.valor) });
    } else if (totalParcelas > 1 && baseFatura) {
      const installments = [];
      const [year, month] = baseFatura.split("-").map(Number);
      const purchaseDate = new Date(formData.data + "T12:00:00");

      for (let i = 0; i < totalParcelas; i++) {
        // Incrementa tanto a fatura quanto a data real da despesa
        const currentFatura = format(new Date(year, month - 1 + i, 1), "yyyy-MM-dd");
        const currentData = format(addMonths(purchaseDate, i), "yyyy-MM-dd");

        installments.push({
          ...formData,
          valor: Number(formData.valor),
          parcela: i + 1,
          total_parcela: totalParcelas,
          data: currentData,
          fatura: currentFatura,
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
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder={`Buscar ${label}...`} onValueChange={setSearchValue} />
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
                    <Plus className="mr-2 h-4 w-4" /> Adicionar "{searchValue}"
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
      <DialogContent className="sm:max-w-[600px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-black uppercase">{initialData ? "Editar" : "Novo"} Gasto</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase">Parcela/Total</Label>
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
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFormData({ ...formData, total_parcela: val });
                    setInputTotal((parseFloat(inputMensal) * val).toFixed(2));
                  }}
                  className="bg-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-blue-600">Valor Mensal</Label>
              <Input
                type="number"
                step="0.01"
                value={inputMensal}
                onChange={(e) => {
                  setInputMensal(e.target.value);
                  const num = parseFloat(e.target.value) || 0;
                  setFormData({ ...formData, valor: num });
                  setInputTotal((num * (formData.total_parcela || 1)).toFixed(2));
                }}
                className="border-blue-200 font-bold text-blue-600"
              />
            </div>
          </div>
          <ComboboxField
            label="Descrição"
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
                onChange={(e) => setFormData({ ...formData, fatura: e.target.value })}
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
          <Button onClick={handleSave} className="bg-blue-600 font-bold w-full">
            Salvar Gasto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
