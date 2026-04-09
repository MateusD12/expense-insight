import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useExpenses, type Expense } from "@/hooks/useExpenses";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Expense | null;
  onSubmit: (data: any) => void;
}

export function ExpenseForm({ open, onOpenChange, initialData, onSubmit }: ExpenseFormProps) {
  const { data: allExpenses = [] } = useExpenses();

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
    fatura: new Date().toISOString().slice(0, 7),
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        parcela: initialData.parcela || 1,
        total_parcela: initialData.total_parcela || 1,
      });
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
        fatura: new Date().toISOString().slice(0, 7),
      });
    }
  }, [initialData, open]);

  const getUniqueValues = (key: keyof Expense) => {
    return Array.from(new Set(allExpenses.map((e) => e[key]).filter(Boolean))).sort() as string[];
  };

  const handleDespesaSelect = (nome: string) => {
    const despesaExistente = allExpenses.find((e) => e.despesa === nome);
    if (despesaExistente) {
      const pAtual = despesaExistente.parcela || 1;
      const pTotal = despesaExistente.total_parcela || 1;
      const proximaParcela = pAtual < pTotal ? pAtual + 1 : 1;

      setFormData((prev) => ({
        ...prev,
        despesa: nome,
        valor: despesaExistente.valor,
        classificacao: despesaExistente.classificacao,
        banco: despesaExistente.banco,
        cartao: despesaExistente.cartao,
        justificativa: despesaExistente.justificativa,
        total_parcela: pTotal,
        parcela: proximaParcela,
      }));
    } else {
      setFormData((prev) => ({ ...prev, despesa: nome }));
    }
  };

  const ComboboxField = ({ label, value, options, onChange }: any) => {
    const [openCombo, setOpenCombo] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    return (
      <div className="space-y-2 flex flex-col">
        <Label className="text-xs font-bold text-slate-500 uppercase">{label}</Label>
        <Popover open={openCombo} onOpenChange={setOpenCombo}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="justify-between font-normal bg-slate-50 border-slate-200"
            >
              {value || `Selecionar...`}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                  {options.map((option: string) => (
                    <CommandItem
                      key={option}
                      onSelect={() => {
                        onChange(option);
                        setOpenCombo(false);
                      }}
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4", value === option ? "opacity-100 text-blue-600" : "opacity-0")}
                      />
                      {option}
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
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto rounded-2xl border-none shadow-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-slate-800 tracking-tight">
            {initialData ? "EDITAR GASTO" : "NOVO GASTO"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* Calculadora de Valores (Destaque) */}
          <div className="col-span-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
            <div className="flex items-center gap-2 mb-2 text-blue-800 font-bold text-sm">
              <Calculator size={16} /> Valores e Parcelas
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-500 uppercase">Parcela Atual</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.parcela}
                  onChange={(e) => setFormData({ ...formData, parcela: Math.max(1, Number(e.target.value)) })}
                  className="bg-white border-slate-200 font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-500 uppercase">Total de Parcelas</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.total_parcela}
                  onChange={(e) => setFormData({ ...formData, total_parcela: Math.max(1, Number(e.target.value)) })}
                  className="bg-white border-slate-200 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-blue-100">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-blue-600 uppercase">Valor Mensal (Parcela)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                  <Input
                    type="number"
                    value={formData.valor || ""}
                    onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })}
                    className="pl-9 font-black text-blue-600 text-lg border-blue-300 focus-visible:ring-blue-500 bg-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-600 uppercase">Valor Total da Compra</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                  <Input
                    type="number"
                    value={(formData.valor || 0) * (formData.total_parcela || 1) || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, valor: Number(e.target.value) / (formData.total_parcela || 1) })
                    }
                    className="pl-9 font-black text-slate-700 text-lg bg-white border-slate-200"
                  />
                </div>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 font-medium italic text-center">
              Dica: Digite o Valor Total e o sistema divide pela parcela automaticamente.
            </p>
          </div>

          <ComboboxField
            label="Despesa / Estabelecimento"
            value={formData.despesa}
            options={getUniqueValues("despesa")}
            onChange={handleDespesaSelect}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">Data da Compra</Label>
              <Input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                className="bg-slate-50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">Mês da Fatura</Label>
              <Input
                type="month"
                value={formData.fatura || ""}
                onChange={(e) => setFormData({ ...formData, fatura: e.target.value })}
                className="bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ComboboxField
              label="Banco"
              value={formData.banco}
              options={getUniqueValues("banco")}
              onChange={(v: string) => setFormData({ ...formData, banco: v })}
            />
            <ComboboxField
              label="Cartão (Final)"
              value={formData.cartao}
              options={getUniqueValues("cartao")}
              onChange={(v: string) => setFormData({ ...formData, cartao: v })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ComboboxField
              label="Categoria"
              value={formData.classificacao}
              options={getUniqueValues("classificacao")}
              onChange={(v: string) => setFormData({ ...formData, classificacao: v })}
            />
            <ComboboxField
              label="Justificativa"
              value={formData.justificativa}
              options={getUniqueValues("justificativa")}
              onChange={(v: string) => setFormData({ ...formData, justificativa: v })}
            />
          </div>
        </div>

        <DialogFooter className="pt-4 border-t mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="font-bold">
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onSubmit(formData);
              onOpenChange(false);
            }}
            className="bg-blue-600 font-bold px-8"
          >
            Salvar Gasto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
