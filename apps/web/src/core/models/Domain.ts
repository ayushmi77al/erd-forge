export interface Domain {
  id: string;
  name: string;
  color: string;                     // HSL color string
  description?: string;
  owner?: string;
  contactEmail?: string;
  team?: string;
  parentDomainId?: string;           // For nested domains
  ordinalPosition: number;
}
