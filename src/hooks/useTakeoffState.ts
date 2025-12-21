import { useReducer } from 'react';
import { TakeoffState, TakeoffAction } from '@/lib/takeoff/types';

const initialState: TakeoffState = {
  pdfFile: null,
  uploadStatus: 'idle',
  uploadError: null,
  currentPageIndex: 0,
  pageCount: 0,
  
  // Transform state (view-only)
  transform: {
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0,
  },
  
  // Scales as Record (JSON-serializable, not Map)
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
  estimate: {
    materials: 0,
    labor: 0,
    subtotal: 0,
    markup: 0,
    total: 0
  },
  roofPitch: { rise: 4, run: 12 },
  depthInput: 0.1,
  selectedColor: '#FF0000',
  history: [[]],
  historyIndex: 0
};

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
        scales: {
          ...state.scales,
          [action.payload.pageIndex]: action.payload.scale
        },
        currentScale: action.payload.pageIndex === state.currentPageIndex 
          ? action.payload.scale 
          : state.currentScale,
        isCalibrated: action.payload.pageIndex === state.currentPageIndex
      };

    case 'RESET_SCALE':
      const newScales = { ...state.scales };
      delete newScales[action.payload];
      return {
        ...state,
        scales: newScales,
        currentScale: action.payload === state.currentPageIndex ? null : state.currentScale,
        isCalibrated: action.payload === state.currentPageIndex ? false : state.isCalibrated,
        calibrationMode: null
      };
      
    case 'SET_CALIBRATION_MODE':
      return { ...state, calibrationMode: action.payload };
      
    case 'SET_TRANSFORM':
      return { 
        ...state, 
        transform: { ...state.transform, ...action.payload }
      };
      
    case 'SET_ACTIVE_TOOL':
      return { ...state, activeTool: action.payload, currentMeasurement: null };
      
    case 'ADD_MEASUREMENT':
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
      return {
        ...state,
        costItems: [...state.costItems, action.payload]
      };
      
    case 'UPDATE_COST_ITEM':
      return {
        ...state,
        costItems: state.costItems.map(item =>
          item.id === action.payload.id ? { ...item, ...action.payload.updates } : item
        )
      };
      
    case 'DELETE_COST_ITEM':
      return {
        ...state,
        costItems: state.costItems.filter(item => item.id !== action.payload)
      };
      
    case 'LINK_MEASUREMENT_TO_COST':
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
        costItems: state.costItems.map(item =>
          item.id === costItemId ? updatedCostItem : item
        ),
        measurements: state.measurements.map(m =>
          m.id === measurementId ? { ...m, linkedCostItem: costItemId } : m
        )
      };
      
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
      
    case 'CALCULATE_ESTIMATE':
      const materialsCost = state.costItems.reduce((sum, item) => sum + item.subtotal, 0);
      const laborCost = state.costItems.reduce((sum, item) => 
        sum + (item.laborHours || 0) * 75, 0
      );
      const subtotal = materialsCost + laborCost;
      const markupAmount = subtotal * 0.15;
      const total = subtotal + markupAmount;
      
      return {
        ...state,
        estimate: {
          materials: materialsCost,
          labor: laborCost,
          subtotal,
          markup: markupAmount,
          total
        }
      };
      
    default:
      return state;
  }
}

export function useTakeoffState() {
  const [state, dispatch] = useReducer(takeoffReducer, initialState);
  
  return { state, dispatch };
}
