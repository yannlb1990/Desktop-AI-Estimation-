import { PDFTakeoff } from "./takeoff/PDFTakeoff";

interface AIPlanAnalyzerEnhancedProps {
  projectId: string;
  estimateId?: string;
  onAddItems?: (items: any[]) => void;
}

export const AIPlanAnalyzerEnhanced = ({ projectId, estimateId, onAddItems }: AIPlanAnalyzerEnhancedProps) => {
  return (
    <PDFTakeoff 
      projectId={projectId} 
      estimateId={estimateId}
      onAddCostItems={onAddItems}
    />
  );
};
