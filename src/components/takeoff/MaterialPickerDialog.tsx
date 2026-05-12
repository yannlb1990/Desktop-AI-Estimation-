import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Globe, MapPin, Clock, Package } from 'lucide-react';
import { useMaterialsLibrary } from '@/hooks/useMaterialsLibrary';
import { MaterialEntry } from '@/lib/materials/types';

interface MaterialPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (material: MaterialEntry) => void;
}

export function MaterialPickerDialog({ open, onOpenChange, onSelect }: MaterialPickerDialogProps) {
  const { materials } = useMaterialsLibrary();
  const [search, setSearch] = useState('');

  const filtered = materials.filter(m =>
    !search ||
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.trade.toLowerCase().includes(search.toLowerCase()) ||
    m.supplierName.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (m: MaterialEntry) => {
    onSelect(m);
    onOpenChange(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Pick from Materials Library
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search materials..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {materials.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No materials in library yet.</p>
            <p className="text-xs mt-1">Go to Materials Library to add your first entry.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            No materials match "{search}"
          </div>
        ) : (
          <ScrollArea className="h-72">
            <div className="space-y-1 pr-2">
              {filtered.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleSelect(m)}
                  className="w-full text-left p-3 rounded-md hover:bg-muted transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{m.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs h-4 px-1">{m.trade}</Badge>
                        {m.supplierName && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            {m.supplierType === 'overseas'
                              ? <Globe className="h-2.5 w-2.5 text-amber-500" />
                              : <MapPin className="h-2.5 w-2.5 text-green-500" />}
                            {m.supplierName}
                          </span>
                        )}
                        {m.leadTimeWeeks && (
                          <span className="text-xs text-amber-600 flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {m.leadTimeWeeks} wks
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-semibold text-sm">${m.unitCost.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">/{m.unit}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
