export interface Relationship {
  id: string;
  sourceEntityId: string;
  sourceColumnId: string;
  targetEntityId: string;
  targetColumnId: string;
  cardinality: 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';
  
  // Metadata
  description?: string;
  joinLogic?: string;
  transformationNotes?: string;
  isEnforced: boolean;               // Physical FK or logical only
}
