import { v4 as uuidv4 } from 'uuid';
import { Command } from '../Command';
import { ERDForgeProject, Column } from '../../models';

export class AddColumnCommand implements Command {
  public readonly id: string;
  public readonly timestamp: number;
  public readonly description: string;
  
  constructor(private tableId: string, private column: Column) {
    this.id = uuidv4();
    this.timestamp = Date.now();
    this.description = `Add column ${column.name}`;
  }

  execute(draft: ERDForgeProject): void {
    if (!draft.schema.tables) return;
    const table = draft.schema.tables.find(t => t.id === this.tableId);
    if (table) {
      if (!table.columns) table.columns = [];
      table.columns.push(this.column);
    }
  }

  undo(draft: ERDForgeProject): void {
    if (!draft.schema.tables) return;
    const table = draft.schema.tables.find(t => t.id === this.tableId);
    if (table && table.columns) {
      table.columns = table.columns.filter(c => c.id !== this.column.id);
    }
  }
}
