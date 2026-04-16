import { useReducer, useEffect } from 'react';
import { TakeoffState, TakeoffAction } from '@/lib/takeoff/types';

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
  selectedColor: '#FF0000',
  history: [[]],
  historyIndex: 0
};

// What we persist to localStorage (excludes pdfFile blob which can't survive reload)
interface PersistedState {
  measurements: TakeoffState['measurements'];
  costItems: TakeoffState['costItems'];
  scales: TakeoffState['scales'];
  pdfName?: string;
  pdfUrl?: string;       // Supabase public URL (survives reload)
  pdfPageCount?: number;
}

const storageKey = (projectId: string) => `takeoff_${projectId}`;

function loadPersisted(projectId: string): PersistedState {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return { measurements: [], costItems: [], scales: {} };
    return JSON.parse(raw);
  } catch {
    return { measurements: [], costItems: [], scales: {} };
  }
}

function savePersisted(projectId: string, state: TakeoffState) {
  try {
    const url = state.pdfFile?.url;
    // Only persist cloud URLs (https://). Blob URLs are session-only and will
    // fail to load after a page refresh, causing "Failed to load PDF" errors.
    const persistableUrl = url && url.startsWith('https://') ? url : undefined;
    const persisted: PersistedState = {
      measurements: state.measurements,
      costItems: state.costItems,
      scales: state.scales,
      pdfName: persistableUrl ? state.pdfFile?.name : undefined,
      pdfUrl: persistableUrl,
      pdfPageCount: persistableUrl ? state.pdfFile?.pageCount : undefined,
    };
    localStorage.setItem(storageKey(projectId), JSON.stringify(persisted));
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
    isCalibrated: hasScales,
    currentScale: hasScales ? persisted.scales[0] || null : null,
    // Restore PDF only from cloud (https://) URLs — blob:// URLs expire on reload
    pdfFile: persisted.pdfUrl && persisted.pdfUrl.startsWith('https://')
      ? {
          file: null as any, // restored from URL, no File object
          url: persisted.pdfUrl,
          name: persisted.pdfName || 'plan.pdf',
          pageCount: persisted.pdfPageCount || 1,
        }
      : null,
    uploadStatus: persisted.pdfUrl && persisted.pdfUrl.startsWith('https://') ? 'success' : 'idle',
    pageCount: persisted.pdfUrl && persisted.pdfUrl.startsWith('https://') ? (persisted.pdfPageCount || 0) : 0,
  };
}

function takeoffReducer(state: TakeoffState, action: TakeoffAction): TakeoffState {
  switch (action.type) {
    case 'SET_PDF_FILE':
      return {
        ...state,
        pdfFile: action.payload,
        pageCount: action.payload.pageCount,
        uploadStatus: 'success'
      };

    case 'SET_UPLOAD_STATUS':
      return { ...state, uploadStatus: action.payload };

    case 'SET_UPLOAD_ERROR':
      return { ...state, uploadError: action.payload, uploadStatus: 'error' };

    case 'SET_CURRENT_PAGE':
      return {
        ...state,
        currentPageIndex: action.payload,
        currentScale: state.scales[action.payload] || null,
        isCalibrated: !!state.scales[action.payload]
      };

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

    case 'SET_TRANSFORM':
      return { ...state, transform: { ...state.transform, ...action.payload } };

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

    case 'UPDATE_MEASUREMENT':
      return {
        ...state,
        measurements: state.measurements.map(m =>
          m.id === action.payload.id ? { ...m, ...action.payload.updates } : m
        )
      };

    case 'DELETE_MEASUREMENT':
      return {
        ...state,
        measurements: state.measurements.filter(m => m.id !== action.payload),
        selectedMeasurementId: state.selectedMeasurementId === action.payload
          ? null
          : state.selectedMeasurementId
      };

    case 'SELECT_MEASUREMENT':
      return { ...state, selectedMeasurementId: action.payload };

    case 'SET_CURRENT_MEASUREMENT':
      return { ...state, currentMeasurement: action.payload };

    case 'ADD_COST_ITEM':
      return { ...state, costItems: [...state.costItems, action.payload] };

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
      const laborCost = state.costItems.reduce((sum, item) => sum + (item.laborHours || 0) * 75, 0);
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

  // Auto-persist whenever measurements, costItems, scales, or pdfFile changes
  useEffect(() => {
    if (!projectId) return;
    savePersisted(projectId, state);
  }, [state.measurements, state.costItems, state.scales, state.pdfFile, projectId]);

  return { state, dispatch };
}
