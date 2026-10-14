import { describe, it, expect, beforeEach } from 'vitest';
import { AddColumnCommand } from '@/core/commands/column/AddColumnCommand';
import { ERDForgeProject, Table, Column } from '@/core/models';

describe('AddColumnCommand', () => {
  let draft: ERDForgeProject;
  let table: Table;
  let column: Column;

  beforeEach(() => {
    table = {
      id: 'table-1',
      name: 'Users',
      columns: [],
      domainIds: [],
      tagIds: [],
      reviewStatus: 'draft'
    };

    column = {
      id: 'col-1',
      name: 'id',
      dataType: { name: 'int' },
      ordinalPosition: 1,
      isPrimaryKey: true,
      isNullable: false,
      isUnique: true,
      piiClassification: 'none',
      tagIds: [],
      glossaryTermIds: []
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

  it('should add the column on execute', () => {
    const command = new AddColumnCommand('table-1', column);
    command.execute(draft);
    expect(draft.schema.tables[0]!.columns).toHaveLength(1);
    expect(draft.schema.tables[0]!.columns[0]!.id).toBe('col-1');
  });

  it('should remove the column on undo', () => {
    const command = new AddColumnCommand('table-1', column);
    command.execute(draft);
    command.undo(draft);
    expect(draft.schema.tables[0]!.columns).toHaveLength(0);
  });

  it('should do nothing if table does not exist', () => {
    const command = new AddColumnCommand('table-unknown', column);
    command.execute(draft);
    expect(draft.schema.tables[0]!.columns).toHaveLength(0);
  });
});
