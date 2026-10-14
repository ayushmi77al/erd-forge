export interface SheetEntityLayout {
  entityId: string;
  x: number;
  y: number;
  width?: number;
  collapsed: boolean;               // Show only table name
  displayMode: 'full' | 'compact' | 'name_only';
}

export interface Sheet {
  id: string;
  name: string;
  description?: string;
  scope?: string;                    // Markdown notes on scope
  stakeholderNotes?: string;
  ordinalPosition: number;
  
  // Entities included in this sheet
  entityLayouts: SheetEntityLayout[];
  
  // Display settings
  zoom: number;
  panX: number;
  panY: number;
}
