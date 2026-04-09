import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useExpenses, type Expense } from "@/hooks/useExpenses";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Expense | null;
  onSubmit: (data: any) => void;
}

export function ExpenseForm({ open, onOpenChange, initialData, onSubmit }: ExpenseFormProps) {
  const { data: allExpenses = [] } = useExpenses();

  // Estados do formulário
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

  // Atualiza quando abre para edição
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
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

  // Função para pegar valores únicos das despesas existentes
  const getUniqueValues = (key: keyof Expense) => {
    return Array.from(new Set(allExpenses.map((e) => e[key]).filter(Boolean))).sort() as string[];
  };

  // Lógica para detectar se é uma despesa recorrente/parcelada
  const handleDespesaSelect = (nome: string) => {
    const despesaExistente = allExpenses.find((e) => e.despesa === nome);
    if (despesaExistente) {
      const proximaParcela =
        despesaExistente.parcela < despesaExistente.total_parcela ? despesaExistente.parcela + 1 : 1;

      setFormData((prev) => ({
        ...prev,
        despesa: nome,
        valor: despesaExistente.valor,
        classificacao: despesaExistente.classificacao,
        banco: despesaExistente.banco,
        cartao: despesaExistente.cartao,
        justificativa: despesaExistente.justificativa,
        total_parcela: despesaExistente.total_parcela,
        parcela: proximaParcela,
      }));
    } else {
      setFormData((prev) => ({ ...prev, despesa: nome }));
    }
  };

  // Componente interno para Select com Busca e "Novo"
  const ComboboxField = ({ label, value, options, onChange, placeholder }: any) => {
    const [openCombo, setOpenCombo] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    return (
      <div className="space-y-2 flex flex-col">
        <Label>{label}</Label>
        <Popover open={openCombo} onOpenChange={setOpenCombo}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="justify-between font-normal">
              {value || `Selecionar ${label}...`}
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
                      <Check className={cn("mr-2 h-4 w-4", value === option ? "opacity-100" : "opacity-0")} />
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Gasto" : "Novo Gasto"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Nome da Despesa com Sugestão */}
          <ComboboxField
            label="Despesa"
            value={formData.despesa}
            options={getUniqueValues("despesa")}
            onChange={handleDespesaSelect}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input
                type="number"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
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
              label="Cartão"
              value={formData.cartao}
              options={getUniqueValues("cartao")}
              onChange={(v: string) => setFormData({ ...formData, cartao: v })}
            />
          </div>

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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Parcela Atual</Label>
              <Input
                type="number"
                value={formData.parcela}
                onChange={(e) => setFormData({ ...formData, parcela: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Total de Parcelas</Label>
              <Input
                type="number"
                value={formData.total_parcela}
                onChange={(e) => setFormData({ ...formData, total_parcela: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onSubmit(formData);
              onOpenChange(false);
            }}
          >
            Salvar Gasto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
