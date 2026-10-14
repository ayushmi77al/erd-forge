

export interface ColumnRefMatch {
  table?: string;
  column: string;
  context: 'select' | 'where' | 'join' | 'group_by' | 'order_by';
  isDirect: boolean;
}

/**
 * Safely extracts a column name string from an AST column definition or reference,
 * handling dialect differences (e.g. postgresql object representations).
 */
export function extractColumnName(col: any): string {
  if (!col) return '';
  if (typeof col === 'string') return col;
  if (typeof col === 'object') {
    if (typeof col.value === 'string') return col.value;
    if (col.expr) return extractColumnName(col.expr);
    if (col.column) return extractColumnName(col.column);
    if (col.name) return extractColumnName(col.name);
  }
  return String(col);
}

/**
 * Extracts human-readable string representation from any SQL AST expression node.
 */
export function stringifyASTExpr(expr: any): string {
  if (!expr) return '';
  if (typeof expr === 'string') return expr;
  if (typeof expr === 'number') return String(expr);

  if (expr.type === 'column_ref') {
    const colStr = extractColumnName(expr.column);
    return expr.table ? `${expr.table}.${colStr}` : colStr;
  }

  if (expr.type === 'aggr_func' || expr.type === 'function') {
    const name = expr.name || 'FN';
    let args = '';
    if (expr.args) {
      if (Array.isArray(expr.args.expr)) {
        args = expr.args.expr.map((e: any) => stringifyASTExpr(e)).join(', ');
      } else if (expr.args.expr) {
        args = stringifyASTExpr(expr.args.expr);
      }
    }
    return `${name}(${args})`;
  }

  if (expr.type === 'binary_expr') {
    return `${stringifyASTExpr(expr.left)} ${expr.operator} ${stringifyASTExpr(expr.right)}`;
  }

  if (expr.type === 'case') {
    return 'CASE ... END';
  }

  if (expr.type === 'star') {
    return '*';
  }

  if (expr.column) return extractColumnName(expr.column);
  if (expr.value !== undefined) return String(expr.value);

  return 'expr';
}

/**
 * Recursively walks an AST expression and collects all column references
 * tagged with directness and SQL clause context.
 */
export function walkExpression(
  expr: any,
  context: 'select' | 'where' | 'join' | 'group_by' | 'order_by' = 'select',
  isDirect = true,
  matches: ColumnRefMatch[] = []
): ColumnRefMatch[] {
  if (!expr || typeof expr !== 'object') return matches;

  if (expr.type === 'column_ref' && expr.column) {
    const colName = extractColumnName(expr.column);
    if (colName && colName !== '*') {
      matches.push({
        table: expr.table || undefined,
        column: colName,
        context,
        isDirect,
      });
      return matches;
    }
  }

  // Aggregate function, window function, or scalar function arguments
  if (expr.args) {
    if (Array.isArray(expr.args)) {
      expr.args.forEach((a: any) => walkExpression(a, context, isDirect, matches));
    } else if (Array.isArray(expr.args.expr)) {
      expr.args.expr.forEach((a: any) => walkExpression(a, context, isDirect, matches));
    } else if (expr.args.expr) {
      walkExpression(expr.args.expr, context, isDirect, matches);
    }
  }

  // Window function (OVER clause)
  if (expr.over) {
    const spec = expr.over.as_window_specification?.window_specification || expr.over;

    if (Array.isArray(spec.partitionby)) {
      spec.partitionby.forEach((p: any) => {
        if (p.expr) walkExpression(p.expr, context, isDirect, matches);
        else walkExpression(p, context, isDirect, matches);
      });
    } else if (spec.partitionby) {
      walkExpression(spec.partitionby.expr || spec.partitionby, context, isDirect, matches);
    }
    
    if (Array.isArray(spec.orderby)) {
      spec.orderby.forEach((o: any) => {
        if (o.expr) walkExpression(o.expr, context, isDirect, matches);
        else walkExpression(o, context, isDirect, matches);
      });
    } else if (spec.orderby) {
      walkExpression(spec.orderby.expr || spec.orderby, context, isDirect, matches);
    }
  }

  // Binary expression left & right
  if (expr.left) walkExpression(expr.left, context, isDirect, matches);
  if (expr.right) walkExpression(expr.right, context, isDirect, matches);

  // CASE WHEN ... THEN ... ELSE ... END
  if (expr.cond) walkExpression(expr.cond, context, isDirect, matches);
  if (expr.result) walkExpression(expr.result, context, isDirect, matches);
  if (expr.then) walkExpression(expr.then, context, isDirect, matches);
  if (expr.else) walkExpression(expr.else, context, isDirect, matches);
  if (Array.isArray(expr.conds)) {
    expr.conds.forEach((c: any) => walkExpression(c, context, isDirect, matches));
  }

  // Cast expressions or nested expressions
  if (expr.expr) {
    walkExpression(expr.expr, context, isDirect, matches);
  }

  // Value lists (e.g. IN expressions)
  if (Array.isArray(expr.value)) {
    expr.value.forEach((v: any) => walkExpression(v, context, isDirect, matches));
  }

  return matches;
}

/**
 * Extracts all indirect column dependencies from WHERE, JOIN ON, GROUP BY, and ORDER BY clauses.
 */
export function extractClauseDependencies(stmt: any): ColumnRefMatch[] {
  const matches: ColumnRefMatch[] = [];

  // 1. WHERE clause
  if (stmt.where) {
    walkExpression(stmt.where, 'where', false, matches);
  }

  // 2. JOIN ON conditions
  if (Array.isArray(stmt.from)) {
    stmt.from.forEach((f: any) => {
      if (f.on) {
        walkExpression(f.on, 'join', false, matches);
      }
    });
  }

  // 3. GROUP BY
  if (Array.isArray(stmt.groupby)) {
    stmt.groupby.forEach((g: any) => {
      walkExpression(g, 'group_by', false, matches);
    });
  }

  // 4. ORDER BY
  if (Array.isArray(stmt.orderby)) {
    stmt.orderby.forEach((o: any) => {
      if (o.expr) {
        walkExpression(o.expr, 'order_by', false, matches);
      }
    });
  }

  // 5. HAVING
  if (stmt.having) {
    walkExpression(stmt.having, 'where', false, matches);
  }

  return matches;
}
