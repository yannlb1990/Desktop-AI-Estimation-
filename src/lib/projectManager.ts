// Project Manager - Handles save/load and connects measurements to estimates
// Enables measured areas to automatically generate estimate line items

import { ScaleCalibration, MeasuredLine, MeasuredArea } from './scaleCalibration';
import { EstimatedLineItem, AUSTRALIAN_RATES } from './aiPlanAnalyzer';
import { lookupMaterial } from './materialLookup';

// Room types with their associated work items
export type RoomType =
  | 'living'
  | 'bedroom'
  | 'bathroom'
  | 'kitchen'
  | 'laundry'
  | 'garage'
  | 'hallway'
  | 'outdoor'
  | 'office'
  | 'storage'
  | 'custom';

export interface RoomTypeConfig {
  label: string;
  color: string;
  defaultItems: string[]; // Keys from AUSTRALIAN_RATES
  hasWetArea: boolean;
}

export const ROOM_TYPES: Record<RoomType, RoomTypeConfig> = {
  living: {
    label: 'Living Room',
    color: '#8b5cf6',
    defaultItems: ['Timber floor framing', 'Plasterboard walls', 'Plasterboard ceiling', 'Paint walls', 'Paint ceiling', 'Power point', 'Light point'],
    hasWetArea: false,
  },
  bedroom: {
    label: 'Bedroom',
    color: '#3b82f6',
    defaultItems: ['Timber floor framing', 'Plasterboard walls', 'Plasterboard ceiling', 'Paint walls', 'Paint ceiling', 'Power point', 'Light point', 'Internal door'],
    hasWetArea: false,
  },
  bathroom: {
    label: 'Bathroom',
    color: '#06b6d4',
    defaultItems: ['Villaboard wet area', 'Wet area waterproofing', 'Floor tiles', 'Wall tiles', 'Toilet', 'Basin', 'Shower', 'Light point', 'Power point'],
    hasWetArea: true,
  },
  kitchen: {
    label: 'Kitchen',
    color: '#f59e0b',
    defaultItems: ['Timber floor framing', 'Plasterboard walls', 'Plasterboard ceiling', 'Paint walls', 'Paint ceiling', 'Power point', 'Light point', 'Basin'],
    hasWetArea: false,
  },
  laundry: {
    label: 'Laundry',
    color: '#10b981',
    defaultItems: ['Villaboard wet area', 'Wet area waterproofing', 'Floor tiles', 'Paint walls', 'Paint ceiling', 'Power point', 'Light point', 'Basin'],
    hasWetArea: true,
  },
  garage: {
    label: 'Garage',
    color: '#6b7280',
    defaultItems: ['Concrete slab', 'Plasterboard walls', 'Paint walls', 'Power point', 'Light point'],
    hasWetArea: false,
  },
  hallway: {
    label: 'Hallway/Corridor',
    color: '#a855f7',
    defaultItems: ['Timber floor framing', 'Plasterboard walls', 'Plasterboard ceiling', 'Paint walls', 'Paint ceiling', 'Light point'],
    hasWetArea: false,
  },
  outdoor: {
    label: 'Outdoor/Patio',
    color: '#22c55e',
    defaultItems: ['Concrete slab', 'Light point', 'Power point'],
    hasWetArea: false,
  },
  office: {
    label: 'Office/Study',
    color: '#ec4899',
    defaultItems: ['Timber floor framing', 'Plasterboard walls', 'Plasterboard ceiling', 'Paint walls', 'Paint ceiling', 'Power point', 'Light point', 'Internal door'],
    hasWetArea: false,
  },
  storage: {
    label: 'Storage/Closet',
    color: '#78716c',
    defaultItems: ['Plasterboard walls', 'Paint walls', 'Light point'],
    hasWetArea: false,
  },
  custom: {
    label: 'Custom Area',
    color: '#64748b',
    defaultItems: ['Plasterboard walls', 'Paint walls', 'Light point', 'Power point'],
    hasWetArea: false,
  },
};

// Extended measured area with room assignment
export interface MeasuredRoom extends MeasuredArea {
  roomType: RoomType;
  roomLabel: string;
  customItems?: string[]; // Override default items
  generatedLineItems: string[]; // IDs of generated line items
}

// Project state that can be saved/loaded
export interface ProjectState {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;

  // PDF reference (we store filename, not the actual data)
  pdfFileName?: string;
  pdfPageCount?: number;

  // Calibration
  calibration: ScaleCalibration | null;

  // Measurements
  measuredLines: MeasuredLine[];
  measuredRooms: MeasuredRoom[];

  // Estimates
  lineItems: EstimatedLineItem[];

  // Settings
  settings: {
    labourRateMultiplier: number;
    materialMarkup: number;
    gstRate: number;
    defaultUnit: 'metric' | 'imperial';
  };
}

