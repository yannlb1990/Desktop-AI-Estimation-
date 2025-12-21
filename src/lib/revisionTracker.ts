// Estimate Revision Tracker with Diff View
// Track changes between estimate versions and generate variation notices

export interface EstimateLineItem {
  id: string;
  trade: string;
  sow: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  total: number;
  category?: string;
  notes?: string;
}

export interface EstimateRevision {
  id: string;
  estimateId: string;
  revisionNumber: number;
  createdAt: Date;
  createdBy: string;
  reason?: string;
  lineItems: EstimateLineItem[];
  subtotal: number;
  gst: number;
  total: number;
  notes?: string;
  status: 'draft' | 'sent' | 'approved' | 'superseded';
}

export interface RevisionDiff {
  revisionA: number;
  revisionB: number;
  changes: LineItemChange[];
  summary: DiffSummary;
}

export interface LineItemChange {
  type: 'added' | 'removed' | 'modified';
  lineItemId: string;
  trade: string;
  sow: string;
  before?: EstimateLineItem;
  after?: EstimateLineItem;
  changes?: FieldChange[];
  valueDifference: number;
}

export interface FieldChange {
  field: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
  valueDifference?: number;
}

export interface DiffSummary {
  totalAdded: number;
  totalRemoved: number;
  totalModified: number;
  netValueChange: number;
  percentChange: number;
  addedItems: number;
  removedItems: number;
  modifiedItems: number;
}

export interface VariationNotice {
  id: string;
  estimateId: string;
  fromRevision: number;
  toRevision: number;
  clientName: string;
  projectAddress: string;
  generatedAt: Date;
  changes: LineItemChange[];
  summary: DiffSummary;
  notes?: string;
  signatureRequired: boolean;
  clientSignature?: string;
  clientSignedAt?: Date;
}

/**
 * Compare two estimate revisions and generate diff
 */
export function compareRevisions(
  revisionA: EstimateRevision,
  revisionB: EstimateRevision
): RevisionDiff {
  const changes: LineItemChange[] = [];

  const itemsA = new Map(revisionA.lineItems.map(item => [item.id, item]));
  const itemsB = new Map(revisionB.lineItems.map(item => [item.id, item]));

  // Find removed items (in A but not in B)
  revisionA.lineItems.forEach(itemA => {
    if (!itemsB.has(itemA.id)) {
      changes.push({
        type: 'removed',
        lineItemId: itemA.id,
        trade: itemA.trade,
        sow: itemA.sow,
        before: itemA,
        valueDifference: -itemA.total
      });
    }
  });

  // Find added items (in B but not in A)
  revisionB.lineItems.forEach(itemB => {
    if (!itemsA.has(itemB.id)) {
      changes.push({
        type: 'added',
        lineItemId: itemB.id,
        trade: itemB.trade,
        sow: itemB.sow,
        after: itemB,
        valueDifference: itemB.total
      });
    }
  });

  // Find modified items (in both but different)
  revisionB.lineItems.forEach(itemB => {
    const itemA = itemsA.get(itemB.id);
    if (itemA) {
      const fieldChanges = compareLineItems(itemA, itemB);
      if (fieldChanges.length > 0) {
        const valueDiff = itemB.total - itemA.total;
        changes.push({
          type: 'modified',
          lineItemId: itemB.id,
          trade: itemB.trade,
          sow: itemB.sow,
          before: itemA,
          after: itemB,
          changes: fieldChanges,
          valueDifference: valueDiff
        });
      }
    }
  });

  // Calculate summary
  const summary = calculateDiffSummary(changes, revisionA.total);

  return {
    revisionA: revisionA.revisionNumber,
    revisionB: revisionB.revisionNumber,
    changes,
    summary
  };
}

/**
 * Compare two line items and return field-level changes
 */
