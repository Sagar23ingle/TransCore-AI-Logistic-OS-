import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type SmartOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
};

/* ---------- Pills (2-8 options, single-line) ---------- */
export function SelectPills<T extends string>({
  value, onChange, options, ariaLabel,
}: {
  value: T | "";
  onChange: (v: T) => void;
  options: SmartOption<T>[];
  ariaLabel?: string;
}) {
  const groupId = React.useId();
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5 rounded-full bg-muted/50 p-1">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId={`pill-${groupId}`}
                className="absolute inset-0 rounded-full bg-primary shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative flex items-center gap-1">
              {active && <Check className="h-3 w-3" />}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Chips (compact, wrap freely) ---------- */
export function SelectChips<T extends string>({
  value, onChange, options, ariaLabel, allowClear = false,
}: {
  value: T | "";
  onChange: (v: T | "") => void;
  options: SmartOption<T>[];
  ariaLabel?: string;
  allowClear?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <motion.button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.15 }}
            onClick={() => onChange(allowClear && active ? "" : o.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200",
              active
                ? "border-primary bg-primary/10 text-primary shadow-sm"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            <AnimatePresence initial={false}>
              {active && (
                <motion.span
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center overflow-hidden"
                >
                  <Check className="h-3 w-3" />
                </motion.span>
              )}
            </AnimatePresence>
            {o.icon && <o.icon className="h-3.5 w-3.5" />}
            {o.label}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ---------- Cards (icon + label + description) ---------- */
export function SelectCards<T extends string>({
  value, onChange, options, ariaLabel, columns = 2,
}: {
  value: T | "";
  onChange: (v: T) => void;
  options: SmartOption<T>[];
  ariaLabel?: string;
  columns?: 2 | 3 | 4;
}) {
  const grid = { 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[columns];
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("grid gap-2", grid)}>
      {options.map((o) => {
        const active = value === o.value;
        const Icon = o.icon;
        return (
          <motion.button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
            onClick={() => onChange(o.value)}
            className={cn(
              "group relative flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition-all duration-200",
              active
                ? "border-primary bg-primary/5 shadow-[0_4px_16px_-6px_hsl(var(--primary)/0.35)]"
                : "border-border bg-card hover:border-primary/40 hover:bg-accent/30"
            )}
          >
            <AnimatePresence>
              {active && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"
                >
                  <Check className="h-3 w-3" />
                </motion.span>
              )}
            </AnimatePresence>
            {Icon && (
              <div
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg transition-colors",
                  active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground group-hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
            )}
            <div className={cn("text-sm font-semibold", active ? "text-foreground" : "text-foreground/90")}>{o.label}</div>
            {o.description && <div className="text-[11px] leading-tight text-muted-foreground">{o.description}</div>}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ---------- Searchable dropdown ---------- */
export function SearchableDropdown<T extends string>({
  value, onChange, options, placeholder = "Select...", emptyText = "No matches", ariaLabel, clearable = false,
}: {
  value: T | "";
  onChange: (v: T | "") => void;
  options: SmartOption<T>[];
  placeholder?: string;
  emptyText?: string;
  ariaLabel?: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-xl border border-border bg-background px-3 text-sm transition-colors",
            "hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
          )}
        >
          <span className={cn("truncate", current ? "text-foreground" : "text-muted-foreground")}>
            {current?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 text-muted-foreground" />
            <CommandInput placeholder="Search..." className="border-0" />
          </div>
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {clearable && (
                <CommandItem value="__clear__" onSelect={() => { onChange("" as T); setOpen(false); }}>
                  <span className="text-muted-foreground">— None —</span>
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  onSelect={() => { onChange(o.value); setOpen(false); }}
                  className="flex items-center gap-2"
                >
                  {o.icon && <o.icon className="h-4 w-4 text-muted-foreground" />}
                  <span className="flex-1">{o.label}</span>
                  {value === o.value && <Check className="h-4 w-4 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
