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

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Expense | null;
  onSubmit: (data: any) => void;
}

export function ExpenseForm({ open, onOpenChange, initialData, onSubmit }: ExpenseFormProps) {
  const { data: allExpenses = [] } = useExpenses();

  // Estados para controlar a digitação de forma livre sem o React "sobrescrever" os números
  const [inputMensal, setInputMensal] = useState<string>("");
  const [inputTotal, setInputTotal] = useState<string>("");

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
      const faturaSegura = initialData.fatura
        ? initialData.fatura.substring(0, 7)
        : initialData.data
          ? initialData.data.substring(0, 7)
          : new Date().toISOString().slice(0, 7);

      const vlr = initialData.valor || 0;
      const totParc = initialData.total_parcela || 1;

      setFormData({
        ...initialData,
        data: initialData.data ? initialData.data.substring(0, 10) : new Date().toISOString().split("T")[0],
        parcela: initialData.parcela || 1,
        total_parcela: totParc,
        fatura: faturaSegura,
      });

      setInputMensal(vlr.toString());
      setInputTotal((vlr * totParc).toFixed(2));
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
      setInputMensal("");
      setInputTotal("");
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
      const vlr = despesaExistente.valor || 0;

      setFormData((prev) => ({
        ...prev,
        despesa: nome,
        valor: vlr,
        classificacao: despesaExistente.classificacao,
        banco: despesaExistente.banco,
        cartao: despesaExistente.cartao,
        justificativa: despesaExistente.justificativa,
        total_parcela: pTotal,
        parcela: proximaParcela,
      }));

      setInputMensal(vlr.toString());
      setInputTotal((vlr * pTotal).toFixed(2));
    } else {
      setFormData((prev) => ({ ...prev, despesa: nome }));
    }
  };

  const handleTotalParcelasChange = (val: number) => {
    setFormData({ ...formData, total_parcela: val });
    const mensalNum = parseFloat(inputMensal) || 0;
    setInputTotal((mensalNum * val).toFixed(2));
  };

  const handleInputMensalChange = (val: string) => {
    setInputMensal(val);
    const num = parseFloat(val) || 0;
    setInputTotal((num * (formData.total_parcela || 1)).toFixed(2));
    setFormData({ ...formData, valor: num });
  };

  const handleInputTotalChange = (val: string) => {
    setInputTotal(val);
    const num = parseFloat(val) || 0;
    const mensal = num / (formData.total_parcela || 1);
    const roundedMensal = Number(mensal.toFixed(2));
    setInputMensal(roundedMensal.toString());
    setFormData({ ...formData, valor: roundedMensal });
  };

  const ComboboxField = ({ label, value, options, onChange }: any) => {
    const [openCombo, setOpenCombo] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    return (
      <div className="space-y-2 flex flex-col w-full overflow-hidden">
        <Label className="text-[10px] font-bold text-slate-500 uppercase truncate">{label}</Label>
        <Popover open={openCombo} onOpenChange={setOpenCombo}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between font-normal bg-slate-50 border-slate-200 overflow-hidden"
            >
              <span className="truncate pr-2">{value || `Selecionar...`}</span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder={`Buscar ${label}...`} onValueChange={setSearchValue} />
              <CommandList>
                <CommandEmpty className="p-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-blue-600 truncate"
                    onClick={() => {
                      onChange(searchValue);
                      setOpenCombo(false);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4 shrink-0" /> Adicionar "{searchValue}"
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
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          value === option ? "opacity-100 text-blue-600" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{option}</span>
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-2xl border-none shadow-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-slate-800 tracking-tight uppercase">
            {initialData ? "Editar Gasto" : "Novo Gasto"}
          </DialogTitle>
          <DialogDescription className="sr-only">Preencha os dados do seu gasto.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* Calculadora de Valores */}
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4 w-full">
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
                  className="bg-white border-slate-200 font-bold w-full"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-500 uppercase">Total de Parcelas</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.total_parcela}
                  onChange={(e) => handleTotalParcelasChange(Math.max(1, Number(e.target.value)))}
                  className="bg-white border-slate-200 font-bold w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-blue-100">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-blue-600 uppercase truncate">
                  Valor Mensal (Parcela)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={inputMensal}
                    onChange={(e) => handleInputMensalChange(e.target.value)}
                    className="pl-9 font-black text-blue-600 text-lg border-blue-300 focus-visible:ring-blue-500 bg-white w-full"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-600 uppercase truncate">
                  Valor Total da Compra
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={inputTotal}
                    onChange={(e) => handleInputTotalChange(e.target.value)}
                    className="pl-9 font-black text-slate-700 text-lg bg-white border-slate-200 w-full"
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
            <div className="space-y-2 overflow-hidden">
              <Label className="text-[10px] font-bold text-slate-500 uppercase truncate">Data da Compra</Label>
              <Input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                className="bg-slate-50 w-full"
              />
            </div>
            <div className="space-y-2 overflow-hidden">
              <Label className="text-[10px] font-bold text-slate-500 uppercase truncate">Mês da Fatura</Label>
              <Input
                type="month"
                value={formData.fatura || ""}
                onChange={(e) => setFormData({ ...formData, fatura: e.target.value })}
                className="bg-slate-50 w-full"
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
          <Button variant="outline" onClick={() => onOpenChange(false)} className="font-bold w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onSubmit(formData);
              onOpenChange(false);
            }}
            className="bg-blue-600 font-bold px-8 w-full sm:w-auto"
          >
            Salvar Gasto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
