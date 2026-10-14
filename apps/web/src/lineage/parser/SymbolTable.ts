export type ScopeType = 'global' | 'statement' | 'cte' | 'subquery';

export interface Scope {
  id: string;
  type: ScopeType;
  /** Map of alias/name (lowercase) to resolved node ID */
  tableAliases: Map<string, string>;
  /** Map of tableId to list of column names available in that table */
  tableColumns: Map<string, string[]>;
  parent?: Scope;
}

/**
 * Stack-based Symbol Table for tracking table aliases, visible scopes,
 * and resolving column references bottom-up through nested queries and CTEs.
 */
export class SymbolTable {
  private currentScope: Scope;
  private scopes: Scope[] = [];

  constructor() {
    this.currentScope = {
      id: 'global',
      type: 'global',
      tableAliases: new Map(),
      tableColumns: new Map(),
    };
    this.scopes.push(this.currentScope);
  }

  /**
   * Pushes a new nested query, CTE, or statement scope.
   */
  pushScope(id: string, type: ScopeType): Scope {
    const newScope: Scope = {
      id,
      type,
      tableAliases: new Map(),
      tableColumns: new Map(),
      parent: this.currentScope,
    };
    this.scopes.push(newScope);
    this.currentScope = newScope;
    return newScope;
  }

  /**
   * Pops the current scope back to its parent.
   */
  popScope(): Scope | undefined {
    if (this.scopes.length > 1) {
      const popped = this.scopes.pop();
      const nextCurrent = this.scopes[this.scopes.length - 1];
      if (nextCurrent) {
        this.currentScope = nextCurrent;
      }
      return popped;
    }
    return undefined;
  }

  /**
   * Registers a table or alias in the current scope.
   */
  registerTableAlias(aliasOrName: string, resolvedNodeId: string, columns: string[] = []): void {
    const key = aliasOrName.trim().toLowerCase();
    this.currentScope.tableAliases.set(key, resolvedNodeId);
    if (columns.length > 0) {
      this.currentScope.tableColumns.set(resolvedNodeId, columns);
    }
  }

  /**
   * Resolves a table name or alias bottom-up across scopes.
   */
  resolveTable(aliasOrName: string): string | undefined {
    const key = aliasOrName.trim().toLowerCase();
    let scope: Scope | undefined = this.currentScope;

    while (scope) {
      if (scope.tableAliases.has(key)) {
        return scope.tableAliases.get(key);
      }
      scope = scope.parent;
    }

    return undefined;
  }

  /**
   * Resolves a column to its source table ID.
   * If tablePrefix is provided, resolves directly to that table/alias.
   * Otherwise, searches current scope's registered tables.
   */
  resolveColumn(columnName: string, tablePrefix?: string): { tableId: string; column: string } | undefined {
    if (!columnName || typeof columnName !== 'string') return undefined;
    const colKey = columnName.trim().toLowerCase();

    if (tablePrefix) {
      const resolvedTableId = this.resolveTable(tablePrefix);
      if (resolvedTableId) {
        return { tableId: resolvedTableId, column: columnName };
      }
      return undefined;
    }

    // Unqualified column (e.g. `SELECT id FROM users` without prefix):
    // 1. First, search bottom-up for any table that explicitly registers this column name.
    // We skip 'statement' scope because it acts as a global CTE catalog, not a query block with a FROM clause.
    let scope: Scope | undefined = this.currentScope;
    while (scope) {
      if (scope.type !== 'statement') {
        for (const [tableId, cols] of scope.tableColumns.entries()) {
          if (cols.some((c) => c.toLowerCase() === colKey)) {
            return { tableId, column: columnName };
          }
        }
      }
      scope = scope.parent;
    }

    // 2. If column name is not explicitly known, and the CURRENT query scope has exactly one table alias,
    // attribute to that single table in the current scope (never leak into parent scopes).
    if (this.currentScope.tableAliases.size === 1) {
      const onlyTableId = Array.from(this.currentScope.tableAliases.values())[0];
      if (onlyTableId) {
        return { tableId: onlyTableId, column: columnName };
      }
    }

    return undefined;
  }

  /**
   * Returns all resolved table IDs in the current scope.
   */
  getCurrentScopeTableIds(): string[] {
    return Array.from(new Set(this.currentScope.tableAliases.values()));
  }
}
