// AI Plan Analyzer Component - Displays PDF analysis results and auto-generated estimation
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileText,
  Layers,
  DoorOpen,
  Square,
  Zap,
  Droplets,
  Home,
  Check,
  AlertTriangle,
  Info,
  Download,
  RefreshCw,
  Building2,
  CircleDot,
  Grid3X3,
  Lightbulb,
  ShowerHead,
  Calculator,
  Edit2,
  Eye,
  HelpCircle,
  Shield,
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  Copy,
  FolderOpen,
  FileDown,
  FileUp,
  History,
  ChevronDown,
  ChevronRight,
  List,
  LayoutGrid,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  PlanAnalysisResult,
  EstimatedLineItem,
  PageAnalysis,
  SourceLocation,
  calculateEstimateTotals,
  getAnalysisConfidenceLevel,
  MaterialLookupInfo,
  CalculationBreakdown,
  exportAnalysisToJSON,
} from '@/lib/aiPlanAnalyzer';
import {
  ScopeGap,
  detectScopeGaps,
  getGapSummary,
} from '@/lib/scopeGapChecker';
import { ScopeGapChecker } from './ScopeGapChecker';
import { PDFAnalysisViewer } from './PDFAnalysisViewer';
import { CalculationBreakdownDialog } from './CalculationBreakdown';
import {
  ProjectState,
  MeasuredRoom,
  createNewProject,
  generateLineItemsFromRoom,
  saveProjectToStorage,
  loadProjectFromStorage,
  getProjectList,
  exportProjectToFile,
  exportEstimateToCSV,
  ProjectSummary,
} from '@/lib/projectManager';
import { ScaleCalibration, MeasuredLine } from '@/lib/scaleCalibration';

interface AIPlanAnalyzerProps {
  analysis: PlanAnalysisResult;
  pdfData?: ArrayBuffer;  // Optional PDF data for viewer
  onAcceptEstimate: (items: EstimatedLineItem[]) => void;
  onReanalyze?: () => void;
  isLoading?: boolean;
}

// Editable line item type
interface EditableLineItem extends EstimatedLineItem {
  isEdited?: boolean;
}

const DRAWING_TYPE_ICONS: Record<string, React.ReactNode> = {
  floor_plan: <Grid3X3 className="h-4 w-4" />,
  site_plan: <Home className="h-4 w-4" />,
  elevation: <Building2 className="h-4 w-4" />,
  section: <Layers className="h-4 w-4" />,
  detail: <CircleDot className="h-4 w-4" />,
  schedule: <FileText className="h-4 w-4" />,
  electrical: <Zap className="h-4 w-4" />,
  plumbing: <Droplets className="h-4 w-4" />,
  structural: <Building2 className="h-4 w-4" />,
  ffe: <Square className="h-4 w-4" />,
  roof_plan: <Home className="h-4 w-4" />,
  reflected_ceiling: <Lightbulb className="h-4 w-4" />,
  landscape: <Home className="h-4 w-4" />,
  unknown: <FileText className="h-4 w-4" />,
};

const DRAWING_TYPE_LABELS: Record<string, string> = {
  floor_plan: 'Floor Plan',
  site_plan: 'Site Plan',
  elevation: 'Elevation',
  section: 'Section',
  detail: 'Detail',
  schedule: 'Schedule',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  structural: 'Structural',
  ffe: 'FF&E',
  roof_plan: 'Roof Plan',
  reflected_ceiling: 'Reflected Ceiling',
  landscape: 'Landscape',
  unknown: 'Unknown',
};

const CONSTRUCTION_TYPE_LABELS: Record<string, string> = {
  timber_frame: 'Timber Frame',
  steel_frame: 'Steel Frame',
  brick_veneer: 'Brick Veneer',
  double_brick: 'Double Brick',
  concrete: 'Concrete/Masonry',
  unknown: 'Unknown',
};

const CONFIDENCE_COLORS = {
  high: 'bg-green-500',
  medium: 'bg-yellow-500',
  low: 'bg-red-500',
};

// Explanation for each source type
const SOURCE_EXPLANATIONS: Record<string, string> = {
  schedule: 'Extracted from door/window schedule in PDF',
  detected: 'Detected from symbols or text patterns in drawings',
  inferred: 'Estimated based on typical construction requirements',
};

// Rate explanations
const RATE_EXPLANATIONS: Record<string, { material: string; labour: string; basis: string }> = {
  'Timber wall framing': { material: '$45/m2 - Pine/treated pine studs 90x45', labour: '$37.50/m2 (0.5hr @ $75/hr)', basis: 'Based on Rawlinsons 2024' },
  'Steel wall framing': { material: '$55/m2 - Light gauge steel C-section', labour: '$51/m2 (0.6hr @ $85/hr)', basis: 'Based on Rawlinsons 2024' },
  'Plasterboard walls': { material: '$22/m2 - 10mm standard plasterboard', labour: '$22.75/m2 (0.35hr @ $65/hr)', basis: 'Based on Rawlinsons 2024' },
  'Plasterboard ceiling': { material: '$25/m2 - 10mm ceiling plasterboard', labour: '$26/m2 (0.4hr @ $65/hr)', basis: 'Based on Rawlinsons 2024' },
  'Brick veneer': { material: '$95/m2 - Standard face bricks', labour: '$102/m2 (1.2hr @ $85/hr)', basis: 'Based on Rawlinsons 2024' },
  'Concrete slab': { material: '$180/m2 - 100mm slab, mesh, vapour barrier', labour: '$13.50/m2 (0.15hr @ $90/hr)', basis: 'Based on Rawlinsons 2024' },
  'Metal roofing': { material: '$65/m2 - Colorbond custom orb', labour: '$24/m2 (0.3hr @ $80/hr)', basis: 'Based on Rawlinsons 2024' },
  'Internal door': { material: '$350/each - Hollow core, frame, hardware', labour: '$112.50/each (1.5hr @ $75/hr)', basis: 'Based on supplier quotes' },
  'External door': { material: '$650/each - Solid core, frame, hardware', labour: '$150/each (2hr @ $75/hr)', basis: 'Based on supplier quotes' },
  'Window (standard)': { material: '$450/each - Aluminium frame, glazed', labour: '$112.50/each (1.5hr @ $75/hr)', basis: 'Based on supplier quotes' },
  'Power point': { material: '$25/each - GPO, plate, wiring', labour: '$47.50/each (0.5hr @ $95/hr)', basis: 'Based on electrician rates' },
  'Toilet': { material: '$450/each - Vitreous china suite', labour: '$250/each (2.5hr @ $100/hr)', basis: 'Based on plumber rates' },
};

// Trade options for dropdown
const TRADE_OPTIONS = [
  'Preliminaries',
  'Site Works',
  'Demolition',
  'Concrete',
  'Structural Steel',
  'Carpentry',
  'Brickwork',
  'Roofing',
  'Windows & Doors',
  'Plasterboard',
  'Joinery',
  'Painting',
  'Tiling',
  'Floor Coverings',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Fire Services',
  'Landscaping',
  'External Works',
  'Certifications',
  'Other',
];

// Unit options
const UNIT_OPTIONS = ['m2', 'm', 'each', 'item', 'lm', 'm3', 'kg', 'hr', 'day', 'lot', 'set'];

// Default new item template
const createNewItem = (trade: string = 'Other'): EditableLineItem => ({
  id: `MANUAL-${Date.now()}`,
  trade,
  category: 'Manual Entry',
  description: '',
  quantity: 1,
  unit: 'each' as EstimatedLineItem['unit'],
  unitRate: 0,
  labourHours: 0,
  materialCost: 0,
  labourCost: 0,
  totalCost: 0,
  source: 'inferred' as const,
  confidence: 1,
  isEdited: true,
});