function compareLineItems(itemA: EstimateLineItem, itemB: EstimateLineItem): FieldChange[] {
  const changes: FieldChange[] = [];

  if (itemA.description !== itemB.description) {
    changes.push({
      field: 'description',
      fieldLabel: 'Description',
      oldValue: itemA.description,
      newValue: itemB.description
    });
  }

  if (itemA.quantity !== itemB.quantity) {
    changes.push({
      field: 'quantity',
      fieldLabel: 'Quantity',
      oldValue: itemA.quantity,
      newValue: itemB.quantity,
      valueDifference: itemB.quantity - itemA.quantity
    });
  }

  if (itemA.rate !== itemB.rate) {
    changes.push({
      field: 'rate',
      fieldLabel: 'Rate',
      oldValue: itemA.rate,
      newValue: itemB.rate,
      valueDifference: itemB.rate - itemA.rate
    });
  }

  if (itemA.unit !== itemB.unit) {
    changes.push({
      field: 'unit',
      fieldLabel: 'Unit',
      oldValue: itemA.unit,
      newValue: itemB.unit
    });
  }

  if (itemA.notes !== itemB.notes) {
    changes.push({
      field: 'notes',
      fieldLabel: 'Notes',
      oldValue: itemA.notes || '',
      newValue: itemB.notes || ''
    });
  }

  return changes;
}

/**
 * Calculate summary of all changes
 */
function calculateDiffSummary(changes: LineItemChange[], originalTotal: number): DiffSummary {
  let totalAdded = 0;
  let totalRemoved = 0;
  let totalModified = 0;
  let addedItems = 0;
  let removedItems = 0;
  let modifiedItems = 0;

  changes.forEach(change => {
    switch (change.type) {
      case 'added':
        addedItems++;
        totalAdded += change.valueDifference;
        break;
      case 'removed':
        removedItems++;
        totalRemoved += Math.abs(change.valueDifference);
        break;
      case 'modified':
        modifiedItems++;
        if (change.valueDifference > 0) {
          totalModified += change.valueDifference;
        } else {
          totalModified += change.valueDifference;
        }
        break;
    }
  });

  const netValueChange = totalAdded - totalRemoved + totalModified;
  const percentChange = originalTotal > 0
    ? (netValueChange / originalTotal) * 100
    : 0;

  return {
    totalAdded,
    totalRemoved,
    totalModified,
    netValueChange,
    percentChange,
    addedItems,
    removedItems,
    modifiedItems
  };
}

/**
 * Generate a variation notice document
 */
export function generateVariationNotice(
  diff: RevisionDiff,
  estimateId: string,
  clientName: string,
  projectAddress: string,
  notes?: string
): VariationNotice {
  return {
    id: `var-${Date.now()}`,
    estimateId,
    fromRevision: diff.revisionA,
    toRevision: diff.revisionB,
    clientName,
    projectAddress,
    generatedAt: new Date(),
    changes: diff.changes,
    summary: diff.summary,
    notes,
    signatureRequired: true
  };
}

/**
 * Format variation notice as text for display/print
 */
export function formatVariationNoticeText(notice: VariationNotice): string {
  let text = `
VARIATION NOTICE
================

Project: ${notice.projectAddress}
Client: ${notice.clientName}
Date: ${notice.generatedAt.toLocaleDateString('en-AU')}
Revision: ${notice.fromRevision} → ${notice.toRevision}

SUMMARY
-------
Items Added: ${notice.summary.addedItems} (+$${notice.summary.totalAdded.toFixed(2)})
Items Removed: ${notice.summary.removedItems} (-$${notice.summary.totalRemoved.toFixed(2)})
Items Modified: ${notice.summary.modifiedItems}
Net Change: ${notice.summary.netValueChange >= 0 ? '+' : ''}$${notice.summary.netValueChange.toFixed(2)} (${notice.summary.percentChange.toFixed(1)}%)

CHANGES
-------
`;

  // Added items
  const added = notice.changes.filter(c => c.type === 'added');
  if (added.length > 0) {
    text += '\nADDED:\n';
    added.forEach(change => {
      text += `  + ${change.trade} - ${change.sow}\n`;
      if (change.after) {
        text += `    ${change.after.quantity} ${change.after.unit} @ $${change.after.rate} = $${change.after.total.toFixed(2)}\n`;
      }
    });
  }

  // Removed items
  const removed = notice.changes.filter(c => c.type === 'removed');
  if (removed.length > 0) {
    text += '\nREMOVED:\n';
    removed.forEach(change => {
      text += `  - ${change.trade} - ${change.sow}\n`;
      if (change.before) {
        text += `    Was: ${change.before.quantity} ${change.before.unit} @ $${change.before.rate} = $${change.before.total.toFixed(2)}\n`;
      }
    });
  }

  // Modified items
  const modified = notice.changes.filter(c => c.type === 'modified');
  if (modified.length > 0) {
    text += '\nMODIFIED:\n';
    modified.forEach(change => {
      text += `  ~ ${change.trade} - ${change.sow}\n`;
      change.changes?.forEach(fieldChange => {
        text += `    ${fieldChange.fieldLabel}: ${fieldChange.oldValue} → ${fieldChange.newValue}`;
        if (fieldChange.valueDifference !== undefined) {
          text += ` (${fieldChange.valueDifference >= 0 ? '+' : ''}${fieldChange.valueDifference})`;
        }
        text += '\n';
      });
      text += `    Value change: ${change.valueDifference >= 0 ? '+' : ''}$${change.valueDifference.toFixed(2)}\n`;
    });
  }

  if (notice.notes) {
    text += `\nNOTES:\n${notice.notes}\n`;
  }

  text += `
---
By signing below, the client acknowledges and approves the above variations.

Client Signature: _________________________ Date: _____________
`;

  return text;
}

