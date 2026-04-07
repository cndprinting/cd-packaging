"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Plus, ChevronDown, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComboboxOption {
  id: string;
  label: string;
  subtitle?: string;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string, label: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  allowCreate?: boolean;
  onCreateNew?: (name: string) => void;
  className?: string;
  duplicateCheck?: (name: string) => ComboboxOption | null;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Search...",
  allowCreate = false,
  onCreateNew,
  className,
  duplicateCheck,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showDuplicateWarning, setShowDuplicateWarning] = useState<ComboboxOption | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Display value: find the label for the current value
  const displayLabel = useMemo(() => {
    if (!value) return "";
    const opt = options.find((o) => o.id === value || o.label === value);
    return opt?.label || value;
  }, [value, options]);

  // Filter options based on query
  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.subtitle?.toLowerCase().includes(q)
    );
  }, [options, query]);

  // Exact match check for "create new"
  const exactMatch = useMemo(
    () => options.some((o) => o.label.toLowerCase() === query.toLowerCase()),
    [options, query]
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setShowDuplicateWarning(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (opt: ComboboxOption) => {
    onChange(opt.id, opt.label);
    setOpen(false);
    setQuery("");
    setShowDuplicateWarning(null);
  };

  const handleCreateNew = () => {
    if (!query.trim()) return;
    // Check for duplicates
    if (duplicateCheck) {
      const dup = duplicateCheck(query.trim());
      if (dup) {
        setShowDuplicateWarning(dup);
        return;
      }
    }
    if (onCreateNew) onCreateNew(query.trim());
    onChange("", query.trim());
    setOpen(false);
    setQuery("");
  };

  const handleOverrideDuplicate = () => {
    if (onCreateNew && query.trim()) onCreateNew(query.trim());
    onChange("", query.trim());
    setOpen(false);
    setQuery("");
    setShowDuplicateWarning(null);
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors hover:border-gray-400",
          open && "border-brand-500 ring-2 ring-brand-200",
          !displayLabel && "text-gray-400"
        )}
      >
        <span className="truncate">{displayLabel || placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="relative p-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDuplicateWarning(null);
              }}
              placeholder={placeholder}
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
              autoFocus
            />
          </div>

          <div className="max-h-48 overflow-y-auto px-1 pb-1">
            {filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors hover:bg-gray-50",
                  (opt.id === value || opt.label === value) && "bg-brand-50 text-brand-700"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{opt.label}</p>
                  {opt.subtitle && <p className="text-xs text-gray-400 truncate">{opt.subtitle}</p>}
                </div>
                {(opt.id === value || opt.label === value) && (
                  <Check className="h-4 w-4 text-brand-600 shrink-0" />
                )}
              </button>
            ))}

            {filtered.length === 0 && !allowCreate && (
              <p className="px-3 py-4 text-sm text-gray-400 text-center">No results found</p>
            )}

            {allowCreate && query.trim() && !exactMatch && (
              <>
                {showDuplicateWarning ? (
                  <div className="mx-2 mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-amber-800">Possible duplicate found:</p>
                        <p className="text-xs text-amber-700 mt-1">&ldquo;{showDuplicateWarning.label}&rdquo;{showDuplicateWarning.subtitle ? ` (${showDuplicateWarning.subtitle})` : ""}</p>
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => handleSelect(showDuplicateWarning!)}
                            className="text-xs font-medium text-brand-700 hover:underline"
                          >
                            Use existing
                          </button>
                          <button
                            type="button"
                            onClick={handleOverrideDuplicate}
                            className="text-xs font-medium text-amber-700 hover:underline"
                          >
                            Create anyway
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-700 hover:bg-brand-50 transition-colors border-t border-gray-100 mt-1"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create &ldquo;{query.trim()}&rdquo;</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
