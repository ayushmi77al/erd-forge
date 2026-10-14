import { ERDForgeProject } from '../models';

export interface Command {
  id: string;
  timestamp: number;
  description: string;
  
  // Commands mutate the draft project state (Immer draft)
  execute(draft: ERDForgeProject): void;
  undo(draft: ERDForgeProject): void;
}
