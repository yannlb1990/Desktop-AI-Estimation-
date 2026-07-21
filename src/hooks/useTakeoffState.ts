import { useReducer, useEffect, useRef } from 'react';
import { TakeoffState, TakeoffAction, Measurement } from '@/lib/takeoff/types';
import { getEffectiveQuantity } from '@/lib/takeoff/calculations';
import { supabase } from '@/integrations/supabase/client';

// Fields on Measurement whose change should cascade to linked cost item quantities
const QUANTITY_FIELDS = new Set<keyof Measurement>([
  'realValue', 'height', 'concreteDepth', 'computedM2', 'computedM3',
  'measurementType', 'isConcreteFloor', 'unit',
]);

const initialState: TakeoffState = {
  pdfFile: null,
  uploadStatus: 'idle',
  uploadError: null,
  currentPageIndex: 0,
  pageCount: 0,
  transform: { zoom: 1, panX: 0, panY: 0, rotation: 0 },
  scales: {},
  currentScale: null,
  isCalibrated: false,
  calibrationMode: null,
  activeTool: null,
  measurements: [],
  selectedMeasurementId: null,
  currentMeasurement: null,
  costItems: [],
  selectedCostItemId: null,
  estimate: { materials: 0, labor: 0, subtotal: 0, markup: 0, total: 0 },
  roofPitch: { rise: 4, run: 12 },
  depthInput: 0.1,
  selectedColor: '#ef4444',
  rotations: {},
  history: [[]],
  historyIndex: 0
};

const SCHEMA_VERSION = 2;

// What we persist to localStorage (excludes pdfFile blob which can't survive reload)
interface PersistedState {
  _schemaVersion?: number;
  measurements: TakeoffState['measurements'];
  costItems: TakeoffState['costItems'];
  scales: TakeoffState['scales'];
  rotations?: TakeoffState['rotations'];
  planId?: string;       // Stable plan identifier (name + size) — persisted even for blob URLs
  pdfName?: string;
  pdfUrl?: string;       // Supabase public URL (survives reload)
  pdfPageCount?: number;
  _localUpdatedAt?: number; // milliseconds — used to resolve localStorage vs Supabase conflict
}

const storageKey = (projectId: string) => `takeoff_${projectId}`;

function loadPersisted(projectId: string): PersistedState {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return { measurements: [], costItems: [], scales: {} };
    let data: PersistedState;
    try {
      data = JSON.parse(raw);
    } catch {
      // Corrupted JSON — return clean state rather than crashing
      console.warn('[takeoff] Corrupted localStorage state — resetting');
      return { measurements: [], costItems: [], scales: {} };
    }
    // Schema version check — future migrations go here
    if (data._schemaVersion !== undefined && data._schemaVersion > SCHEMA_VERSION) {
      console.warn('[takeoff] State from newer schema version — resetting');
      return { measurements: [], costItems: [], scales: {} };
    }
    // Migrate WallHatchSide: 'l1'/'l2' → 'left'/'right'
    if (data.measurements) {
      data.measurements = data.measurements.map((m: any) => {
        if (m.wallHatchSide === 'l1') return { ...m, wallHatchSide: 'left' };
        if (m.wallHatchSide === 'l2') return { ...m, wallHatchSide: 'right' };
        return m;
      });
    }
    // Migrate old Wall/Door/Window measurements that stored the value in the label.
    // New code stores label: '' so no text renders on canvas; clear any old labels here.
    if (data.measurements) {
      data.measurements = data.measurements.map((m: any) => {
        const mt: string | undefined = m.measurementType;
        if (mt === 'Wall' || mt === 'Door' || mt === 'Window') return { ...m, label: '' };
        const lbl: string = m.label || '';
        if (
          lbl.startsWith('Wall ') || lbl === 'Wall' ||
          lbl.startsWith('Door ') || lbl === 'Door' ||
          lbl.startsWith('Window ') || lbl === 'Window'
        ) return { ...m, label: '' };
        return m;
      });
    }
    // Pre-tag any untagged measurements with the persisted planId so they survive
    // page refreshes where the blob URL (and therefore pdfFile) cannot be restored.
    if (data.planId && data.measurements) {
      data.measurements = data.measurements.map((m: any) =>
        m.planId ? m : { ...m, planId: data.planId }
      );
    }
    // Migrate AI-pushed cost items that used wrong field names (rate/total → unitCost/subtotal)
    if (data.costItems) {
      data.costItems = data.costItems.map((item: any) => {
        if (item.unitCost === undefined && item.rate !== undefined) {
          const unitCost = item.rate ?? 0;
          return {
            ...item,
            unitCost,
            subtotal: item.total ?? unitCost * (item.quantity ?? 0),
            linkedMeasurements: item.linkedMeasurements ?? [],
            wasteFactor: item.wasteFactor ?? 1,
            category: item.category ?? item.trade ?? 'General',
            name: item.name ?? item.description ?? item.trade ?? 'Cost Item',
          };
        }
        return item;
      });
    }
    return data;
  } catch {
    return { measurements: [], costItems: [], scales: {} };
  }
}

