import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComboSelectProps {
  label?: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export function ComboSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Selecionar...",
  className,
}: ComboSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const exists = options.some((o) => o.toLowerCase() === search.toLowerCase());

  function select(v: string) {
    onChange(v);
    setOpen(false);
    setSearch("");
  }

  return (
    <div className={cn("space-y-2 flex flex-col w-full", className)}>
      {label && (
        <Label className="text-[10px] font-black text-slate-500 uppercase">{label}</Label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between bg-slate-50 border-slate-200 font-normal"
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Buscar ou criar novo..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty className="p-2">
                {search.trim() ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-blue-600"
                    onClick={() => select(search.trim())}
                  >
                    <Plus className="mr-2 h-3 w-3" /> Criar "{search.trim()}"
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground px-2">
                    Nenhuma opção. Digite para criar.
                  </span>
                )}
              </CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o} value={o} onSelect={() => select(o)}>
                    <Check
                      className={cn("mr-2 h-4 w-4", value === o ? "opacity-100" : "opacity-0")}
                    />
                    {o}
                  </CommandItem>
                ))}
                {search.trim() && !exists && (
                  <CommandItem
                    value={`__create__${search}`}
                    onSelect={() => select(search.trim())}
                    className="text-blue-600"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Criar "{search.trim()}"
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
