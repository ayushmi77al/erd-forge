import { v4 as uuidv4 } from 'uuid';
import { Command } from '../Command';
import { ERDForgeProject, Table } from '../../models';

export class AddTableCommand implements Command {
  public readonly id: string;
  public readonly timestamp: number;
  public readonly description: string;
  
  constructor(private table: Table) {
    this.id = uuidv4();
    this.timestamp = Date.now();
    this.description = `Add table ${table.name}`;
  }

  execute(draft: ERDForgeProject): void {
    if (!draft.schema.tables) draft.schema.tables = [];
    draft.schema.tables.push(this.table);
  }

  undo(draft: ERDForgeProject): void {
    if (!draft.schema.tables) return;
    draft.schema.tables = draft.schema.tables.filter(t => t.id !== this.table.id);
  }
}
