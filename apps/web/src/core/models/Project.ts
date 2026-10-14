import { Table, View } from './Table';
import { Relationship } from './Relationship';
import { Domain } from './Domain';
import { Sheet } from './Sheet';
import { Tag } from './Tag';
import { GlossaryTerm } from './GlossaryTerm';
import { Comment } from './Comment';

export interface SchemaDefinition {
  tables: Table[];
  views: View[];
  relationships: Relationship[];
}

export interface ProjectSettings {
  defaultSchema?: string;          // Default DB schema name
  defaultDialect: 'postgresql' | 'mysql' | 'mssql' | 'oracle' | 'sqlite';
  autoSaveInterval: number;        // Seconds
  maxUndoHistory: number;          // Default 1000
  canvasBackground: 'dots' | 'lines' | 'none';
  theme: 'light' | 'dark' | 'system';
  defaultNodeDisplayMode: 'full' | 'compact';
  namingConvention?: {
    tables: 'snake_case' | 'PascalCase' | 'camelCase';
    columns: 'snake_case' | 'PascalCase' | 'camelCase';
  };
}

export interface ERDForgeProject {
  version: string;                    // "1.0.0"
  id: string;                         // UUID v4
  name: string;
  description?: string;
  createdAt: string;                  // ISO 8601
  updatedAt: string;
  
  schema: SchemaDefinition;
  domains: Domain[];
  sheets: Sheet[];
  tags: Tag[];
  glossary: GlossaryTerm[];
  comments: Comment[];
  settings: ProjectSettings;
}

