import { v4 as uuidv4 } from 'uuid';
import { Command } from '../Command';
import { ERDForgeProject, Table } from '../../models';

export class RemoveTableCommand implements Command {
  public readonly id: string;
  public readonly timestamp: number;
  public readonly description: string;
  private tableIndex: number = -1;
  
  constructor(private table: Table) {
    this.id = uuidv4();
    this.timestamp = Date.now();
    this.description = `Remove table ${table.name}`;
  }

  execute(draft: ERDForgeProject): void {
    if (!draft.schema.tables) return;
    this.tableIndex = draft.schema.tables.findIndex(t => t.id === this.table.id);
    if (this.tableIndex !== -1) {
      draft.schema.tables.splice(this.tableIndex, 1);
    }
  }

  undo(draft: ERDForgeProject): void {
    if (!draft.schema.tables) draft.schema.tables = [];
    if (this.tableIndex !== -1) {
      draft.schema.tables.splice(this.tableIndex, 0, this.table);
    } else {
      draft.schema.tables.push(this.table);
    }
  }
}
