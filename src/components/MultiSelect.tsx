import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  /** Максимальное количество выбранных элементов (например, 1 для одиночного выбора) */
  maxSelected?: number;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Выберите...",
  searchPlaceholder = "Поиск...",
  emptyMessage = "Ничего не найдено",
  className,
  maxSelected,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }

    // Одиночный выбор через MultiSelect (нужно для полей, где API не принимает multiselect)
    if (maxSelected === 1) {
      onChange([value]);
      setOpen(false);
      return;
    }

    if (typeof maxSelected === "number" && selected.length >= maxSelected) {
      return;
    }

    onChange([...selected, value]);
  };

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((item) => item !== value));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const selectedLabels = selected
    .map((value) => options.find((opt) => opt.value === value)?.label)
    .filter(Boolean);

  // Общий триггер-кнопка
  const triggerButton = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn(
        "w-full justify-between min-h-[2.5rem] h-auto bg-card hover:bg-card/80",
        className
      )}
      onClick={() => isMobile && setOpen(true)}
    >
      <div className="flex flex-wrap gap-1 flex-1">
        {selected.length === 0 ? (
          <span className="text-muted-foreground font-normal">{placeholder}</span>
        ) : (
          selectedLabels.map((label, index) => (
            <Badge
              key={selected[index]}
              variant="secondary"
              className="mr-1 mb-1 bg-accent text-accent-foreground"
            >
              {label}
              <button
                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-w-[28px] min-h-[28px] p-1 inline-flex items-center justify-center"
                onMouseDown={(e) => handleRemove(selected[index], e)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleRemove(selected[index], e as unknown as React.MouseEvent);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Badge>
          ))
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {selected.length > 1 && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 transition-colors"
            onMouseDown={handleClearAll}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleClearAll(e as unknown as React.MouseEvent);
            }}
          >
            Очистить
          </button>
        )}
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </div>
    </Button>
  );

  // Общий контент для выбора (Command)
  const commandContent = (
    <Command>
      <CommandInput placeholder={searchPlaceholder} />
      <CommandList className={isMobile ? "max-h-[50vh]" : ""}>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandGroup>
          {options.map((option) => (
            <CommandItem
              key={option.value}
              value={option.label}
              onSelect={() => handleSelect(option.value)}
              className={cn(
                "cursor-pointer",
                isMobile && "py-3 text-base" // Увеличенные тач-зоны на мобильном
              )}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  selected.includes(option.value) ? "opacity-100" : "opacity-0"
                )}
              />
              {option.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  // Мобильный: Sheet снизу
  if (isMobile) {
    return (
      <div>
        {triggerButton}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="h-[70vh] flex flex-col p-0 rounded-t-2xl">
            <SheetHeader className="px-4 pt-4 pb-2">
              <SheetTitle className="text-base">{placeholder}</SheetTitle>
            </SheetHeader>

            {/* Выбранные элементы внутри Sheet */}
            {selected.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {selectedLabels.map((label, index) => (
                  <Badge
                    key={selected[index]}
                    variant="secondary"
                    className="bg-accent text-accent-foreground text-sm py-1 px-2.5"
                  >
                    {label}
                    <button
                      className="ml-1.5 rounded-full min-w-[28px] min-h-[28px] p-1 inline-flex items-center justify-center hover:bg-muted/50"
                      onClick={() => onChange(selected.filter((item) => item !== selected[index]))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </Badge>
                ))}
                {selected.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
                    onClick={() => onChange([])}
                  >
                    Очистить всё
                  </button>
                )}
              </div>
            )}

            <div className="flex-1 overflow-hidden border-t border-border">
              {commandContent}
            </div>

            <div className="p-4 border-t border-border">
              <Button
                className="w-full"
                size="lg"
                onClick={() => setOpen(false)}
              >
                Готово {selected.length > 0 && `(${selected.length})`}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Десктоп: Popover как было
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerButton}
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[300px] p-0 bg-card border-border z-50">
        {commandContent}
      </PopoverContent>
    </Popover>
  );
}