export function AIPlanAnalyzer({
  analysis,
  pdfData,
  onAcceptEstimate,
  onReanalyze,
  isLoading = false,
}: AIPlanAnalyzerProps) {
  // Make items editable
  const [editableItems, setEditableItems] = useState<EditableLineItem[]>(
    analysis.estimatedItems.map(item => ({ ...item, isEdited: false }))
  );
  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    new Set(analysis.estimatedItems.map(item => item.id))
  );
  const [activeTab, setActiveTab] = useState('overview');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState<EditableLineItem>(createNewItem());
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  // PDF viewer state
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [viewerPage, setViewerPage] = useState(1);
  const [viewerNavVersion, setViewerNavVersion] = useState(0);

  // Navigate the PDF viewer to a specific page — always fires even if page hasn't changed
  const navigateViewer = useCallback((page: number) => {
    setViewerPage(page);
    setViewerNavVersion(v => v + 1);
    setActiveTab('drawings');
  }, []);

  // Expanded page card in the Drawings tab page list
  const [expandedPageIdx, setExpandedPageIdx] = useState<number | null>(null);

  // Jump to drawings tab at the page where a symbol type is most concentrated
  const jumpToDrawing = useCallback((symbolType: string | null, drawingType?: string) => {
    let targetPage = 1;
    if (symbolType) {
      const best = analysis.pages
        .map(p => ({ pageNumber: p.pageNumber, count: p.symbols.filter(s => s.type === symbolType).length }))
        .reduce((a, b) => b.count > a.count ? b : a, { pageNumber: 1, count: 0 });
      if (best.count > 0) targetPage = best.pageNumber;
    } else if (drawingType) {
      const pg = analysis.pages.find(p => p.drawingType === drawingType);
      if (pg) targetPage = pg.pageNumber;
    } else {
      // Fall back to first floor plan
      const fp = analysis.pages.find(p => p.drawingType === 'floor_plan');
      if (fp) targetPage = fp.pageNumber;
    }
    navigateViewer(targetPage);
  }, [analysis.pages, navigateViewer]);

  // Scope gap detection
  const [scopeGaps, setScopeGaps] = useState<ScopeGap[]>([]);

  // Project state for save/load and measurements
  const [project, setProject] = useState<ProjectState>(() => createNewProject(analysis.fileName?.replace(/\.[^.]+$/, '') || 'Untitled'));
  const [calibration, setCalibration] = useState<ScaleCalibration | null>(null);
  const [measuredRooms, setMeasuredRooms] = useState<MeasuredRoom[]>([]);
  const [measuredLines, setMeasuredLines] = useState<MeasuredLine[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [savedProjects, setSavedProjects] = useState<ProjectSummary[]>([]);
  const [projectName, setProjectName] = useState(analysis.fileName?.replace(/\.[^.]+$/, '') || 'Untitled Project');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Overhead and margin percentages
  const [siteOverheads, setSiteOverheads] = useState(8); // %
  const [companyOverheads, setCompanyOverheads] = useState(5); // %
  const [contingency, setContingency] = useState(5); // %
  const [margin, setMargin] = useState(10); // %

  // Trade grouping state
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('grouped');
  const [expandedTrades, setExpandedTrades] = useState<Set<string>>(new Set(TRADE_OPTIONS));

  // Group items by trade
  const groupedItems = useMemo(() => {
    const groups: Record<string, { items: EditableLineItem[]; subtotal: number; selectedCount: number }> = {};

    // Initialize all trades
    TRADE_OPTIONS.forEach(trade => {
      groups[trade] = { items: [], subtotal: 0, selectedCount: 0 };
    });

    // Group items
    editableItems.forEach(item => {
      const trade = item.trade || 'Other';
      if (!groups[trade]) {
        groups[trade] = { items: [], subtotal: 0, selectedCount: 0 };
      }
      groups[trade].items.push(item);
      if (selectedItems.has(item.id)) {
        groups[trade].subtotal += item.totalCost;
        groups[trade].selectedCount++;
      }
    });

    // Return only non-empty groups, sorted by TRADE_OPTIONS order
    return TRADE_OPTIONS
      .filter(trade => groups[trade].items.length > 0)
      .map(trade => ({
        trade,
        ...groups[trade],
      }));
  }, [editableItems, selectedItems]);

  // Toggle trade group expansion
  const toggleTradeExpansion = useCallback((trade: string) => {
    setExpandedTrades(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trade)) {
        newSet.delete(trade);
      } else {
        newSet.add(trade);
      }
      return newSet;
    });
  }, []);

  // Expand/collapse all trades
  const expandAllTrades = useCallback(() => {
    setExpandedTrades(new Set(TRADE_OPTIONS));
  }, []);

  const collapseAllTrades = useCallback(() => {
    setExpandedTrades(new Set());
  }, []);

  // Load saved projects list
  useEffect(() => {
    setSavedProjects(getProjectList());
  }, []);

  // Handle room created from measurement tool
  const handleRoomCreated = useCallback((room: MeasuredRoom) => {
    // Generate line items for the room
    const newLineItems = generateLineItemsFromRoom(room, editableItems, project.settings);

    if (newLineItems.length > 0) {
      // Add new items to the editable items list
      setEditableItems(prev => [...prev, ...newLineItems.map(item => ({ ...item, isEdited: false }))]);

      // Auto-select new items
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        newLineItems.forEach(item => newSet.add(item.id));
        return newSet;
      });

      // Update room with generated item IDs
      room.generatedLineItems = newLineItems.map(item => item.id);
    }

    // Update measured rooms
    setMeasuredRooms(prev => [...prev, room]);
  }, [editableItems, project.settings]);

  // Handle calibration change
  const handleCalibrationChanged = useCallback((newCalibration: ScaleCalibration | null) => {
    setCalibration(newCalibration);
  }, []);

  // Handle measurements change
  const handleMeasurementsChanged = useCallback((lines: MeasuredLine[], rooms: MeasuredRoom[]) => {
    setMeasuredLines(lines);
    setMeasuredRooms(rooms);
  }, []);

  // Save project
  const saveProject = useCallback(() => {
    const updatedProject: ProjectState = {
      ...project,
      name: projectName,
      calibration,
      measuredLines,
      measuredRooms,
      lineItems: editableItems,
      updatedAt: new Date(),
    };
    saveProjectToStorage(updatedProject);
    setProject(updatedProject);
    setLastSaved(new Date());
    setSavedProjects(getProjectList());
    setShowSaveDialog(false);
  }, [project, projectName, calibration, measuredLines, measuredRooms, editableItems]);

  // Load project
  const loadProject = useCallback((projectId: string) => {
    const loaded = loadProjectFromStorage(projectId);
    if (loaded) {
      setProject(loaded);
      setProjectName(loaded.name);
      setCalibration(loaded.calibration);
      setMeasuredLines(loaded.measuredLines);
      setMeasuredRooms(loaded.measuredRooms);
      setEditableItems(loaded.lineItems.map(item => ({ ...item, isEdited: false })));
      setSelectedItems(new Set(loaded.lineItems.map(item => item.id)));
      setLastSaved(loaded.updatedAt);
    }
    setShowLoadDialog(false);
  }, []);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    const selected = editableItems.filter(item => selectedItems.has(item.id));
    exportEstimateToCSV(selected, projectName);
  }, [editableItems, selectedItems, projectName]);

  // Export project JSON
  const handleExportProject = useCallback(() => {
    const projectToExport: ProjectState = {
      ...project,
      name: projectName,
      calibration,
      measuredLines,
      measuredRooms,
      lineItems: editableItems,
    };
    exportProjectToFile(projectToExport);
  }, [project, projectName, calibration, measuredLines, measuredRooms, editableItems]);

  // Detect scope gaps when items change
  useEffect(() => {
    const gaps = detectScopeGaps(analysis, editableItems);
    setScopeGaps(gaps);
  }, [analysis, editableItems]);

  const gapSummary = useMemo(() => getGapSummary(scopeGaps), [scopeGaps]);

  const confidenceLevel = useMemo(() => getAnalysisConfidenceLevel(analysis), [analysis]);

  // Calculate totals based on editable items with overheads and margin
  const totals = useMemo(() => {
    const selected = editableItems.filter(item => selectedItems.has(item.id));
    const baseTotals = calculateEstimateTotals(selected);

    // Calculate overheads and margin
    const siteOverheadAmount = Math.round(baseTotals.subtotal * (siteOverheads / 100));
    const companyOverheadAmount = Math.round(baseTotals.subtotal * (companyOverheads / 100));
    const contingencyAmount = Math.round(baseTotals.subtotal * (contingency / 100));
    const subtotalWithOverheads = baseTotals.subtotal + siteOverheadAmount + companyOverheadAmount + contingencyAmount;
    const marginAmount = Math.round(subtotalWithOverheads * (margin / 100));
    const finalSubtotal = subtotalWithOverheads + marginAmount;
    const gstAmount = Math.round(finalSubtotal * 0.10);
    const finalTotal = finalSubtotal + gstAmount;

    return {
      ...baseTotals,
      siteOverheads: siteOverheadAmount,
      companyOverheads: companyOverheadAmount,
      contingency: contingencyAmount,
      margin: marginAmount,
      subtotalWithOverheads: finalSubtotal,
      gst: gstAmount,
      total: finalTotal,
    };
  }, [editableItems, selectedItems, siteOverheads, companyOverheads, contingency, margin]);

  const toggleItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    setSelectedItems(new Set(editableItems.map(item => item.id)));
  };

  const selectNone = () => {
    setSelectedItems(new Set());
  };

  // Update item quantity
  const updateItemQuantity = useCallback((id: string, newQuantity: number) => {
    setEditableItems(items =>
      items.map(item => {
        if (item.id === id) {
          const materialCost = (item.materialCost / item.quantity) * newQuantity;
          const labourCost = (item.labourCost / item.quantity) * newQuantity;
          return {
            ...item,
            quantity: newQuantity,
            materialCost,
            labourCost,
            totalCost: materialCost + labourCost,
            labourHours: (item.labourHours / item.quantity) * newQuantity,
            isEdited: true,
          };
        }
        return item;
      })
    );
  }, []);

  // Update item unit rate
  const updateItemRate = useCallback((id: string, newRate: number) => {
    setEditableItems(items =>
      items.map(item => {
        if (item.id === id) {
          const totalCost = newRate * item.quantity;
          // Assume 60% material, 40% labour split for edited rates
          const materialCost = totalCost * 0.6;
          const labourCost = totalCost * 0.4;
          return {
            ...item,
            unitRate: newRate,
            materialCost,
            labourCost,
            totalCost,
            isEdited: true,
          };
        }
        return item;
      })
    );
  }, []);

  // Update any field of an item
  const updateItemField = useCallback((id: string, field: keyof EditableLineItem, value: any) => {
    setEditableItems(items =>
      items.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value, isEdited: true };
          // Recalculate totals if qty or rate changed
          if (field === 'quantity' || field === 'unitRate') {
            const qty = field === 'quantity' ? value : item.quantity;
            const rate = field === 'unitRate' ? value : item.unitRate;
            updated.totalCost = qty * rate;
            updated.materialCost = updated.totalCost * 0.6;
            updated.labourCost = updated.totalCost * 0.4;
          }
          return updated;
        }
        return item;
      })
    );
  }, []);

  // Add a new manual item
  const addNewItem = useCallback(() => {
    const item = { ...newItem };
    item.totalCost = item.quantity * item.unitRate;
    item.materialCost = item.totalCost * 0.6;
    item.labourCost = item.totalCost * 0.4;

    setEditableItems(prev => [...prev, item]);
    setSelectedItems(prev => new Set([...prev, item.id]));
    setNewItem(createNewItem());
    setAddItemDialogOpen(false);
  }, [newItem]);

  // Delete an item
  const deleteItem = useCallback((id: string) => {
    setEditableItems(items => items.filter(item => item.id !== id));
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  // Duplicate an item
  const duplicateItem = useCallback((id: string) => {
    const original = editableItems.find(item => item.id === id);
    if (original) {
      const duplicate: EditableLineItem = {
        ...original,
        id: `COPY-${Date.now()}`,
        description: `${original.description} (copy)`,
        isEdited: true,
      };
      setEditableItems(prev => [...prev, duplicate]);
      setSelectedItems(prev => new Set([...prev, duplicate.id]));
    }
  }, [editableItems]);

  // Start editing a row
  const startEditingRow = useCallback((id: string) => {
    setEditingRowId(id);
  }, []);

  // Save row edit
  const saveRowEdit = useCallback(() => {
    setEditingRowId(null);
  }, []);

  // Cancel row edit
  const cancelRowEdit = useCallback(() => {
    setEditingRowId(null);
  }, []);

  // Helper function to render a single item row (used by both flat and grouped views)
  const renderItemRow = (item: EditableLineItem, showTrade: boolean = true) => {
    const isEditing = editingRowId === item.id;

    return (
      <TableRow
        key={item.id}
        className={`
          ${!selectedItems.has(item.id) ? 'opacity-50 bg-gray-50 dark:bg-gray-900' : ''}
          ${item.isEdited ? 'bg-yellow-50 dark:bg-yellow-950/30' : ''}
          ${isEditing ? 'bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500' : ''}
          hover:bg-muted/50
        `}
      >
        {/* Checkbox */}
        <TableCell className="py-2">
          <Checkbox
            checked={selectedItems.has(item.id)}
            onCheckedChange={() => toggleItem(item.id)}
          />
        </TableCell>

        {/* Trade - optionally hidden in grouped view */}
        {showTrade && (
          <TableCell className="py-2">
            {isEditing ? (
              <Select
                value={item.trade}
                onValueChange={(v) => updateItemField(item.id, 'trade', v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRADE_OPTIONS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-xs font-medium">{item.trade}</span>
            )}
          </TableCell>
        )}

        {/* Description */}
        <TableCell className="py-2">
          {isEditing ? (
            <Input
              value={item.description}
              onChange={(e) => updateItemField(item.id, 'description', e.target.value)}
              className="h-8 text-sm"
              placeholder="Item description"
            />
          ) : (
            <div>
              <p className="text-sm font-medium">{item.description}</p>
              {item.isEdited && (
                <Badge variant="outline" className="text-[10px] text-yellow-600 mt-0.5">
                  Edited
                </Badge>
              )}
            </div>
          )}
        </TableCell>

        {/* Quantity */}
        <TableCell className="py-2 text-right">
          {isEditing ? (
            <Input
              type="number"
              value={item.quantity}
              onChange={(e) => updateItemField(item.id, 'quantity', parseFloat(e.target.value) || 0)}
              className="h-8 w-20 text-right text-sm font-mono"
            />
          ) : (
            <span className="font-mono text-sm">{(item.quantity ?? 0).toFixed(1)}</span>
          )}
        </TableCell>

        {/* Unit */}
        <TableCell className="py-2 text-center">
          {isEditing ? (
            <Select
              value={item.unit}
              onValueChange={(v) => updateItemField(item.id, 'unit', v)}
            >
              <SelectTrigger className="h-8 text-xs w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-muted-foreground">{item.unit}</span>
          )}
        </TableCell>

        {/* Rate */}
        <TableCell className="py-2 text-right">
          {isEditing ? (
            <Input
              type="number"
              value={item.unitRate}
              onChange={(e) => updateItemField(item.id, 'unitRate', parseFloat(e.target.value) || 0)}
              className="h-8 w-24 text-right text-sm font-mono"
            />
          ) : (
            <span className="font-mono text-sm">${(item.unitRate ?? 0).toFixed(2)}</span>
          )}
        </TableCell>

        {/* Total */}
        <TableCell className="py-2 text-right">
          <span className="font-mono text-sm font-semibold">
            ${item.totalCost.toLocaleString()}
          </span>
        </TableCell>

        {/* Source with Page Link */}
        <TableCell className="py-2 text-center">
          <div className="flex flex-col items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={
                    item.source === 'schedule' ? 'default' :
                    item.source === 'detected' ? 'secondary' : 'outline'
                  }
                  className="text-[10px] cursor-help"
                >
                  {item.source}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-sm">
                <div className="text-xs space-y-2">
                  <p className="font-medium">{SOURCE_EXPLANATIONS[item.source]}</p>
                  {item.primarySource && (
                    <>
                      <div className="border-t pt-2">
                        <p className="text-muted-foreground">Detection Method:</p>
                        <p>{item.primarySource.detectionMethod.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Reason:</p>
                        <p>{item.primarySource.detectionReason}</p>
                      </div>
                      {item.primarySource.drawingTitle && (
                        <div>
                          <p className="text-muted-foreground">Drawing:</p>
                          <p>{item.primarySource.drawingTitle}</p>
                        </div>
                      )}
                    </>
                  )}
                  {!item.primarySource && (
                    <p className="text-muted-foreground italic">
                      {item.source === 'inferred'
                        ? 'Estimated based on typical construction requirements'
                        : 'Source details not available'}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
            {/* Page Link */}
            {item.primarySource && (
              <button
                className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline"
                onClick={() => {
                  navigateViewer(item.primarySource!.pageNumber);
                  setHighlightedItemId(item.id);
                }}
                title={`Go to page ${item.primarySource.pageNumber}`}
              >
                P{item.primarySource.pageNumber}
              </button>
            )}
          </div>
        </TableCell>

        {/* Actions */}
        <TableCell className="py-2">
          <div className="flex items-center justify-center gap-1">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                  onClick={saveRowEdit}
                  title="Save changes"
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700"
                  onClick={cancelRowEdit}
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                  onClick={() => startEditingRow(item.id)}
                  title="Edit item"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700"
                  onClick={() => duplicateItem(item.id)}
                  title="Duplicate item"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <CalculationBreakdownDialog
                  item={item}
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 w-7 p-0 ${
                        item.materialLookup && !item.materialLookup.found
                          ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-100'
                          : 'text-purple-500 hover:text-purple-700 hover:bg-purple-100'
                      }`}
                      title="View calculation breakdown"
                    >
                      <Calculator className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                  onClick={() => deleteItem(item.id)}
                  title="Delete item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const handleAccept = () => {
    const selected = editableItems.filter(item => selectedItems.has(item.id));
    onAcceptEstimate(selected);
  };

  const handleExport = () => {
    const exportData = {
      ...analysis,
      estimatedItems: editableItems,
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-${analysis.fileName.replace(/\.[^.]+$/, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Add items from scope gaps to the estimate
  const handleAddGapItems = useCallback((items: EstimatedLineItem[]) => {
    const newItems: EditableLineItem[] = items.map(item => ({
      ...item,
      isEdited: false,
    }));

    setEditableItems(prev => [...prev, ...newItems]);

    // Add new items to selected
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      newItems.forEach(item => newSet.add(item.id));
      return newSet;
    });
  }, []);

  // Acknowledge a gap (added, not_required, or included_elsewhere)
  const handleAcknowledgeGap = useCallback((
    gapId: string,
    acknowledgedAs: ScopeGap['acknowledgedAs'],
    note?: string
  ) => {
    setScopeGaps(gaps =>
      gaps.map(g =>
        g.id === gapId
          ? { ...g, isAcknowledged: true, acknowledgedAs, acknowledgedNote: note }
          : g
      )
    );
  }, []);

  // Group estimated items by trade
  const itemsByTrade = useMemo(() => {
    const groups: Record<string, EditableLineItem[]> = {};
    for (const item of editableItems) {
      if (!groups[item.trade]) groups[item.trade] = [];
      groups[item.trade].push(item);
    }
    return groups;
  }, [editableItems]);

  // Group pages by drawing type
  const pagesByType = useMemo(() => {
    const groups: Record<string, PageAnalysis[]> = {};
    for (const page of analysis.pages) {
      if (!groups[page.drawingType]) groups[page.drawingType] = [];
      groups[page.drawingType].push(page);
    }
    return groups;
  }, [analysis.pages]);

  // Count detected items for explanation
  const detectionSummary = useMemo(() => {
    const symbols = analysis.pages.flatMap(p => p.symbols);
    const doors = symbols.filter(s => s.type === 'door').length;
    const windows = symbols.filter(s => s.type === 'window').length;
    const powerPoints = symbols.filter(s => s.type === 'power_point').length;
    const lights = symbols.filter(s => s.type === 'light').length;
    const toilets = symbols.filter(s => s.type === 'toilet').length;
    const sinks = symbols.filter(s => s.type === 'sink').length;
    const showers = symbols.filter(s => s.type === 'shower').length;
    const rooms = new Set(analysis.pages.flatMap(p => p.rooms.map(r => r.name))).size;
    const wetRooms = analysis.pages.flatMap(p => p.rooms)
      .filter(r => /bathroom|ensuite|laundry|toilet|wc/i.test(r.name)).length;

    return {
      doors,
      windows,
      powerPoints,
      lights,
      toilets,
      sinks,
      showers,
      rooms,
      wetRooms,
      scheduleDoors: analysis.schedules.doors.reduce((sum, d) => sum + d.quantity, 0),
      scheduleWindows: analysis.schedules.windows.reduce((sum, w) => sum + w.quantity, 0),
    };
  }, [analysis]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Plan Analysis</h2>
          <p className="text-muted-foreground">
            {analysis.fileName} - {analysis.totalPages} page{analysis.totalPages !== 1 ? 's' : ''} analyzed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`${CONFIDENCE_COLORS[confidenceLevel]} text-white border-0`}
          >
            {confidenceLevel.charAt(0).toUpperCase() + confidenceLevel.slice(1)} Confidence
          </Badge>
          {onReanalyze && (
            <Button variant="outline" size="sm" onClick={onReanalyze} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Reanalyze
            </Button>
          )}

          {/* Save/Load Project */}
          <div className="flex items-center gap-1 border rounded-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSaveDialog(true)}
              title="Save project"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSavedProjects(getProjectList());
                setShowLoadDialog(true);
              }}
              title="Load project"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>

          {/* Export Dropdown */}
          <div className="flex items-center gap-1 border rounded-md">
            <Button variant="ghost" size="sm" onClick={handleExportCSV} title="Export to CSV">
              <FileDown className="h-4 w-4" />
              <span className="ml-1 text-xs">CSV</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExportProject} title="Export project">
              <Download className="h-4 w-4" />
              <span className="ml-1 text-xs">JSON</span>
            </Button>
          </div>

          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Confidence Warning */}
      {confidenceLevel === 'low' && (
        <Card className="p-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">Low Confidence Analysis</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                The PDF may not contain enough text data for accurate analysis. Consider uploading
                architectural plans with schedules, dimensions, and annotations for better results.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="detected">
            <Eye className="h-4 w-4 mr-1" />
            What Was Found
          </TabsTrigger>
          <TabsTrigger value="drawings">Drawings</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="gaps" className="relative">
            <Shield className="h-4 w-4 mr-1" />
            Scope Gaps
            {gapSummary.critical > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                {gapSummary.critical}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="estimate">
            <Calculator className="h-4 w-4 mr-1" />
            Estimate
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Project Type */}
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Home className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Project Type</p>
                  <p className="font-semibold">{analysis.summary.projectType}</p>
                </div>
              </div>
            </Card>

            {/* Construction Type */}
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Construction</p>
                  <p className="font-semibold">
                    {CONSTRUCTION_TYPE_LABELS[analysis.summary.constructionType]}
                  </p>
                </div>
              </div>
            </Card>

            {/* Total Rooms */}
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Grid3X3 className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rooms Detected</p>
                  <p className="font-semibold">{analysis.summary.totalRooms}</p>
                </div>
              </div>
            </Card>

            {/* Doors & Windows */}
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <DoorOpen className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Doors / Windows</p>
                  <p className="font-semibold">
                    {analysis.summary.totalDoors} / {analysis.summary.totalWindows}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Estimate Summary */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Estimate Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Materials</p>
                <p className="text-xl font-bold">${totals.totalMaterials.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Labour</p>
                <p className="text-xl font-bold">${totals.totalLabour.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">GST (10%)</p>
                <p className="text-xl font-bold">${totals.gst.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-primary">${totals.total.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* What Was Found Tab - NEW */}
        <TabsContent value="detected" className="space-y-4">
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Detection Summary - What the AI Found
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              This shows exactly what was detected in your PDF and how quantities were determined.
              Review this to verify the analysis is correct before accepting the estimate.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Construction Type Detection */}
              <Card
                className="p-4 border-2 cursor-pointer hover:border-primary/60 hover:bg-muted/20 transition-all group"
                onClick={() => jumpToDrawing(null, 'floor_plan')}
              >
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Construction Type
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Detected:</span>
                    <Badge variant="secondary">
                      {CONSTRUCTION_TYPE_LABELS[analysis.summary.constructionType]}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                    <strong>How detected:</strong> Text patterns like "timber frame", "stud wall",
                    "brick veneer" or construction notes in the drawings.
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-dashed flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-3 w-3" /> View in drawings
                </div>
              </Card>

              {/* Room Detection */}
              <Card
                className="p-4 border-2 cursor-pointer hover:border-primary/60 hover:bg-muted/20 transition-all group"
                onClick={() => jumpToDrawing(null, 'floor_plan')}
              >
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4 text-primary" />
                  Rooms Detected
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total rooms:</span>
                    <span className="font-mono font-semibold">{detectionSummary.rooms}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wet areas:</span>
                    <span className="font-mono">{detectionSummary.wetRooms}</span>
                  </div>
                  {/* Compact room name list */}
                  {analysis.pages.flatMap(p => p.rooms).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Array.from(new Set(analysis.pages.flatMap(p => p.rooms.map(r => r.name))))
                        .slice(0, 12)
                        .map((name, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] py-0">{name}</Badge>
                        ))}
                      {new Set(analysis.pages.flatMap(p => p.rooms.map(r => r.name))).size > 12 && (
                        <Badge variant="outline" className="text-[10px] py-0">
                          +{new Set(analysis.pages.flatMap(p => p.rooms.map(r => r.name))).size - 12} more
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                    <strong>Used for:</strong> Waterproofing, tiling, and plumbing estimates
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-dashed flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-3 w-3" /> View floor plan
                </div>
              </Card>

              {/* Doors */}
              <Card
                className="p-4 border-2 cursor-pointer hover:border-primary/60 hover:bg-muted/20 transition-all group"
                onClick={() => jumpToDrawing('door')}
              >
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-primary" />
                  Doors
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">From schedule:</span>
                    <span className="font-mono">{detectionSummary.scheduleDoors}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">From symbols (D01, D02...):</span>
                    <span className="font-mono font-semibold">{detectionSummary.doors}</span>
                  </div>
                  {/* Symbol labels found */}
                  {analysis.pages.flatMap(p => p.symbols.filter(s => s.type === 'door')).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Array.from(new Set(
                        analysis.pages.flatMap(p => p.symbols.filter(s => s.type === 'door').map(s => s.label))
                      )).slice(0, 10).map((label, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] py-0 font-mono">{label}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                    <strong>Source priority:</strong> Schedule data is used if found, otherwise symbol count
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-dashed flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-3 w-3" /> View on plan — page {
                    analysis.pages
                      .map(p => ({ pageNumber: p.pageNumber, count: p.symbols.filter(s => s.type === 'door').length }))
                      .reduce((a, b) => b.count > a.count ? b : a, { pageNumber: 1, count: 0 }).pageNumber
                  }
                </div>
              </Card>

              {/* Windows */}
              <Card
                className="p-4 border-2 cursor-pointer hover:border-primary/60 hover:bg-muted/20 transition-all group"
                onClick={() => jumpToDrawing('window')}
              >
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Square className="h-4 w-4 text-primary" />
                  Windows
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">From schedule:</span>
                    <span className="font-mono">{detectionSummary.scheduleWindows}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">From symbols (W01, W02...):</span>
                    <span className="font-mono font-semibold">{detectionSummary.windows}</span>
                  </div>
                  {analysis.pages.flatMap(p => p.symbols.filter(s => s.type === 'window')).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Array.from(new Set(
                        analysis.pages.flatMap(p => p.symbols.filter(s => s.type === 'window').map(s => s.label))
                      )).slice(0, 10).map((label, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] py-0 font-mono">{label}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                    <strong>Source priority:</strong> Schedule data is used if found, otherwise symbol count
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-dashed flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-3 w-3" /> View on plan — page {
                    analysis.pages
                      .map(p => ({ pageNumber: p.pageNumber, count: p.symbols.filter(s => s.type === 'window').length }))
                      .reduce((a, b) => b.count > a.count ? b : a, { pageNumber: 1, count: 0 }).pageNumber
                  }
                </div>
              </Card>

              {/* Electrical */}
              <Card
                className="p-4 border-2 cursor-pointer hover:border-primary/60 hover:bg-muted/20 transition-all group"
                onClick={() => jumpToDrawing('power_point')}
              >
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Electrical
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Power points (GPO):</span>
                    <span className="font-mono">{detectionSummary.powerPoints || 'Estimated 25'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Light points:</span>
                    <span className="font-mono">{detectionSummary.lights || 'Estimated 20'}</span>
                  </div>
                  {analysis.electricalSummary && Object.keys(analysis.electricalSummary).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Object.entries(analysis.electricalSummary).slice(0, 8).map(([key, count]) => (
                        <Badge key={key} variant="secondary" className="text-[10px] py-0">
                          {key}: {count}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                    <strong>Note:</strong> If not detected, typical residential quantities are estimated
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-dashed flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-3 w-3" /> View electrical plan
                </div>
              </Card>

              {/* Plumbing */}
              <Card
                className="p-4 border-2 cursor-pointer hover:border-primary/60 hover:bg-muted/20 transition-all group"
                onClick={() => jumpToDrawing('toilet')}
              >
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-primary" />
                  Plumbing Fixtures
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Toilets (WC):</span>
                    <span className="font-mono">{detectionSummary.toilets}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Basins:</span>
                    <span className="font-mono">{detectionSummary.sinks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Showers:</span>
                    <span className="font-mono">{detectionSummary.showers}</span>
                  </div>
                  <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                    <strong>Used for:</strong> Bathroom & kitchen plumbing estimates
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-dashed flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-3 w-3" /> View on plan — page {
                    analysis.pages
                      .map(p => ({ pageNumber: p.pageNumber, count: p.symbols.filter(s => ['toilet','sink','shower'].includes(s.type)).length }))
                      .reduce((a, b) => b.count > a.count ? b : a, { pageNumber: 1, count: 0 }).pageNumber
                  }
                </div>
              </Card>
            </div>

            {/* Calculation Methodology */}
            <Card className="p-4 mt-6 bg-blue-50 dark:bg-blue-950 border-blue-200">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                How Estimates Are Calculated
              </h4>
              <div className="text-sm space-y-2 text-blue-800 dark:text-blue-200">
                <p><strong>Material costs:</strong> Based on Rawlinsons Australian Construction Handbook 2024 rates</p>
                <p><strong>Labour costs:</strong> Hourly rate x productivity rate (hours per unit)</p>
                <p><strong>Quantities:</strong> Inferred = typical residential assumptions when not detected in PDF</p>
                <p><strong>Areas (m2):</strong> Default estimates used when not measurable from plans</p>
              </div>
            </Card>
          </Card>

          {/* Source Legend */}
          <Card className="p-4">
            <h4 className="font-medium mb-3">Understanding Source Types</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <Badge variant="default">schedule</Badge>
                <p className="text-sm text-muted-foreground">
                  Extracted from door/window/finish schedules in the PDF. Most reliable.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="secondary">detected</Badge>
                <p className="text-sm text-muted-foreground">
                  Found by recognizing symbols (D01, W01, GPO) in the drawings.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline">inferred</Badge>
                <p className="text-sm text-muted-foreground">
                  Estimated based on typical construction - verify and adjust as needed.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Drawings Tab - PDF Viewer with Source Traceability */}
        <TabsContent value="drawings" className="space-y-4">
          {pdfData ? (
            /* Full Width PDF Viewer with Page List Below */
            <div className="space-y-4">
              {/* PDF Viewer - Full Width */}
              <Card className="overflow-hidden">
                <PDFAnalysisViewer
                  pdfData={pdfData}
                  pages={analysis.pages}
                  analysisResult={analysis}
                  highlightedItemId={highlightedItemId}
                  targetPage={viewerPage}
                  targetPageVersion={viewerNavVersion}
                  onMarkupClick={(markup) => {
                    setHighlightedItemId(markup.linkedEstimateId || null);
                    if (markup.linkedEstimateId) {
                      setActiveTab('estimate');
                    }
                  }}
                  onRoomCreated={handleRoomCreated}
                  onCalibrationChanged={handleCalibrationChanged}
                  onMeasurementsChanged={handleMeasurementsChanged}
                  initialCalibration={calibration}
                  initialMeasuredLines={measuredLines}
                  initialMeasuredRooms={measuredRooms}
                />
              </Card>

              {/* Drawing List - Below PDF */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Analyzed Pages ({analysis.pages.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {analysis.pages.map((page, idx) => {
                    const isExpanded = expandedPageIdx === idx;
                    const symbolsByType = page.symbols.reduce((acc, s) => {
                      const key = s.type;
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(s);
                      return acc;
                    }, {} as Record<string, typeof page.symbols>);
                    const SYMBOL_TYPE_LABEL: Record<string, string> = {
                      door: 'Doors', window: 'Windows', power_point: 'Power Points',
                      light: 'Lights', switch: 'Switches', toilet: 'Toilets', sink: 'Basins',
                      shower: 'Showers', appliance: 'Appliances', site_element: 'Site Elements', other: 'Other',
                    };

                    // Per-page estimation detail
                    const pageDoors = page.symbols.filter(s => s.type === 'door');
                    const pageWindows = page.symbols.filter(s => s.type === 'window');
                    const pageText = page.textContent.join(' ');
                    const framingMatches = pageText.match(/\b(?:70|90|140|45)\s*mm\s*(?:wall\s*)?frames?/gi) || [];
                    const framingFound = [...new Set(framingMatches.map(m => m.trim().toUpperCase()))];
                    const insMatch = pageText.match(/R\d+\.\d+\s*(?:wall|ceiling)\s*batts?/gi) || [];
                    const insFound = [...new Set(insMatch.map(m => m.trim()))];
                    const specDetections: { label: string; tag?: string }[] = [
                      { label: 'Knotwood battens', tag: 'EXT' },
                      { label: 'Linea/Weatherboard', tag: 'EXT' },
                      { label: 'Render', tag: 'EXT' },
                      { label: 'Brick veneer', tag: 'EXT' },
                      { label: 'Louvre windows', tag: 'WIN' },
                      { label: 'Stacker door', tag: 'WIN' },
                      { label: 'Garage door', tag: 'WIN' },
                      { label: 'Plasterboard lining', tag: 'INT' },
                      { label: 'Eng. timber floor', tag: 'FLR' },
                      { label: 'Tiles', tag: 'FLR' },
                      { label: 'Carpet', tag: 'FLR' },
                      { label: 'Pool', tag: 'EXT' },
                      { label: 'Driveway', tag: 'SITE' },
                    ].filter(({ label }) => {
                      const kw = label.split('/')[0].toLowerCase().replace(/[^a-z]/g, '.?');
                      return new RegExp(kw, 'i').test(pageText);
                    });
                    const pageMats = (analysis.materialSelections || []).filter(m => m.pageIndex === page.pageIndex);

                    return (
                      <div
                        key={idx}
                        className={`border rounded-lg transition-all ${isExpanded ? 'border-primary/50 bg-muted/10 col-span-1 sm:col-span-2' : 'hover:border-primary/30 hover:bg-muted/30'}`}
                      >
                        {/* Card header */}
                        <div
                          className="p-3 cursor-pointer"
                          onClick={() => {
                            navigateViewer(page.pageNumber);
                            setExpandedPageIdx(isExpanded ? null : idx);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {DRAWING_TYPE_ICONS[page.drawingType]}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm line-clamp-1">
                                Page {page.pageNumber}: {DRAWING_TYPE_LABELS[page.drawingType]}
                              </p>
                              {page.drawingTitle && (
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-tight">{page.drawingTitle}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="outline" className="text-xs">
                                {Math.round(page.confidence * 100)}%
                              </Badge>
                              {isExpanded
                                ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              }
                            </div>
                          </div>

                          {/* Quick stats badges — clickable */}
                          <div className="mt-2 flex gap-1.5 flex-wrap">
                            {page.rooms.length > 0 && (
                              <Badge
                                variant={isExpanded ? 'default' : 'secondary'}
                                className="text-[10px] cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                onClick={(e) => { e.stopPropagation(); navigateViewer(page.pageNumber); setExpandedPageIdx(idx); }}
                              >
                                {page.rooms.length} rooms
                              </Badge>
                            )}
                            {page.symbols.length > 0 && (
                              <Badge
                                variant={isExpanded ? 'default' : 'secondary'}
                                className="text-[10px] cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                onClick={(e) => { e.stopPropagation(); navigateViewer(page.pageNumber); setExpandedPageIdx(idx); }}
                              >
                                {page.symbols.length} symbols
                              </Badge>
                            )}
                            {page.elements.length > 0 && (
                              <Badge
                                variant={isExpanded ? 'default' : 'secondary'}
                                className="text-[10px] cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                onClick={(e) => { e.stopPropagation(); navigateViewer(page.pageNumber); setExpandedPageIdx(idx); }}
                              >
                                {page.elements.length} elements
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Expanded detail panel — estimation-relevant per page */}
                        {isExpanded && (
                          <div className="border-t px-3 pb-3 pt-2 space-y-2.5 text-xs">

                            {/* Doors + Windows with schedule cross-reference */}
                            {(pageDoors.length > 0 || pageWindows.length > 0) && (
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                {pageDoors.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                      Doors ({pageDoors.length})
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {pageDoors.map((s, i) => {
                                        const ref = s.label || `D${i + 1}`;
                                        const sched = analysis.schedules.doors.find(
                                          d => d.reference === ref || d.reference === ref.replace(/^D0*/, 'D')
                                        );
                                        return (
                                          <Badge
                                            key={i}
                                            variant="outline"
                                            className="text-[10px] py-0 font-mono cursor-help"
                                            title={sched ? `${sched.description}${sched.size ? ' · ' + sched.size : ''}${sched.material ? ' · ' + sched.material : ''}` : ref}
                                          >
                                            {ref}
                                            {sched?.size && <span className="ml-1 opacity-60">{sched.size}</span>}
                                          </Badge>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {pageWindows.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                      Windows ({pageWindows.length})
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {pageWindows.map((s, i) => {
                                        const ref = s.label || `W${i + 1}`;
                                        const sched = analysis.schedules.windows.find(
                                          w => w.reference === ref || w.reference === ref.replace(/^W0*/, 'W')
                                        );
                                        return (
                                          <Badge
                                            key={i}
                                            variant="outline"
                                            className="text-[10px] py-0 font-mono text-blue-600 cursor-help"
                                            title={sched ? `${sched.description}${sched.size ? ' · ' + sched.size : ''}${sched.material ? ' · ' + sched.material : ''}` : ref}
                                          >
                                            {ref}
                                            {sched?.size && <span className="ml-1 opacity-60">{sched.size}</span>}
                                          </Badge>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Framing specs */}
                            {(framingFound.length > 0 || insFound.length > 0) && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                  Framing / Insulation
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {framingFound.slice(0, 4).map((f, i) => (
                                    <Badge key={i} variant="secondary" className="text-[10px] py-0 font-mono">{f}</Badge>
                                  ))}
                                  {insFound.slice(0, 3).map((r, i) => (
                                    <Badge key={`r-${i}`} variant="secondary" className="text-[10px] py-0 font-mono text-green-700">{r}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Material/spec keywords detected on this page */}
                            {specDetections.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                  Materials Detected
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {specDetections.map(({ label, tag }, i) => (
                                    <Badge
                                      key={i}
                                      variant="secondary"
                                      className={`text-[10px] py-0 ${tag === 'EXT' ? 'text-amber-700' : tag === 'FLR' ? 'text-purple-700' : tag === 'WIN' ? 'text-blue-700' : tag === 'SITE' ? 'text-orange-700' : ''}`}
                                    >
                                      {label}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Rooms with area */}
                            {page.rooms.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                  Rooms ({page.rooms.length})
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {page.rooms.map((room, i) => (
                                    <Badge key={i} variant="outline" className="text-[10px] py-0">
                                      {room.name}{room.area ? ` ${room.area}m²` : ''}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Per-page material notes (full text, no truncation) */}
                            {pageMats.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                  Notes ({pageMats.length})
                                </p>
                                <div className="space-y-1">
                                  {pageMats.slice(0, 6).map((m, i) => (
                                    <p key={i} className="text-[10px] text-muted-foreground leading-relaxed break-words">
                                      <span className="font-medium text-foreground/70">{m.category}:</span>{' '}
                                      {m.selection}
                                      {m.colour && <span className="ml-1 italic">({m.colour})</span>}
                                      {m.manufacturer && <span className="ml-1 text-blue-600">[{m.manufacturer}]</span>}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}

                            <button
                              className="text-xs text-primary hover:underline flex items-center gap-1 pt-1"
                              onClick={() => navigateViewer(page.pageNumber)}
                            >
                              <Eye className="h-3 w-3" /> View page {page.pageNumber} in PDF above
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          ) : (
            /* Fallback: Just Drawing List when no PDF data */
            <ScrollArea className="h-[500px]">
              <Accordion type="multiple" className="space-y-2">
                {analysis.pages.map((page, idx) => (
                  <AccordionItem key={idx} value={`page-${idx}`} className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-3">
                        {DRAWING_TYPE_ICONS[page.drawingType]}
                        <div className="text-left">
                          <p className="font-medium">
                            Page {page.pageNumber}: {DRAWING_TYPE_LABELS[page.drawingType]}
                          </p>
                          {page.drawingTitle && (
                            <p className="text-sm text-muted-foreground">{page.drawingTitle}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="ml-auto mr-4">
                          {Math.round(page.confidence * 100)}% confidence
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {page.drawingNumber && (
                          <div>
                            <p className="text-muted-foreground">Drawing No.</p>
                            <p className="font-medium">{page.drawingNumber}</p>
                          </div>
                        )}
                        {page.scale && (
                          <div>
                            <p className="text-muted-foreground">Scale</p>
                            <p className="font-medium">{page.scale}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground">Construction Type</p>
                          <p className="font-medium">
                            {CONSTRUCTION_TYPE_LABELS[page.constructionType]}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Elements Detected</p>
                          <p className="font-medium">{page.elements.length}</p>
                        </div>
                      </div>

                      {page.rooms.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm text-muted-foreground mb-2">Rooms</p>
                          <div className="flex flex-wrap gap-1">
                            {page.rooms.map((room, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {room.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {page.symbols.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm text-muted-foreground mb-2">
                            Symbols ({page.symbols.length})
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {page.symbols.slice(0, 20).map((symbol, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {symbol.label || symbol.type}
                              </Badge>
                            ))}
                            {page.symbols.length > 20 && (
                              <Badge variant="outline" className="text-xs">
                                +{page.symbols.length - 20} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Schedules Tab */}
        <TabsContent value="schedules" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Window Schedule */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Square className="h-4 w-4" />
                Window Schedule ({analysis.schedules.windows.length})
              </h3>
              {analysis.schedules.windows.length > 0 ? (
                <ScrollArea className="h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ref</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.schedules.windows.map((item, i) => (
                        <TableRow
                          key={i}
                          className="cursor-pointer hover:bg-primary/5"
                          onClick={() => { navigateViewer(item.pageIndex + 1); }}
                          title={`View page ${item.pageIndex + 1} in drawings`}
                        >
                          <TableCell className="font-mono">{item.reference}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.size || '-'}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">No window schedule detected</p>
              )}
            </Card>

            {/* Door Schedule */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <DoorOpen className="h-4 w-4" />
                Door Schedule ({analysis.schedules.doors.length})
              </h3>
              {analysis.schedules.doors.length > 0 ? (
                <ScrollArea className="h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ref</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.schedules.doors.map((item, i) => (
                        <TableRow
                          key={i}
                          className="cursor-pointer hover:bg-primary/5"
                          onClick={() => { navigateViewer(item.pageIndex + 1); }}
                          title={`View page ${item.pageIndex + 1} in drawings`}
                        >
                          <TableCell className="font-mono">{item.reference}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.size || '-'}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">No door schedule detected</p>
              )}
            </Card>

            {/* Finish Schedule */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Finish Schedule ({analysis.schedules.finishes.length})
              </h3>
              {analysis.schedules.finishes.length > 0 ? (
                <ScrollArea className="h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.schedules.finishes.map((item, i) => (
                        <TableRow
                          key={i}
                          className="cursor-pointer hover:bg-primary/5"
                          onClick={() => { navigateViewer(item.pageIndex + 1); }}
                          title={`View page ${item.pageIndex + 1} in drawings`}
                        >
                          <TableCell className="font-medium">{item.reference}</TableCell>
                          <TableCell>{item.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">No finish schedule detected</p>
              )}
            </Card>

            {/* Appliances */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <ShowerHead className="h-4 w-4" />
                Appliances & Fixtures
              </h3>
              {analysis.schedules.appliances.length > 0 ? (
                <ScrollArea className="h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.schedules.appliances.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{item.reference}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">No appliances detected</p>
              )}
            </Card>
          </div>

          {/* Materials & Selections — grouped by category */}
          {analysis.materialSelections && analysis.materialSelections.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Materials & Selections ({analysis.materialSelections.length})
                <span className="text-xs font-normal text-muted-foreground ml-1">— click any item to view in plan</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(
                  analysis.materialSelections.reduce((acc, m) => {
                    if (!acc[m.category]) acc[m.category] = [];
                    acc[m.category].push(m);
                    return acc;
                  }, {} as Record<string, typeof analysis.materialSelections>)
                ).map(([category, items]) => (
                  <div key={category} className="border rounded-lg p-3 bg-muted/30">
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wide">{category}</p>
                    <div className="space-y-1">
                      {items.map((item, i) => (
                        <button
                          key={i}
                          className="w-full flex items-start gap-2 text-left rounded px-1.5 py-1 hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-colors group cursor-pointer"
                          onClick={() => { navigateViewer(item.pageIndex + 1); }}
                          title={`View on page ${item.pageIndex + 1}`}
                        >
                          <div className="w-2 h-2 rounded-full bg-primary/60 mt-1.5 shrink-0 group-hover:bg-blue-500 transition-colors" />
                          <div className="text-sm leading-snug min-w-0 flex-1">
                            <span className="text-foreground">{item.selection}</span>
                            {item.colour && (
                              <span className="ml-1 text-xs text-muted-foreground italic">({item.colour})</span>
                            )}
                            {item.manufacturer && (
                              <span className="ml-1 text-xs text-blue-600 font-medium">{item.manufacturer}</span>
                            )}
                          </div>
                          <span className="shrink-0 text-[10px] text-blue-400 font-medium group-hover:text-blue-600 transition-colors ml-1 mt-0.5 whitespace-nowrap">
                            p.{item.pageIndex + 1}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Scope Gaps Tab */}
        <TabsContent value="gaps" className="space-y-4">
          <ScopeGapChecker
            gaps={scopeGaps}
            onAddItems={handleAddGapItems}
            onAcknowledge={handleAcknowledgeGap}
          />
        </TabsContent>

        {/* Estimate Tab - REDESIGNED WITH FULL EDITING */}
        <TabsContent value="estimate" className="space-y-4">
          {/* Toolbar */}
          <Card className="p-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setAddItemDialogOpen(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line Item
                </Button>
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={selectNone}>
                  Select None
                </Button>

                {/* View Mode Toggle */}
                <div className="flex items-center border rounded-md ml-2">
                  <Button
                    variant={viewMode === 'flat' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-r-none border-r"
                    onClick={() => setViewMode('flat')}
                    title="Flat view"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-l-none"
                    onClick={() => setViewMode('grouped')}
                    title="Grouped by trade"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>

                {/* Expand/Collapse All (only in grouped mode) */}
                {viewMode === 'grouped' && (
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={expandAllTrades}
                      title="Expand all"
                    >
                      <ChevronDown className="h-4 w-4" />
                      All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={collapseAllTrades}
                      title="Collapse all"
                    >
                      <ChevronRight className="h-4 w-4" />
                      All
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {selectedItems.size} of {editableItems.length} items
                </span>
                <Badge variant="outline" className="text-sm">
                  Total: ${totals.total.toLocaleString()}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Overheads and Margin Controls */}
          <Card className="p-4 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
            <h4 className="font-semibold mb-3 text-blue-900 dark:text-blue-100">Overheads & Margin</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Site Overheads %</label>
                <Input
                  type="number"
                  value={siteOverheads}
                  onChange={(e) => setSiteOverheads(parseFloat(e.target.value) || 0)}
                  className="h-8 w-24"
                  min="0"
                  max="30"
                  step="0.5"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Company Overheads %</label>
                <Input
                  type="number"
                  value={companyOverheads}
                  onChange={(e) => setCompanyOverheads(parseFloat(e.target.value) || 0)}
                  className="h-8 w-24"
                  min="0"
                  max="20"
                  step="0.5"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Contingency %</label>
                <Input
                  type="number"
                  value={contingency}
                  onChange={(e) => setContingency(parseFloat(e.target.value) || 0)}
                  className="h-8 w-24"
                  min="0"
                  max="20"
                  step="0.5"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Margin %</label>
                <Input
                  type="number"
                  value={margin}
                  onChange={(e) => setMargin(parseFloat(e.target.value) || 0)}
                  className="h-8 w-24"
                  min="0"
                  max="30"
                  step="0.5"
                />
              </div>
            </div>
          </Card>

          {/* Estimate Table - Flat or Grouped view */}
          {viewMode === 'flat' ? (
            /* Flat View */
            <Card className="overflow-hidden">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-32">Trade</TableHead>
                      <TableHead className="min-w-[200px]">Description</TableHead>
                      <TableHead className="w-20 text-right">Qty</TableHead>
                      <TableHead className="w-16 text-center">Unit</TableHead>
                      <TableHead className="w-24 text-right">Rate $</TableHead>
                      <TableHead className="w-28 text-right">Total</TableHead>
                      <TableHead className="w-20 text-center">Source</TableHead>
                      <TableHead className="w-28 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editableItems.map(item => renderItemRow(item, true))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          ) : (
            /* Grouped View */
            <Card className="overflow-hidden">
              <ScrollArea className="h-[600px]">
                <div className="divide-y">
                  {groupedItems.map(group => (
                    <div key={group.trade} className="border-b last:border-b-0">
                      {/* Trade Group Header */}
                      <button
                        className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                        onClick={() => toggleTradeExpansion(group.trade)}
                      >
                        <div className="flex items-center gap-3">
                          {expandedTrades.has(group.trade) ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span className="font-semibold text-sm">{group.trade}</span>
                          <Badge variant="secondary" className="text-xs">
                            {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                          </Badge>
                          {group.selectedCount < group.items.length && (
                            <Badge variant="outline" className="text-xs text-amber-600">
                              {group.selectedCount} selected
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-sm font-semibold text-green-700 dark:text-green-400">
                            ${group.subtotal.toLocaleString()}
                          </span>
                        </div>
                      </button>

                      {/* Trade Group Content */}
                      {expandedTrades.has(group.trade) && (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/20">
                              <TableHead className="w-10"></TableHead>
                              <TableHead className="min-w-[250px]">Description</TableHead>
                              <TableHead className="w-20 text-right">Qty</TableHead>
                              <TableHead className="w-16 text-center">Unit</TableHead>
                              <TableHead className="w-24 text-right">Rate $</TableHead>
                              <TableHead className="w-28 text-right">Total</TableHead>
                              <TableHead className="w-20 text-center">Source</TableHead>
                              <TableHead className="w-28 text-center">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.items.map(item => renderItemRow(item, false))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}

          {/* Totals Summary */}
          <Card className="p-4 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Materials</p>
                <p className="text-lg font-bold">${totals.totalMaterials.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Labour</p>
                <p className="text-lg font-bold">${totals.totalLabour.toLocaleString()}</p>
              </div>
              <div className="col-span-2 border-l pl-4">
                <p className="text-xs text-muted-foreground uppercase">Base Subtotal</p>
                <p className="text-lg font-bold">${totals.subtotal.toLocaleString()}</p>
              </div>
            </div>

            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Site Overheads ({siteOverheads}%)</span>
                <span className="font-mono">${totals.siteOverheads?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Company Overheads ({companyOverheads}%)</span>
                <span className="font-mono">${totals.companyOverheads?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contingency ({contingency}%)</span>
                <span className="font-mono">${totals.contingency?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between font-medium border-t pt-1 mt-2">
                <span>Subtotal with Overheads</span>
                <span className="font-mono">${(totals.subtotalWithOverheads - (totals.margin || 0)).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Margin ({margin}%)</span>
                <span className="font-mono">${totals.margin?.toLocaleString() || 0}</span>
              </div>
            </div>

            <div className="border-t mt-3 pt-3 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Net Total</p>
                <p className="text-xl font-bold">${totals.subtotalWithOverheads?.toLocaleString() || totals.subtotal.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">GST (10%)</p>
                <p className="text-xl font-bold">${totals.gst.toLocaleString()}</p>
              </div>
              <div className="bg-primary/10 -m-2 p-2 rounded-lg">
                <p className="text-xs text-primary uppercase font-medium">Total (inc GST)</p>
                <p className="text-2xl font-bold text-primary">${totals.total.toLocaleString()}</p>
              </div>
            </div>

            {/* Cost per m² indicator if floor area available */}
            {analysis.summary.totalFloorArea && analysis.summary.totalFloorArea > 0 && (
              <div className="mt-3 pt-3 border-t text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    Cost per m² ({analysis.summary.totalFloorArea.toFixed(0)}m² floor area)
                  </span>
                  <span className="font-mono font-bold text-blue-600">
                    ${Math.round(totals.total / analysis.summary.totalFloorArea).toLocaleString()}/m²
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Typical range: $1,900-$3,500/m² for residential construction in Australia
                </p>
              </div>
            )}
          </Card>

          {/* Accept Button */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export Analysis
            </Button>
            <Button
              onClick={handleAccept}
              disabled={selectedItems.size === 0}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Check className="h-4 w-4 mr-2" />
              Accept Estimate ({selectedItems.size} items)
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add New Item Dialog */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Line Item</DialogTitle>
            <DialogDescription>
              Manually add a new item to the estimate.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Trade</label>
                <Select
                  value={newItem.trade}
                  onValueChange={(v) => setNewItem({ ...newItem, trade: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADE_OPTIONS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <Input
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  placeholder="e.g., Structural, Fixtures"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Item description"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Quantity</label>
                <Input
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Unit</label>
                <Select
                  value={newItem.unit}
                  onValueChange={(v) => setNewItem({ ...newItem, unit: v as EstimatedLineItem['unit'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Rate $</label>
                <Input
                  type="number"
                  value={newItem.unitRate}
                  onChange={(e) => setNewItem({ ...newItem, unitRate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Line Total:</strong>{' '}
                <span className="font-mono">${(newItem.quantity * newItem.unitRate).toLocaleString()}</span>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={addNewItem}
              disabled={!newItem.description || newItem.quantity <= 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Project Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5 text-blue-600" />
              Save Project
            </DialogTitle>
            <DialogDescription>
              Save your project to continue later. Includes measurements, calibration, and estimates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Name</label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
              />
            </div>

            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              <p className="font-medium mb-2">Will be saved:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• {editableItems.length} line items (${totals.total.toLocaleString()} inc GST)</li>
                <li>• {measuredRooms.length} measured rooms</li>
                <li>• {measuredLines.length} distance measurements</li>
                {calibration && <li>• Scale calibration ({calibration.scale})</li>}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveProject} className="bg-blue-600 hover:bg-blue-700">
              <Save className="h-4 w-4 mr-2" />
              Save Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Project Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-green-600" />
              Load Project
            </DialogTitle>
            <DialogDescription>
              Load a previously saved project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {savedProjects.length > 0 ? (
              <div className="space-y-2">
                {savedProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => loadProject(proj.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{proj.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {proj.itemCount} items • ${proj.totalCost.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <History className="h-3 w-3 inline mr-1" />
                        {new Date(proj.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No saved projects found</p>
                <p className="text-sm">Save a project first to see it here</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AIPlanAnalyzer;
