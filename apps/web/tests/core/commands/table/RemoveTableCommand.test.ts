import { describe, it, expect, beforeEach } from 'vitest';
import { RemoveTableCommand } from '@/core/commands/table/RemoveTableCommand';
import { ERDForgeProject, Table } from '@/core/models';

describe('RemoveTableCommand', () => {
  let draft: ERDForgeProject;
  let table: Table;

  beforeEach(() => {
    table = {
      id: 'table-1',
      name: 'Users',
      columns: [],
      domainIds: [],
      tagIds: [],
      reviewStatus: 'draft'
    };

    draft = {
      version: '1.0.0',
      id: 'proj-1',
      name: 'Test Project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schema: { tables: [table], views: [], relationships: [] },
      domains: [],
      sheets: [],
      tags: [],
      glossary: [],
      comments: [],
      settings: {
        defaultDialect: 'postgresql',
        autoSaveInterval: 60,
        maxUndoHistory: 100,
        canvasBackground: 'dots',
        theme: 'dark',
        defaultNodeDisplayMode: 'full'
      }
    };
  });

  it('should remove the table on execute', () => {
    const command = new RemoveTableCommand(table);
    command.execute(draft);
    expect(draft.schema.tables).toHaveLength(0);
  });

  it('should restore the table on undo', () => {
    const command = new RemoveTableCommand(table);
    command.execute(draft);
    command.undo(draft);
    expect(draft.schema.tables).toHaveLength(1);
    expect(draft.schema.tables[0]!.id).toBe('table-1');
  });

  it('should handle removing a non-existent table gracefully', () => {
    const fakeTable: Table = { ...table, id: 'table-unknown' };
    const command = new RemoveTableCommand(fakeTable);
    command.execute(draft);
    expect(draft.schema.tables).toHaveLength(1);
  });
});
