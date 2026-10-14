import { Column } from './Column';

export interface Table {
  id: string;
  name: string;
  schema?: string;                    // Database schema (e.g., "dbo", "public")
  columns: Column[];
  
  // Metadata
  description?: string;
  businessPurpose?: string;
  owner?: string;
  sourceSystem?: string;
  refreshLogic?: string;
  reviewStatus: 'draft' | 'review' | 'approved' | 'deprecated';
  
  // Governance
  domainIds: string[];
  tagIds: string[];
  
  // SDL source position (for editor sync)
  sdlLine?: number;
}

export interface View {
  id: string;
  name: string;
  schema?: string;
  columns: Column[];
  underlyingTables: string[];         // Table IDs
  sqlDefinition?: string;
  
  // Metadata (same as Table)
  description?: string;
  owner?: string;
  reviewStatus: 'draft' | 'review' | 'approved' | 'deprecated';
  domainIds: string[];
  tagIds: string[];
}