function savePersisted(projectId: string, state: TakeoffState) {
  try {
    const url = state.pdfFile?.url;
    // Persist cloud URLs (https://) and storage paths (storage:bucket/path).
    // Blob URLs are session-only and will fail to load after a page refresh.
    const persistableUrl = url && (url.startsWith('https://') || url.startsWith('storage:')) ? url : undefined;
    const persisted: PersistedState = {
      _schemaVersion: SCHEMA_VERSION,
      measurements: state.measurements,
      costItems: state.costItems,
      scales: state.scales,
      rotations: state.rotations,
      planId: state.pdfFile?.planId,
      pdfName: persistableUrl ? state.pdfFile?.name : undefined,
      pdfUrl: persistableUrl,
      pdfPageCount: persistableUrl ? state.pdfFile?.pageCount : undefined,
    };
    localStorage.setItem(storageKey(projectId), JSON.stringify({ ...persisted, _localUpdatedAt: Date.now() }));
  } catch {
    // localStorage full — silently skip
  }
}

function buildInitialState(projectId?: string): TakeoffState {
  if (!projectId) return initialState;
  const persisted = loadPersisted(projectId);
  const hasScales = Object.keys(persisted.scales || {}).length > 0;
  return {
    ...initialState,
    measurements: persisted.measurements || [],
    costItems: persisted.costItems || [],
    scales: persisted.scales || {},
    rotations: persisted.rotations || {},
    isCalibrated: hasScales,
    currentScale: hasScales ? persisted.scales[0] || null : null,
    // Restore PDF from cloud URLs (https://) or storage paths (storage:bucket/path).
    // Blob URLs expire on reload and are not restored.
    pdfFile: persisted.pdfUrl && (persisted.pdfUrl.startsWith('https://') || persisted.pdfUrl.startsWith('storage:'))
      ? {
          file: null as any,
          url: persisted.pdfUrl, // storage: paths are resolved to signed URLs via useEffect
          name: persisted.pdfName || 'plan.pdf',
          pageCount: persisted.pdfPageCount || 1,
          planId: persisted.planId,
        }
      : null,
    uploadStatus: persisted.pdfUrl && (persisted.pdfUrl.startsWith('https://') || persisted.pdfUrl.startsWith('storage:')) ? 'success' : 'idle',
    pageCount: persisted.pdfUrl && (persisted.pdfUrl.startsWith('https://') || persisted.pdfUrl.startsWith('storage:')) ? (persisted.pdfPageCount || 0) : 0,
  };
}

