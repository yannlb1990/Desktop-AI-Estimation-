import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, RotateCcw, Save, AlertTriangle } from "lucide-react";
import { getLocalUser } from "@/lib/localAuth";
import { SCOPE_OF_WORK_RATES, SOW_METADATA, type AustralianState } from "@/data/scopeOfWorkRates";
import { fetchRateOverrides, saveRateOverride, deleteRateOverride } from "@/lib/rateOverrides";

const STATES: AustralianState[] = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
const ADMIN_EMAIL = (import.meta.env.VITE_OWNER_EMAIL as string | undefined) ?? 'admin@metricore.com.au';

const AdminRates = () => {
  const navigate = useNavigate();
  const user = getLocalUser();

  const [selectedState, setSelectedState] = useState<AustralianState>('NSW');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Access control — must be admin email
  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center max-w-sm">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h2 className="font-semibold text-lg mb-2">Access Restricted</h2>
          <p className="text-muted-foreground text-sm mb-4">This page is only accessible to Metricore admins.</p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  // Load overrides on mount
  useEffect(() => {
    fetchRateOverrides().then(map => {
      setOverrides(map);
      setLoading(false);
    });
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(SCOPE_OF_WORK_RATES.map(r => r.category));
    return ['all', ...Array.from(cats).sort()];
  }, []);

  const filteredRates = useMemo(() =>
    SCOPE_OF_WORK_RATES.filter(r =>
      selectedCategory === 'all' || r.category === selectedCategory
    ),
    [selectedCategory]
  );

  const overrideCount = useMemo(() =>
    SCOPE_OF_WORK_RATES.filter(r => overrides.has(`${r.id}:${selectedState}`)).length,
    [overrides, selectedState]
  );

  const getBaseValue = (rateId: string, state: AustralianState) => {
    const rate = SCOPE_OF_WORK_RATES.find(r => r.id === rateId);
    return rate ? rate[state] : 0;
  };

  const getDisplayValue = (rateId: string, state: AustralianState): number => {
    const key = `${rateId}:${state}`;
    return overrides.get(key) ?? getBaseValue(rateId, state);
  };

  const isOverridden = (rateId: string) => overrides.has(`${rateId}:${selectedState}`);

  const getEditKey = (rateId: string) => `${rateId}:${selectedState}`;

  const handleInputChange = (rateId: string, value: string) => {
    setEditValues(prev => ({ ...prev, [getEditKey(rateId)]: value }));
  };

  const handleSave = async (rateId: string) => {
    const key = getEditKey(rateId);
    const raw = editValues[key];
    if (raw === undefined || raw === '') return;

    const value = parseFloat(raw);
    if (isNaN(value) || value < 0) {
      toast.error('Enter a valid positive number');
      return;
    }

    setSavingKey(key);
    try {
      await saveRateOverride(rateId, selectedState, value);
      setOverrides(prev => new Map(prev).set(key, value));
      setEditValues(prev => { const n = { ...prev }; delete n[key]; return n; });
      toast.success('Rate saved');
    } catch {
      toast.error('Failed to save rate');
    } finally {
      setSavingKey(null);
    }
  };

  const handleReset = async (rateId: string) => {
    const key = getEditKey(rateId);
    try {
      await deleteRateOverride(rateId, selectedState);
      setOverrides(prev => { const n = new Map(prev); n.delete(key); return n; });
      setEditValues(prev => { const n = { ...prev }; delete n[key]; return n; });
      toast.success('Reset to default');
    } catch {
      toast.error('Failed to reset');
    }
  };

  const isRateStale = new Date() > new Date(SOW_METADATA.nextUpdate);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <h1 className="font-semibold">Rate Management</h1>
          <Badge variant="secondary">Admin</Badge>
        </div>
      </div>

      {/* Metadata */}
      <div className="border-b bg-muted/30 px-4 py-3">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <span>Version: <strong>{SOW_METADATA.version}</strong></span>
          <span>Last updated: <strong>{SOW_METADATA.lastUpdated}</strong></span>
          <span className={isRateStale ? 'text-amber-600 font-medium' : ''}>
            Next update: <strong>{SOW_METADATA.nextUpdate}</strong>
            {isRateStale && ' ⚠ Overdue'}
          </span>
          <span className="text-muted-foreground text-xs">{SOW_METADATA.dataSource}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="border-b px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">State:</span>
          <Select value={selectedState} onValueChange={(v) => setSelectedState(v as AustralianState)}>
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Category:</span>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c === 'all' ? 'All categories' : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {overrideCount > 0 && (
          <Badge variant="outline" className="ml-auto">
            {overrideCount} override{overrideCount !== 1 ? 's' : ''} active for {selectedState}
          </Badge>
        )}
      </div>

      {/* Table */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading rates…</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium w-28">Trade</th>
                  <th className="text-left px-3 py-2 font-medium">Scope of Work</th>
                  <th className="text-left px-3 py-2 font-medium w-16">Unit</th>
                  <th className="text-left px-3 py-2 font-medium w-24">Base ({selectedState})</th>
                  <th className="text-left px-3 py-2 font-medium w-36">Override Value</th>
                  <th className="px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody>
                {filteredRates.map(rate => {
                  const key = getEditKey(rate.id);
                  const overridden = isOverridden(rate.id);
                  const currentValue = getDisplayValue(rate.id, selectedState);
                  const baseValue = getBaseValue(rate.id, selectedState);
                  const isSaving = savingKey === key;
                  const editVal = editValues[key];
                  const hasEdit = editVal !== undefined && editVal !== '';

                  return (
                    <tr
                      key={rate.id}
                      className={`border-b hover:bg-muted/30 transition-colors ${overridden ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                    >
                      <td className="px-3 py-2 text-muted-foreground">{rate.trade}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{rate.sow}</div>
                        <div className="text-xs text-muted-foreground">{rate.description}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{rate.unit}</td>
                      <td className="px-3 py-2 font-mono">
                        ${baseValue.toFixed(2)}
                        {overridden && (
                          <div className="text-xs text-blue-600 dark:text-blue-400">
                            → ${currentValue.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editVal ?? (overridden ? currentValue.toString() : '')}
                          onChange={e => handleInputChange(rate.id, e.target.value)}
                          placeholder={baseValue.toFixed(2)}
                          className="h-7 text-xs font-mono w-28"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {(hasEdit || overridden) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleSave(rate.id)}
                              disabled={isSaving || !hasEdit}
                            >
                              {isSaving ? '…' : <Save className="h-3 w-3" />}
                            </Button>
                          )}
                          {overridden && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => handleReset(rate.id)}
                              title="Reset to default"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRates;
