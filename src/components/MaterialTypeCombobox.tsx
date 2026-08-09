import { useState, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Star } from "lucide-react";
import { AUSTRALIAN_MATERIALS } from "@/data/australianMaterials";

const CUSTOM_KEY = "local_custom_materials";

interface CustomMaterial {
  id: string;
  name: string;
  unit: string;
  avg_price: number;
  category: string;
}

interface MaterialHit {
  name: string;
  unit: string;
  avgPrice: number;
  sublabel: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (hit: { name: string; unit: string; avgPrice: number }) => void;
  placeholder?: string;
}

function loadCustomMaterials(): CustomMaterial[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
  } catch {
    return [];
  }
}

function searchBuiltin(query: string): MaterialHit[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return AUSTRALIAN_MATERIALS
    .filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.subcategory.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    )
    .slice(0, 12)
    .map(m => ({ name: m.name, unit: m.unit, avgPrice: m.avgPrice, sublabel: `${m.subcategory} · ${m.unit}` }));
}

export function MaterialTypeCombobox({ value, onChange, onSelect, placeholder }: Props) {
  // ── 500+ inline search popover (appears while typing) ────────────────────
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [builtinResults, setBuiltinResults] = useState<MaterialHit[]>([]);
  const inputTriggerRef = useRef<HTMLDivElement>(null);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    const r = searchBuiltin(v);
    setBuiltinResults(r);
    setPopoverOpen(r.length > 0);
  }, [onChange]);

  function handleBuiltinSelect(hit: MaterialHit) {
    onChange(hit.name);
    onSelect(hit);
    setPopoverOpen(false);
  }

  // ── My Materials hover popover (star icon, custom-only) ──────────────────
  const [starOpen, setStarOpen] = useState(false);
  const [customSearch, setCustomSearch] = useState("");
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const customMaterials = loadCustomMaterials();
  const filteredCustom = customSearch
    ? customMaterials.filter(m =>
        m.name.toLowerCase().includes(customSearch.toLowerCase()) ||
        (m.category || "").toLowerCase().includes(customSearch.toLowerCase())
      )
    : customMaterials;

  function handleStarEnter() {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setStarOpen(true);
  }
  function handleStarLeave() {
    hoverTimeout.current = setTimeout(() => setStarOpen(false), 200);
  }

  function handleCustomSelect(m: CustomMaterial) {
    onChange(m.name);
    onSelect({ name: m.name, unit: m.unit, avgPrice: m.avg_price });
    setStarOpen(false);
    setCustomSearch("");
  }

  return (
    <div className="flex gap-1.5 items-center">
      {/* Input + 500+ library search popover */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <div ref={inputTriggerRef} className="flex-1">
            <Input
              value={value}
              onChange={handleInput}
              onFocus={() => {
                const r = searchBuiltin(value);
                if (r.length > 0) setPopoverOpen(true);
              }}
              placeholder={placeholder ?? "Type to search or enter anything"}
              autoComplete="off"
            />
          </div>
        </PopoverTrigger>
        {builtinResults.length > 0 && (
          <PopoverContent
            className="p-0 z-[10001]"
            style={{ width: inputTriggerRef.current?.offsetWidth ?? 280 }}
            align="start"
            onOpenAutoFocus={e => e.preventDefault()}
          >
            <Command shouldFilter={false}>
              <CommandList>
                <CommandGroup heading="Material library">
                  {builtinResults.map((hit, i) => (
                    <CommandItem
                      key={i}
                      value={hit.name}
                      onSelect={() => handleBuiltinSelect(hit)}
                      className="cursor-pointer flex items-center gap-2 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-tight">{hit.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{hit.sublabel}</div>
                      </div>
                      <span className="text-xs font-mono text-primary shrink-0">
                        ${hit.avgPrice.toFixed(2)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>

      {/* Star — hover to show My Materials */}
      <div
        className="relative shrink-0"
        onMouseEnter={handleStarEnter}
        onMouseLeave={handleStarLeave}
      >
        <button
          type="button"
          className={`flex items-center justify-center w-8 h-8 rounded-md border transition-colors ${
            starOpen
              ? "border-primary/60 bg-primary/10 text-primary"
              : "border-border bg-transparent text-muted-foreground hover:text-foreground hover:border-border/80"
          }`}
          title="My saved materials"
          tabIndex={-1}
        >
          <Star className="h-3.5 w-3.5" />
        </button>

        {starOpen && (
          <div
            className="absolute right-0 top-full mt-1 z-[10001] rounded-lg border border-border bg-popover shadow-xl"
            style={{ minWidth: 280 }}
            onMouseEnter={handleStarEnter}
            onMouseLeave={handleStarLeave}
          >
            <div className="px-3 pt-3 pb-2 border-b border-border">
              <p className="text-xs font-semibold text-foreground mb-1.5">My Materials</p>
              <Input
                placeholder="Search..."
                value={customSearch}
                onChange={e => setCustomSearch(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredCustom.length > 0 ? (
                filteredCustom.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => handleCustomSelect(m)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/30 transition-colors border-b border-border/20 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.category}</div>
                    </div>
                    <span className="text-xs font-mono text-primary shrink-0">
                      {m.unit} · ${m.avg_price.toFixed(2)}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                  {customMaterials.length === 0
                    ? "No custom materials yet.\nAdd them in the Materials Library."
                    : "No matches."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