/**
 * Create a new revision from existing estimate with changes
 */
export function createRevision(
  baseRevision: EstimateRevision,
  changes: {
    addedItems?: EstimateLineItem[];
    removedItemIds?: string[];
    modifiedItems?: { id: string; updates: Partial<EstimateLineItem> }[];
  },
  createdBy: string,
  reason?: string
): EstimateRevision {
  // Start with existing items
  let newItems = [...baseRevision.lineItems];

  // Remove items
  if (changes.removedItemIds) {
    newItems = newItems.filter(item => !changes.removedItemIds!.includes(item.id));
  }

  // Modify items
  if (changes.modifiedItems) {
    changes.modifiedItems.forEach(mod => {
      const index = newItems.findIndex(item => item.id === mod.id);
      if (index !== -1) {
        const updated = { ...newItems[index], ...mod.updates };
        // Recalculate total
        updated.total = updated.quantity * updated.rate;
        newItems[index] = updated;
      }
    });
  }

  // Add new items
  if (changes.addedItems) {
    newItems = [...newItems, ...changes.addedItems];
  }

  // Calculate totals
  const subtotal = newItems.reduce((sum, item) => sum + item.total, 0);
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  return {
    id: `rev-${Date.now()}`,
    estimateId: baseRevision.estimateId,
    revisionNumber: baseRevision.revisionNumber + 1,
    createdAt: new Date(),
    createdBy,
    reason,
    lineItems: newItems,
    subtotal,
    gst,
    total,
    status: 'draft'
  };
}

/**
 * Get revision history for an estimate
 */
export function getRevisionHistory(
  revisions: EstimateRevision[]
): {
  revision: EstimateRevision;
  diff?: RevisionDiff;
}[] {
  const sorted = [...revisions].sort((a, b) => a.revisionNumber - b.revisionNumber);

  return sorted.map((revision, index) => {
    if (index === 0) {
      return { revision };
    }

    const previousRevision = sorted[index - 1];
    const diff = compareRevisions(previousRevision, revision);

    return { revision, diff };
  });
}

/**
 * Calculate cumulative changes across all revisions
 */
export function getCumulativeChanges(
  revisions: EstimateRevision[]
): {
  totalAdditions: number;
  totalDeductions: number;
  netChange: number;
  revisionCount: number;
} {
  if (revisions.length < 2) {
    return {
      totalAdditions: 0,
      totalDeductions: 0,
      netChange: 0,
      revisionCount: revisions.length
    };
  }

  const sorted = [...revisions].sort((a, b) => a.revisionNumber - b.revisionNumber);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const netChange = last.total - first.total;
  const totalAdditions = netChange > 0 ? netChange : 0;
  const totalDeductions = netChange < 0 ? Math.abs(netChange) : 0;

  return {
    totalAdditions,
    totalDeductions,
    netChange,
    revisionCount: revisions.length
  };
}
