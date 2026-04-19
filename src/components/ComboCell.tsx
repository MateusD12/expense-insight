import { useState } from "react";
import { Button } from "@/components/ui/button";
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

interface ComboCellProps {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  width?: string;
}

export function ComboCell({ value, options, onChange, placeholder = "Selecionar...", width = "w-[130px]" }: ComboCellProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const exists = options.some((o) => o.toLowerCase() === search.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          className={cn("h-8 text-xs justify-between font-normal", width)}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar..."
            value={search}
            onValueChange={setSearch}
            className="h-9 text-xs"
          />
          <CommandList>
            <CommandEmpty className="p-2">
              {search ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs text-blue-600"
                  onClick={() => {
                    onChange(search);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Plus className="mr-2 h-3 w-3" /> Criar "{search}"
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Digite para criar</span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o}
                  value={o}
                  onSelect={() => {
                    onChange(o);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="text-xs"
                >
                  <Check className={cn("mr-2 h-3 w-3", value === o ? "opacity-100" : "opacity-0")} />
                  {o}
                </CommandItem>
              ))}
              {search && !exists && (
                <CommandItem
                  value={`__create_${search}`}
                  onSelect={() => {
                    onChange(search);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="text-xs text-blue-600"
                >
                  <Plus className="mr-2 h-3 w-3" /> Criar "{search}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
