export interface DataType {
  name: string;                       // varchar, int, decimal, etc.
  length?: number;                    // varchar(255) -> 255
  precision?: number;                 // decimal(18,2) -> 18
  scale?: number;                     // decimal(18,2) -> 2
  isArray?: boolean;
}

export interface Column {
  id: string;
  name: string;
  dataType: DataType;
  ordinalPosition: number;
  
  // Constraints
  isPrimaryKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue?: string;
  checkConstraint?: string;
  
  // Metadata
  description?: string;
  businessDefinition?: string;
  examples?: string[];
  calculationLogic?: string;
  dataQualityRules?: string[];
  piiClassification: 'none' | 'pii' | 'sensitive' | 'highly_sensitive';
  
  tagIds: string[];
  glossaryTermIds: string[];
}