function takeoffReducer(state: TakeoffState, action: TakeoffAction): TakeoffState {
  switch (action.type) {
    case 'SET_PDF_FILE': {
      const newPlanId = action.payload.planId;
      const oldPlanId = state.pdfFile?.planId;

      // Whenever a plan with a planId is loaded, tag all currently-untagged measurements
      // with the old plan's id (or 'legacy' if the previous pdfFile had none).
      // This ensures measurements never bleed onto a different plan.
      const isChangingPlan = !!newPlanId;
      const fallbackId = oldPlanId || 'legacy';
      const updatedMeasurements = isChangingPlan
        ? state.measurements.map(m => m.planId ? m : { ...m, planId: fallbackId })
        : state.measurements;

      return {
        ...state,
        pdfFile: action.payload,
        pageCount: action.payload.pageCount,
        currentPageIndex: 0,
        uploadStatus: 'success',
        measurements: updatedMeasurements,
      };
    }

    case 'SET_UPLOAD_STATUS':
      return { ...state, uploadStatus: action.payload };

    case 'SET_UPLOAD_ERROR':
      return { ...state, uploadError: action.payload, uploadStatus: 'error' };

    case 'SET_CURRENT_PAGE': {
      const savedRotation = state.rotations[action.payload] ?? 0;
      return {
        ...state,
        currentPageIndex: action.payload,
        currentScale: state.scales[action.payload] || null,
        isCalibrated: !!state.scales[action.payload],
        transform: { ...state.transform, rotation: savedRotation as 0 | 90 | 180 | 270 },
      };
    }

    case 'SET_SCALE':
      return {
        ...state,
        scales: { ...state.scales, [action.payload.pageIndex]: action.payload.scale },
        currentScale: action.payload.pageIndex === state.currentPageIndex
          ? action.payload.scale
          : state.currentScale,
        isCalibrated: action.payload.pageIndex === state.currentPageIndex
      };

    case 'RESET_SCALE': {
      const newScales = { ...state.scales };
      delete newScales[action.payload];
      return {
        ...state,
        scales: newScales,
        currentScale: action.payload === state.currentPageIndex ? null : state.currentScale,
        isCalibrated: action.payload === state.currentPageIndex ? false : state.isCalibrated,
        calibrationMode: null
      };
    }

    case 'SET_CALIBRATION_MODE':
      return { ...state, calibrationMode: action.payload };

    case 'SET_TRANSFORM': {
      const newTransform = { ...state.transform, ...action.payload };
      // Persist rotation per page so it survives page navigation
      const newRotations = action.payload.rotation !== undefined
        ? { ...state.rotations, [state.currentPageIndex]: action.payload.rotation }
        : state.rotations;
      return { ...state, transform: newTransform, rotations: newRotations };
    }

    case 'SET_ACTIVE_TOOL':
      return { ...state, activeTool: action.payload, currentMeasurement: null };

    case 'ADD_MEASUREMENT': {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      const newMeasurements = [...state.measurements, action.payload];
      newHistory.push(newMeasurements);
      return {
        ...state,
        measurements: newMeasurements,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        currentMeasurement: null
      };
    }

    case 'UPDATE_MEASUREMENT': {
      const { id, updates } = action.payload;

      const updatedMeasurements = state.measurements.map(m =>
        m.id === id ? { ...m, ...updates } : m
      );

      // Only cascade to cost items when a quantity-relevant field changed
      const affectsQty = (Object.keys(updates) as (keyof Measurement)[])
        .some(k => QUANTITY_FIELDS.has(k));

      if (!affectsQty) {
        return { ...state, measurements: updatedMeasurements };
      }

      const updatedM = updatedMeasurements.find(m => m.id === id);
      if (!updatedM) return { ...state, measurements: updatedMeasurements };

      const costItems = state.costItems.map(item => {
        if (!item.linkedMeasurements.includes(id)) return item;

        // Sum effective qty across ALL linked measurements; use updated value for this id
        const totalQty = item.linkedMeasurements.reduce((sum, mId) => {
          const m = mId === id ? updatedM : state.measurements.find(x => x.id === mId);
          return m ? sum + getEffectiveQuantity(m) : sum;
        }, 0);

        const newQty = totalQty * item.wasteFactor;
        return { ...item, quantity: newQty, subtotal: newQty * item.unitCost };
      });

      return { ...state, measurements: updatedMeasurements, costItems };
    }

    case 'DELETE_MEASUREMENT': {
      const deletedId = action.payload;
      const updatedMeasurements = state.measurements.filter(m => m.id !== deletedId);

      // Cascade: remove deleted id from linked lists; recalculate for affected items
      const costItems = state.costItems.map(item => {
        if (!item.linkedMeasurements.includes(deletedId)) return item;

        const remaining = item.linkedMeasurements.filter(id => id !== deletedId);
        if (remaining.length === 0) {
          // No links left — keep existing quantity so the user can decide
          return { ...item, linkedMeasurements: [] };
        }

        const totalQty = remaining.reduce((sum, mId) => {
          const m = updatedMeasurements.find(x => x.id === mId);
          return m ? sum + getEffectiveQuantity(m) : sum;
        }, 0);

        const newQty = totalQty * item.wasteFactor;
        return {
          ...item,
          linkedMeasurements: remaining,
          quantity: newQty,
          subtotal: newQty * item.unitCost,
        };
      });

      return {
        ...state,
        measurements: updatedMeasurements,
        costItems,
        selectedMeasurementId: state.selectedMeasurementId === deletedId
          ? null
          : state.selectedMeasurementId,
      };
    }

    case 'SELECT_MEASUREMENT':
      return { ...state, selectedMeasurementId: action.payload };

    case 'SET_CURRENT_MEASUREMENT':
      return { ...state, currentMeasurement: action.payload };

    case 'ADD_COST_ITEM': {
      const incoming = action.payload;
      const isDuplicate = state.costItems.some((item) => {
        if (incoming.rateId && item.rateId) return incoming.rateId === item.rateId;
        return (item.name ?? '').toLowerCase() === (incoming.name ?? '').toLowerCase() &&
               item.unit === incoming.unit;
      });
      if (isDuplicate) return state;
      return { ...state, costItems: [...state.costItems, incoming] };
    }

    case 'UPDATE_COST_ITEM':
      return {
        ...state,
        costItems: state.costItems.map(item =>
          item.id === action.payload.id ? { ...item, ...action.payload.updates } : item
        )
      };

    case 'DELETE_COST_ITEM':
      return { ...state, costItems: state.costItems.filter(item => item.id !== action.payload) };

    case 'LINK_MEASUREMENT_TO_COST': {
      const { measurementId, costItemId } = action.payload;
      const measurement = state.measurements.find(m => m.id === measurementId);
      const costItem = state.costItems.find(c => c.id === costItemId);
      if (!measurement || !costItem) return state;
      const updatedCostItem = {
        ...costItem,
        quantity: measurement.realValue * costItem.wasteFactor,
        linkedMeasurements: [...costItem.linkedMeasurements, measurementId],
        subtotal: (measurement.realValue * costItem.wasteFactor) * costItem.unitCost
      };
      return {
        ...state,
        costItems: state.costItems.map(item => item.id === costItemId ? updatedCostItem : item),
        measurements: state.measurements.map(m =>
          m.id === measurementId ? { ...m, linkedCostItem: costItemId } : m
        )
      };
    }

    case 'SET_ROOF_PITCH':
      return { ...state, roofPitch: action.payload };

    case 'SET_DEPTH_INPUT':
      return { ...state, depthInput: action.payload };

    case 'SET_SELECTED_COLOR':
      return { ...state, selectedColor: action.payload };

    case 'LOAD_PERSISTED_STATE': {
      const { measurements, costItems, scales, pdfUrl, pdfName, pdfPageCount, planId } = action.payload;
      const hasScales = Object.keys(scales || {}).length > 0;
      // Deduplicate existing costItems — prefer rateId as key, fall back to name+unit
      const seenRateIds = new Set<string>();
      const seenNameUnit = new Set<string>();
      const deduped = (costItems || []).filter((item: any) => {
        if (item.rateId) {
          if (seenRateIds.has(item.rateId)) return false;
          seenRateIds.add(item.rateId);
          return true;
        }
        const key = `${(item.name ?? '').toLowerCase()}|${item.unit ?? ''}`;
        if (seenNameUnit.has(key)) return false;
        seenNameUnit.add(key);
        return true;
      });
      const isCloudUrl = pdfUrl?.startsWith('https://') || pdfUrl?.startsWith('storage:');
      return {
        ...state,
        measurements: measurements || [],
        costItems: deduped,
        scales: scales || {},
        rotations: (action.payload as any).rotations || state.rotations,
        isCalibrated: hasScales,
        currentScale: hasScales ? (scales[state.currentPageIndex] ?? scales[0] ?? null) : null,
        pdfFile: isCloudUrl
          ? { file: null as any, url: pdfUrl!, name: pdfName || 'plan.pdf', pageCount: pdfPageCount || 1, planId }
          : state.pdfFile,
        uploadStatus: isCloudUrl ? 'success' : state.uploadStatus,
        pageCount: isCloudUrl ? (pdfPageCount || 0) : state.pageCount,
      };
    }

    case 'SET_PDF_URL':
      if (!state.pdfFile) return state;
      return { ...state, pdfFile: { ...state.pdfFile, url: action.payload } };

    case 'UNDO':
      if (state.historyIndex > 0) {
        return {
          ...state,
          measurements: state.history[state.historyIndex - 1],
          historyIndex: state.historyIndex - 1
        };
      }
      return state;

    case 'REDO':
      if (state.historyIndex < state.history.length - 1) {
        return {
          ...state,
          measurements: state.history[state.historyIndex + 1],
          historyIndex: state.historyIndex + 1
        };
      }
      return state;

    case 'DELETE_LAST_MEASUREMENT':
      if (state.measurements.length > 0) {
        const newMeasurements = state.measurements.slice(0, -1);
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(newMeasurements);
        return {
          ...state,
          measurements: newMeasurements,
          history: newHistory,
          historyIndex: newHistory.length - 1
        };
      }
      return state;

    case 'CALCULATE_ESTIMATE': {
      const materialsCost = state.costItems.reduce((sum, item) => sum + item.subtotal, 0);
      const laborCost = state.costItems.reduce((sum, item) => sum + (item.labourHours || 0) * (item.hourlyRate ?? 75), 0);
      const subtotal = materialsCost + laborCost;
      const markupAmount = subtotal * 0.15;
      return {
        ...state,
        estimate: { materials: materialsCost, labor: laborCost, subtotal, markup: markupAmount, total: subtotal + markupAmount }
      };
    }

    default:
      return state;
  }
}