// Create a new empty project
export function createNewProject(name: string = 'Untitled Project'): ProjectState {
  return {
    id: `proj-${Date.now()}`,
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
    calibration: null,
    measuredLines: [],
    measuredRooms: [],
    lineItems: [],
    settings: {
      labourRateMultiplier: 1.0,
      materialMarkup: 0.15, // 15% markup
      gstRate: 0.10, // 10% GST
      defaultUnit: 'metric',
    },
  };
}

// Generate line items from a measured room
export function generateLineItemsFromRoom(
  room: MeasuredRoom,
  existingItems: EstimatedLineItem[],
  settings: ProjectState['settings']
): EstimatedLineItem[] {
  const roomConfig = ROOM_TYPES[room.roomType];
  const itemKeys = room.customItems || roomConfig.defaultItems;
  const generatedItems: EstimatedLineItem[] = [];

  const areaM2 = room.areaReal;
  const perimeterM = room.perimeter;
  const wallHeight = 2.7; // Standard ceiling height
  const wallAreaM2 = perimeterM * wallHeight;

  for (const itemKey of itemKeys) {
    const rate = AUSTRALIAN_RATES[itemKey];
    if (!rate) continue;

    // Check if this item already exists for this room
    const existingItem = existingItems.find(
      item => item.description.includes(room.roomLabel) && item.description.includes(itemKey)
    );
    if (existingItem) continue;

    // Determine quantity based on item type
    let quantity: number;
    let unit: string = rate.unit;

    // Area-based items (flooring, ceiling, waterproofing)
    if (['Timber floor framing', 'Concrete slab', 'Plasterboard ceiling', 'Paint ceiling',
         'Floor tiles', 'Wet area waterproofing', 'Ceiling insulation'].includes(itemKey)) {
      quantity = areaM2;
    }
    // Wall-based items
    else if (['Plasterboard walls', 'Villaboard wet area', 'Paint walls', 'Wall tiles',
              'Timber wall framing', 'Wall insulation'].includes(itemKey)) {
      quantity = wallAreaM2;
    }
    // Per-room items (fixtures)
    else if (['Toilet', 'Basin', 'Shower', 'Bath', 'Internal door', 'External door'].includes(itemKey)) {
      quantity = 1;
      unit = 'each';
    }
    // Electrical - estimate based on room size
    else if (itemKey === 'Power point') {
      // ~1 GPO per 4m² of floor area, minimum 2
      quantity = Math.max(2, Math.ceil(areaM2 / 4));
      unit = 'each';
    }
    else if (itemKey === 'Light point') {
      // ~1 light per 6m² of floor area, minimum 1
      quantity = Math.max(1, Math.ceil(areaM2 / 6));
      unit = 'each';
    }
    else {
      // Default to area
      quantity = areaM2;
    }

    // Calculate costs
    const materialLookup = lookupMaterial(itemKey);
    const materialRate = materialLookup.found && materialLookup.unitPrice
      ? materialLookup.unitPrice
      : rate.materialRate;

    const labourRate = rate.labourRate * settings.labourRateMultiplier;
    const labourHoursPerUnit = rate.labourHours;
    const labourHours = quantity * labourHoursPerUnit;

    const materialCost = Math.round(quantity * materialRate * (1 + settings.materialMarkup));
    const labourCost = Math.round(labourHours * labourRate);
    const totalCost = materialCost + labourCost;

    const newItem: EstimatedLineItem = {
      id: `${room.id}-${itemKey.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
      description: `${itemKey} - ${room.roomLabel}`,
      trade: rate.trade,
      category: rate.category,
      quantity: Math.round(quantity * 100) / 100,
      unit,
      materialCost,
      labourCost,
      labourHours: Math.round(labourHours * 10) / 10,
      totalCost,
      confidence: 0.95, // High confidence since measured
      source: 'measured',
      pageReferences: [room.pageNumber],
      materialLookup: {
        found: materialLookup.found,
        materialName: materialLookup.materialName,
        supplier: materialLookup.supplier,
        unitPrice: materialLookup.unitPrice,
        priceUnit: materialLookup.priceUnit,
        alternatives: materialLookup.alternatives,
        reason: materialLookup.reason,
      },
      calculationBreakdown: {
        quantitySource: `Measured area: ${room.roomLabel} (${areaM2.toFixed(2)}m²)`,
        quantityFormula: unit === 'm²'
          ? `Floor area: ${areaM2.toFixed(2)}m²`
          : unit === 'each'
          ? `Count: ${quantity}`
          : `Wall area: ${perimeterM.toFixed(2)}m × ${wallHeight}m = ${wallAreaM2.toFixed(2)}m²`,
        assumptions: [
          `Wall height: ${wallHeight}m`,
          `Room type: ${roomConfig.label}`,
        ],
        warnings: materialLookup.found ? [] : ['Material not found in database - using default rates'],
        materialRate,
        materialSource: materialLookup.found
          ? `${materialLookup.supplier}`
          : 'Rawlinsons 2024',
        labourRate,
        labourHoursPerUnit,
        labourSource: 'Fair Work Award + 20%',
      },
    };

    generatedItems.push(newItem);
  }

  return generatedItems;
}

// Save project to localStorage
export function saveProjectToStorage(project: ProjectState): void {
  const projectData = {
    ...project,
    updatedAt: new Date(),
  };

  // Save to localStorage
  localStorage.setItem(`estimation-project-${project.id}`, JSON.stringify(projectData));

  // Update project list
  const projectList = getProjectList();
  const existingIndex = projectList.findIndex(p => p.id === project.id);
  const summary = {
    id: project.id,
    name: project.name,
    updatedAt: new Date(),
    itemCount: project.lineItems.length,
    totalCost: project.lineItems.reduce((sum, item) => sum + item.totalCost, 0),
  };

  if (existingIndex >= 0) {
    projectList[existingIndex] = summary;
  } else {
    projectList.push(summary);
  }

  localStorage.setItem('estimation-projects', JSON.stringify(projectList));
}

// Load project from localStorage
export function loadProjectFromStorage(projectId: string): ProjectState | null {
  const data = localStorage.getItem(`estimation-project-${projectId}`);
  if (!data) return null;

  try {
    const project = JSON.parse(data);
    // Convert date strings back to Date objects
    project.createdAt = new Date(project.createdAt);
    project.updatedAt = new Date(project.updatedAt);
    if (project.calibration?.createdAt) {
      project.calibration.createdAt = new Date(project.calibration.createdAt);
    }
    return project;
  } catch (e) {
    console.error('Failed to load project:', e);
    return null;
  }
}

// Get list of saved projects
export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: Date;
  itemCount: number;
  totalCost: number;
}

export function getProjectList(): ProjectSummary[] {
  const data = localStorage.getItem('estimation-projects');
  if (!data) return [];

  try {
    const list = JSON.parse(data);
    return list.map((p: ProjectSummary) => ({
      ...p,
      updatedAt: new Date(p.updatedAt),
    }));
  } catch (e) {
    return [];
  }
}

// Delete a project
export function deleteProject(projectId: string): void {
  localStorage.removeItem(`estimation-project-${projectId}`);

  const projectList = getProjectList().filter(p => p.id !== projectId);
  localStorage.setItem('estimation-projects', JSON.stringify(projectList));
}

// Export project to JSON file
export function exportProjectToFile(project: ProjectState): void {
  const data = JSON.stringify(project, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import project from JSON file
export function importProjectFromFile(file: File): Promise<ProjectState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const project = JSON.parse(e.target?.result as string);
        project.createdAt = new Date(project.createdAt);
        project.updatedAt = new Date(project.updatedAt);
        if (project.calibration?.createdAt) {
          project.calibration.createdAt = new Date(project.calibration.createdAt);
        }
        // Generate new ID to avoid conflicts
        project.id = `proj-${Date.now()}`;
        resolve(project);
      } catch (err) {
        reject(new Error('Invalid project file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// Export estimate to CSV
export function exportEstimateToCSV(lineItems: EstimatedLineItem[], projectName: string): void {
  const headers = [
    'Description',
    'Trade',
    'Category',
    'Quantity',
    'Unit',
    'Material Cost',
    'Labour Cost',
    'Labour Hours',
    'Total Cost',
    'Confidence',
    'Source',
  ];

  const rows = lineItems.map(item => [
    item.description,
    item.trade,
    item.category,
    item.quantity.toString(),
    item.unit,
    item.materialCost.toString(),
    item.labourCost.toString(),
    item.labourHours.toFixed(1),
    item.totalCost.toString(),
    `${Math.round(item.confidence * 100)}%`,
    item.source,
  ]);

  // Calculate totals
  const totalMaterial = lineItems.reduce((sum, item) => sum + item.materialCost, 0);
  const totalLabour = lineItems.reduce((sum, item) => sum + item.labourCost, 0);
  const totalHours = lineItems.reduce((sum, item) => sum + item.labourHours, 0);
  const grandTotal = lineItems.reduce((sum, item) => sum + item.totalCost, 0);

  rows.push([]);
  rows.push(['TOTALS', '', '', '', '', totalMaterial.toString(), totalLabour.toString(), totalHours.toFixed(1), grandTotal.toString(), '', '']);
  rows.push(['GST (10%)', '', '', '', '', '', '', '', (grandTotal * 0.1).toString(), '', '']);
  rows.push(['TOTAL INC GST', '', '', '', '', '', '', '', (grandTotal * 1.1).toString(), '', '']);

  const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName.replace(/\s+/g, '-')}-estimate-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
