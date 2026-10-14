import { describe, it, expect, beforeEach } from 'vitest';
import { CommandManager } from '@/core/commands/CommandManager';
import { AddTableCommand } from '@/core/commands/table/AddTableCommand';
import { ERDForgeProject, Table } from '@/core/models';
import { produce } from 'immer';

describe('CommandManager', () => {
  let manager: CommandManager;
  let project: ERDForgeProject;

  beforeEach(() => {
    manager = new CommandManager();
    project = {
      version: '1.0.0',
      id: 'proj-1',
      name: 'Test Project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schema: { tables: [], views: [], relationships: [] },
      domains: [],
      sheets: [],
      tags: [],
      glossary: [],
      comments: [],
      settings: { 
        defaultDialect: 'postgresql', 
        autoSaveInterval: 300, 
        maxUndoHistory: 1000, 
        canvasBackground: 'dots', 
        theme: 'system', 
        defaultNodeDisplayMode: 'full' 
      }
    };
  });

  it('should push a command and allow undo/redo', () => {
    const table: Table = {
      id: 't1',
      name: 'Users',
      columns: [],
      reviewStatus: 'draft',
      domainIds: [],
      tagIds: []
    };
    
    const cmd = new AddTableCommand(table);
    
    // Execute
    const nextState = produce(project, draft => {
      manager.push(cmd);
      cmd.execute(draft);
    });
    
    expect(nextState.schema.tables).toHaveLength(1);
    expect(manager.canUndo).toBe(true);
    expect(manager.canRedo).toBe(false);
    
    // Undo
    const undoCmd = manager.undo();
    expect(undoCmd).toBeDefined();
    
    const stateAfterUndo = produce(nextState, draft => {
      undoCmd!.undo(draft);
    });
    
    expect(stateAfterUndo.schema.tables).toHaveLength(0);
    expect(manager.canUndo).toBe(false);
    expect(manager.canRedo).toBe(true);
    
    // Redo
    const redoCmd = manager.redo();
    expect(redoCmd).toBeDefined();
    
    const stateAfterRedo = produce(stateAfterUndo, draft => {
      redoCmd!.execute(draft);
    });
    
    expect(stateAfterRedo.schema.tables).toHaveLength(1);
    expect(manager.canUndo).toBe(true);
    expect(manager.canRedo).toBe(false);
  });
});