export function useTakeoffState(projectId?: string) {
  const [state, dispatch] = useReducer(
    takeoffReducer,
    projectId,
    buildInitialState
  );

  // Suppress cloud save for 3s after loading from cloud to avoid immediate write-back
  const suppressCloudSaveUntil = useRef<number>(0);
  const cloudSyncStatus = useRef<'idle' | 'loading' | 'ready'>('idle');

  // ── Load from Supabase on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    cloudSyncStatus.current = 'loading';

    async function loadFromCloud() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) { cloudSyncStatus.current = 'ready'; return; }

        const { data, error } = await supabase
          .from('takeoff_sessions')
          .select('measurements, cost_items, scales, plan_id, pdf_name, pdf_url, pdf_page_count, updated_at')
          .eq('project_id', projectId)
          .single();

        if (cancelled || error || !data) { cloudSyncStatus.current = 'ready'; return; }

        // Conflict resolution: use whichever source is newer
        const cloudTs = new Date(data.updated_at).getTime();
        const localRaw = localStorage.getItem(storageKey(projectId));
        const localTs: number = localRaw ? (JSON.parse(localRaw)._localUpdatedAt ?? 0) : 0;

        if (cloudTs > localTs) {
          suppressCloudSaveUntil.current = Date.now() + 3000;
          dispatch({
            type: 'LOAD_PERSISTED_STATE',
            payload: {
              measurements: (data.measurements as any) ?? [],
              costItems: (data.cost_items as any) ?? [],
              scales: (data.scales as any) ?? {},
              planId: data.plan_id ?? undefined,
              pdfName: data.pdf_name ?? undefined,
              pdfUrl: data.pdf_url ?? undefined,
              pdfPageCount: data.pdf_page_count ?? undefined,
            },
          });
        }
      } catch (err) {
        console.warn('[takeoff] Cloud load failed:', err);
      } finally {
        if (!cancelled) cloudSyncStatus.current = 'ready';
      }
    }

    loadFromCloud();
    return () => { cancelled = true; };
  }, [projectId]);

  // ── Persist on every change: localStorage immediately, Supabase debounced ─
  useEffect(() => {
    if (!projectId) return;

    // Always keep localStorage in sync immediately (same-browser fast reload)
    savePersisted(projectId, state);

    // Don't queue a cloud save if we just loaded from cloud (suppress window)
    if (Date.now() < suppressCloudSaveUntil.current) return;

    const timer = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const url = state.pdfFile?.url;
        const persistableUrl = url && (url.startsWith('https://') || url.startsWith('storage:')) ? url : null;

        const { error } = await supabase.from('takeoff_sessions').upsert({
          project_id: projectId,
          user_id: session.user.id,
          measurements: state.measurements as any,
          cost_items: state.costItems as any,
          scales: state.scales as any,
          plan_id: state.pdfFile?.planId ?? null,
          pdf_name: persistableUrl ? (state.pdfFile?.name ?? null) : null,
          pdf_url: persistableUrl,
          pdf_page_count: persistableUrl ? (state.pdfFile?.pageCount ?? null) : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'project_id' });

        if (error) console.warn('[takeoff] Cloud save failed:', error.message);
      } catch (err) {
        console.warn('[takeoff] Cloud save error:', err);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [state.measurements, state.costItems, state.scales, state.pdfFile, projectId]);

  // Resolve storage: paths to 1-hour signed URLs so pdf.js and Fabric.js can load them
  useEffect(() => {
    const url = state.pdfFile?.url;
    if (!url?.startsWith('storage:')) return;

    const withoutPrefix = url.replace('storage:', '');
    const slashIdx = withoutPrefix.indexOf('/');
    if (slashIdx === -1) return;

    const bucket = withoutPrefix.slice(0, slashIdx);
    const path = withoutPrefix.slice(slashIdx + 1);

    supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data, error }) => {
      if (!error && data?.signedUrl) {
        dispatch({ type: 'SET_PDF_URL', payload: data.signedUrl });
      }
    });
  }, [state.pdfFile?.url]);

  return { state, dispatch };
}
