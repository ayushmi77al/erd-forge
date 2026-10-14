export interface Comment {
  id: string;
  targetType: 'entity' | 'column' | 'relationship' | 'sheet' | 'domain';
  targetId: string;
  content: string;                 // Markdown
  author?: string;
  createdAt: string;
  updatedAt?: string;
  parentId?: string;               // For threaded replies
  resolved: boolean;
}
