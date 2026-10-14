export interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
  category?: string;               // e.g., "governance", "technical", "business"
}
