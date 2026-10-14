export type SDLNodeType = 
  | 'Program' 
  | 'Table' 
  | 'Column' 
  | 'View' 
  | 'ViewColumn' 
  | 'Domain' 
  | 'Ref' 
  | 'Group'
  | 'IndexBlock'
  | 'IndexDef'
  | 'Option';

export interface SDLNode {
  type: SDLNodeType;
  location?: {
    start: { offset: number; line: number; column: number };
    end: { offset: number; line: number; column: number };
  };
}

export interface SDLProgram extends SDLNode {
  type: 'Program';
  statements: SDLStatement[];
}

export type SDLStatement = SDLTable | SDLView | SDLDomain | SDLRef | SDLGroup;

export interface SDLTable extends SDLNode {
  type: 'Table';
  name: string;
  options: SDLOption[];
  columns: SDLColumn[];
  indexes: SDLIndexBlock | null;
  note: string | null;
}

export interface SDLView extends SDLNode {
  type: 'View';
  name: string;
  options: SDLOption[];
  columns: SDLViewColumn[];
  note: string | null;
}

export interface SDLDomain extends SDLNode {
  type: 'Domain';
  name: string;
  properties: SDLOption[];
}

export interface SDLRef extends SDLNode {
  type: 'Ref';
  name: string | null;
  sourceTable: string;
  sourceColumn: string;
  direction: '>' | '<' | '-' | '<>';
  targetTable: string;
  targetColumn: string;
  options: SDLOption[];
  note: string | null;
}

export interface SDLGroup extends SDLNode {
  type: 'Group';
  name: string;
  entities: string[];
}

export interface SDLColumn extends SDLNode {
  type: 'Column';
  name: string;
  dataType: string;
  options: SDLOption[];
  note: string | null;
}

export interface SDLViewColumn extends SDLNode {
  type: 'ViewColumn';
  name: string;
  dataType: string | null;
  note: string | null;
}

export interface SDLOption extends SDLNode {
  type: 'Option';
  key: string;
  value: any;
}

export interface SDLIndexBlock extends SDLNode {
  type: 'IndexBlock';
  indexes: SDLIndexDef[];
}

export interface SDLIndexDef extends SDLNode {
  type: 'IndexDef';
  columns: string[];
  options: SDLOption[];
}
