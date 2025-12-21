// Project Template Selector Component
// Allows users to select and apply pre-built project templates

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Search,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
} from 'lucide-react';
import {
  PROJECT_TEMPLATES,
  ProjectTemplate,
  TemplateLineItem,
  getTemplatesByCategory,
  searchTemplates,
  calculateTemplateTotal,
} from '@/data/projectTemplates';

interface ProjectTemplateSelectorProps {
  onSelectTemplate: (template: ProjectTemplate, selectedItems: TemplateLineItem[]) => void;
  onCancel?: () => void;
}

export function ProjectTemplateSelector({
  onSelectTemplate,
  onCancel,
}: ProjectTemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let templates = PROJECT_TEMPLATES;

    if (categoryFilter !== 'all') {
      templates = getTemplatesByCategory(categoryFilter as any);
    }

    if (searchQuery) {
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subCategory.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return templates;
  }, [categoryFilter, searchQuery]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(PROJECT_TEMPLATES.map(t => t.category));
    return Array.from(cats);
  }, []);

  // Handle template selection
  const handleSelectTemplate = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    // Select all items by default
    setSelectedItems(new Set(template.lineItems.map(item => item.id)));
    setIsDialogOpen(true);
  };

  // Toggle item selection
  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  // Select/deselect all
  const toggleAll = () => {
    if (selectedTemplate) {
      if (selectedItems.size === selectedTemplate.lineItems.length) {
        setSelectedItems(new Set());
      } else {
        setSelectedItems(new Set(selectedTemplate.lineItems.map(item => item.id)));
      }
    }
  };

  // Calculate selected items total
  const selectedTotal = useMemo(() => {
    if (!selectedTemplate) return 0;
    return selectedTemplate.lineItems
      .filter(item => selectedItems.has(item.id))
      .reduce((sum, item) => sum + item.defaultQty * item.defaultRate, 0);
  }, [selectedTemplate, selectedItems]);

  // Apply template
  const handleApply = () => {
    if (selectedTemplate) {
      const items = selectedTemplate.lineItems.filter(item => selectedItems.has(item.id));
      onSelectTemplate(selectedTemplate, items);
      setIsDialogOpen(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      residential: 'bg-blue-100 text-blue-800',
      commercial: 'bg-purple-100 text-purple-800',
      renovation: 'bg-amber-100 text-amber-800',
      extension: 'bg-green-100 text-green-800',
      'new-build': 'bg-red-100 text-red-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(template => (
          <Card
            key={template.id}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => handleSelectTemplate(template)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <Badge className={getCategoryColor(template.category)}>
                  {template.category}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{template.subCategory}</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-3 line-clamp-2">{template.description}</p>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{template.typicalDuration}</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  <span>{template.lineItems.length} items</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-muted-foreground">Budget: </span>
                  <span className="font-medium">
                    {formatCurrency(template.typicalBudgetRange.min)} -{' '}
                    {formatCurrency(template.typicalBudgetRange.max)}
                  </span>
                </div>
                <Button size="sm" variant="ghost">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredTemplates.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No templates found matching your search.
          </div>
        )}
      </div>

      {/* Template Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedTemplate.name}</DialogTitle>
                <DialogDescription>{selectedTemplate.description}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-4 my-4">
                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">Duration</div>
                  <div className="font-medium">{selectedTemplate.typicalDuration}</div>
                </div>
                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">Budget Range</div>
                  <div className="font-medium">
                    {formatCurrency(selectedTemplate.typicalBudgetRange.min)} -{' '}
                    {formatCurrency(selectedTemplate.typicalBudgetRange.max)}
                  </div>
                </div>
                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">Selected Total</div>
                  <div className="font-medium text-primary">{formatCurrency(selectedTotal)}</div>
                </div>
              </div>

              {/* NCC Requirements */}
              {selectedTemplate.nccRequirements.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">NCC Requirements</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.nccRequirements.map((req, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                        {req}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Line Items Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Select Line Items</h4>
                  <Button variant="ghost" size="sm" onClick={toggleAll}>
                    {selectedItems.size === selectedTemplate.lineItems.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </Button>
                </div>

                <ScrollArea className="h-[300px] border rounded-lg">
                  <div className="divide-y">
                    {selectedTemplate.lineItems.map(item => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 ${
                          selectedItems.has(item.id) ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => toggleItem(item.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={() => toggleItem(item.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{item.trade}</span>
                            <span className="text-muted-foreground text-sm">-</span>
                            <span className="text-sm truncate">{item.sow}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.defaultQty} {item.unit} @ {formatCurrency(item.defaultRate)}
                          </div>
                        </div>
                        <div className="text-sm font-medium">
                          {formatCurrency(item.defaultQty * item.defaultRate)}
                        </div>
                        {item.isRequired && (
                          <Badge variant="destructive" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Common Variations */}
              {selectedTemplate.commonVariations.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Common Variations</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.commonVariations.map((variation, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {variation}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleApply} disabled={selectedItems.size === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add {selectedItems.size} Items to Estimate
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectTemplateSelector;
