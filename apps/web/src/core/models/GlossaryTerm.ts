export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  examples?: string[];
  synonyms?: string[];
  domainId?: string;
  owner?: string;
  linkedColumnIds: string[];
  linkedEntityIds: string[];
  createdAt: string;
  updatedAt: string;
}
