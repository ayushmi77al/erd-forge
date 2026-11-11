import { init as initWasm, parse as parseWasm, type Statement } from "@guanmingchiu/sqlparser-ts";
import type { SQLDialect } from "../types";
import {
  type ClauseContext,
  createEmptyNormalizedSelect,
  createEmptyNormalizedStatement,
  type JoinType,
  mapToWasmDialect,
  type NormalizedColumn,
  type NormalizedColumnRef,
  type NormalizedCTE,
  type NormalizedFromItem,
  type NormalizedParseError,
  type NormalizedParseResult,
  type NormalizedSelectStatement,
  type NormalizedStatement,
  type NormalizedTargetTable,
  type SetOperatorType,
  type SqlParserAdapter,
} from "./SqlParserAdapter";

/**
 * Robust extraction of string identifier values across sqlparser-rs serde variants.
 */
function extractIdentValue(item: any): string {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (typeof item.value === "string") return item.value;
  if (item.name) {
    if (typeof item.name === "string") return item.name;
    if (typeof item.name.value === "string") return item.name.value;
    if (item.name.Identifier && typeof item.name.Identifier.value === "string") {
      return item.name.Identifier.value;
    }
  }
  if (item.Identifier && typeof item.Identifier.value === "string") {
    return item.Identifier.value;
  }
  return "";
}

/**
 * Extracts an array of string identifiers from any identifier list/compound identifier shape.
 */
function extractIdents(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(extractIdentValue).filter(Boolean);
  }
  if (raw.ObjectName && Array.isArray(raw.ObjectName)) {
    return raw.ObjectName.map(extractIdentValue).filter(Boolean);
  }
  if (raw.TableName && Array.isArray(raw.TableName)) {
    return raw.TableName.map(extractIdentValue).filter(Boolean);
  }
  if (raw.Table && raw.Table.name) {
    return extractIdents(raw.Table.name);
  }
  if (typeof raw === "string") return [raw];
  const val = extractIdentValue(raw);
  return val ? [val] : [];
}

/**
 * Modern SQL Parser Adapter powered by Rust sqlparser-rs via WebAssembly (@guanmingchiu/sqlparser-ts).
 * Normalizes multi-dialect ASTs into standardized NormalizedStatement contracts.
 */
export class WasmSqlParserAdapter implements SqlParserAdapter {
  readonly id = "wasm-sqlparser-rs";
  readonly name = "WASM sqlparser-rs Adapter";
  readonly version = "0.63.0";

  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = initWasm();
    }
    return this.initPromise;
  }

  async parse(sql: string, dialect: SQLDialect): Promise<NormalizedParseResult> {
    await this.initialize();
    const trimmed = sql.trim();
    if (!trimmed) {
      return { statements: [], errors: [] };
    }

    const wasmDialect = mapToWasmDialect(dialect);

    try {
      const parsedStmts = parseWasm(trimmed, wasmDialect);
      const statements: NormalizedStatement[] = parsedStmts.map((s) => this.normalizeStatement(s));
      return { statements, errors: [] };
    } catch (err: any) {
      const error = this.formatError(err, wasmDialect);
      return { statements: [], errors: [error] };
    }
  }

  private formatError(err: any, dialect: string): NormalizedParseError {
    const message = err?.message || String(err) || "Syntax error parsing SQL statement";
    const line = typeof err?.location?.line === "number" ? err.location.line : 1;
    const column = typeof err?.location?.column === "number" ? err.location.column : 1;
    return { line, column, message, dialect };
  }

  // ---------------------------------------------------------------------------
  // Top-Level Statement Normalization
  // ---------------------------------------------------------------------------

  public normalizeStatement(stmt: Statement): NormalizedStatement {
    if (!stmt || typeof stmt !== "object") {
      return createEmptyNormalizedStatement("OTHER");
    }

    // 1. Query (SELECT, WITH ... SELECT, UNION, etc.)
    if ("Query" in stmt) {
      const q = (stmt as any).Query;
      // Handle WITH ... INSERT INTO ... (e.g. in PostgreSQL)
      if (q.body && "Insert" in q.body) {
        const ins = q.body.Insert.Insert || q.body.Insert;
        const targetTable = this.parseObjectName(ins.table || ins.tableName || ins.table_name);
        const { ctes } = this.normalizeQuery(q);
        const selectStatement = ins.source ? this.normalizeQuery(ins.source).selectStatement : undefined;
        return {
          type: "INSERT",
          targetTable,
          ctes,
          selectStatement,
          rawAst: stmt,
        };
      }

      const { ctes, selectStatement } = this.normalizeQuery(stmt.Query);
      return {
        type: "SELECT",
        ctes,
        selectStatement,
        rawAst: stmt,
      };
    }

    // 2. CreateTable (CREATE TABLE ... AS SELECT or schema definition)
    if ("CreateTable" in stmt) {
      const ct = (stmt as any).CreateTable;
      const targetTable = this.parseObjectName(ct.name);
      let ctes: NormalizedCTE[] = [];
      let selectStatement: NormalizedSelectStatement | undefined;

      if (ct.query) {
        const queryNorm = this.normalizeQuery(ct.query);
        ctes = queryNorm.ctes;
        selectStatement = queryNorm.selectStatement;
      }

      return {
        type: "CREATE_TABLE",
        targetTable,
        ctes,
        selectStatement,
        rawAst: stmt,
      };
    }

    // 3. CreateView (CREATE VIEW ... AS SELECT)
    if ("CreateView" in stmt) {
      const cv = (stmt as any).CreateView;
      const targetTable = this.parseObjectName(cv.name);
      let ctes: NormalizedCTE[] = [];
      let selectStatement: NormalizedSelectStatement | undefined;

      if (cv.query) {
        const queryNorm = this.normalizeQuery(cv.query);
        ctes = queryNorm.ctes;
        selectStatement = queryNorm.selectStatement;
      }

      return {
        type: "CREATE_VIEW",
        targetTable,
        ctes,
        selectStatement,
        rawAst: stmt,
      };
    }

    // 4. Insert (INSERT INTO ... SELECT or VALUES)
    if ("Insert" in stmt) {
      const ins = (stmt as any).Insert;
      const targetTable = this.parseObjectName(ins.table || ins.tableName || ins.table_name);
      let ctes: NormalizedCTE[] = [];
      let selectStatement: NormalizedSelectStatement | undefined;

      if (ins.source) {
        const queryNorm = this.normalizeQuery(ins.source);
        ctes = queryNorm.ctes;
        selectStatement = queryNorm.selectStatement;
      }

      return {
        type: "INSERT",
        targetTable,
        ctes,
        selectStatement,
        rawAst: stmt,
      };
    }

    // 5. Update (UPDATE table SET ... FROM ... WHERE)
    if ("Update" in stmt) {
      const upd = (stmt as any).Update;
      const fromItems: NormalizedFromItem[] = [];

      if (upd.table) {
        fromItems.push(...this.normalizeTableWithJoins(upd.table));
      }
      if (upd.from) {
        const fromSource = Array.isArray(upd.from) ? upd.from : [upd.from];
        for (const twj of fromSource) {
          fromItems.push(...this.normalizeTableWithJoins(twj));
        }
      }

      const selectStatement: NormalizedSelectStatement = {
        columns: [],
        from: fromItems,
        where: upd.selection || upd.where,
      };

      return {
        type: "UPDATE",
        ctes: [],
        selectStatement,
        rawAst: stmt,
      };
    }

    // 6. Delete (DELETE FROM ... WHERE)
    if ("Delete" in stmt) {
      const del = (stmt as any).Delete;
      const fromItems: NormalizedFromItem[] = [];

      if (del.from) {
        const fromSource = Array.isArray(del.from) ? del.from : [del.from];
        for (const twj of fromSource) {
          fromItems.push(...this.normalizeTableWithJoins(twj));
        }
      }

      const selectStatement: NormalizedSelectStatement = {
        columns: [],
        from: fromItems,
        where: del.selection || del.where,
      };

      return {
        type: "DELETE",
        ctes: [],
        selectStatement,
        rawAst: stmt,
      };
    }

    // 7. Merge (MERGE INTO target USING source ON ...)
    if ("Merge" in stmt) {
      const m = (stmt as any).Merge;
      const targetTable = this.parseObjectName(m.table?.Table?.name || m.table?.name || m.table);
      const sourceItem = this.normalizeTableFactor(m.source, "NONE", m.on);
      return {
        type: "MERGE",
        targetTable,
        ctes: [],
        selectStatement: {
          columns: [],
          from: [sourceItem],
          where: m.on,
        },
        rawAst: stmt,
      };
    }

    return createEmptyNormalizedStatement("OTHER");
  }

  // ---------------------------------------------------------------------------
  // Query & CTE Normalization
  // ---------------------------------------------------------------------------

  public normalizeQuery(query: any): {
    ctes: NormalizedCTE[];
    selectStatement: NormalizedSelectStatement;
  } {
    const ctes: NormalizedCTE[] = [];

    const cteTables = query.with?.cte_tables || query.with?.cteTables;
    if (Array.isArray(cteTables)) {
      for (const cte of cteTables) {
        ctes.push(this.normalizeCTE(cte));
      }
    }

    const selectStatement = this.normalizeSetExpr(query.body);

    const orderBy = query.order_by || query.orderBy;
    if (Array.isArray(orderBy) && orderBy.length > 0) {
      selectStatement.orderBy = orderBy;
    }
    if (query.limit) {
      selectStatement.limit = this.extractNumericLimit(query.limit);
    }

    return { ctes, selectStatement };
  }

  private normalizeCTE(cte: any): NormalizedCTE {
    const name = extractIdentValue(cte.alias?.name) || extractIdentValue(cte.alias) || "cte";
    const rawCols = cte.alias?.columns || cte.columns || [];
    const columnAliases = Array.isArray(rawCols) ? rawCols.map(extractIdentValue).filter(Boolean) : [];
    const { selectStatement } = this.normalizeQuery(cte.query);

    return {
      name,
      columnAliases: columnAliases.length > 0 ? columnAliases : undefined,
      statement: selectStatement,
    };
  }

  // ---------------------------------------------------------------------------
  // Set Operations & Select Body Normalization
  // ---------------------------------------------------------------------------

  public normalizeSetExpr(setExpr: any): NormalizedSelectStatement {
    if (!setExpr || typeof setExpr !== "object") {
      return createEmptyNormalizedSelect();
    }

    if ("Select" in setExpr) {
      return this.normalizeSelect(setExpr.Select);
    }

    if ("Query" in setExpr) {
      const { selectStatement } = this.normalizeQuery(setExpr.Query);
      return selectStatement;
    }

    if ("SetOperation" in setExpr) {
      const opObj = setExpr.SetOperation;
      const op = opObj.op;
      const setQuantifier = opObj.set_quantifier || opObj.setQuantifier;
      const leftSelect = this.normalizeSetExpr(opObj.left);
      const rightSelect = this.normalizeSetExpr(opObj.right);

      let operatorType: SetOperatorType = "UNION";
      if (op === "Union") {
        operatorType = setQuantifier === "All" ? "UNION_ALL" : "UNION";
      } else if (op === "Intersect") {
        operatorType = "INTERSECT";
      } else if (op === "Except") {
        operatorType = "EXCEPT";
      }

      if (!leftSelect.setOperations) {
        leftSelect.setOperations = [];
      }
      leftSelect.setOperations.push({
        operator: operatorType,
        statement: rightSelect,
      });

      return leftSelect;
    }

    return createEmptyNormalizedSelect();
  }

  public normalizeSelect(select: any): NormalizedSelectStatement {
    const columns: NormalizedColumn[] = [];
    const fromItems: NormalizedFromItem[] = [];

    // Projections
    if (Array.isArray(select.projection)) {
      for (const item of select.projection) {
        columns.push(this.normalizeSelectItem(item));
      }
    }

    // FROM and JOINs
    if (Array.isArray(select.from)) {
      for (const twj of select.from) {
        fromItems.push(...this.normalizeTableWithJoins(twj));
      }
    }

    const normalized: NormalizedSelectStatement = {
      columns,
      from: fromItems,
      where: select.selection || select.where,
      distinct: select.distinct !== undefined,
    };

    if (select.groupBy && select.groupBy !== "All" && select.groupBy.Expressions) {
      normalized.groupBy = select.groupBy.Expressions;
    } else if (select.group_by && select.group_by !== "All" && select.group_by.Expressions) {
      normalized.groupBy = select.group_by.Expressions;
    }

    if (select.having) {
      normalized.having = select.having;
    }
    if (select.qualify) {
      normalized.qualify = select.qualify;
    }

    return normalized;
  }

  // ---------------------------------------------------------------------------
  // Projections & SelectItems
  // ---------------------------------------------------------------------------

  private normalizeSelectItem(item: any): NormalizedColumn {
    if (typeof item === "string" && item === "UnnamedExpr") {
      return { name: "?", sourceReferences: [] };
    }

    // Wildcard (*)
    if ("Wildcard" in item) {
      return {
        name: "*",
        isStar: true,
        sourceReferences: [],
      };
    }

    // Qualified Wildcard (table.*)
    if ("QualifiedWildcard" in item) {
      const [rawObjName] = item.QualifiedWildcard;
      const parts = extractIdents(rawObjName);
      const prefix = parts.join(".");
      return {
        name: `${prefix}.*`,
        isStar: true,
        starTablePrefix: prefix,
        sourceReferences: [],
      };
    }

    // Unnamed Expression (e.g. SELECT col, SELECT col + 1)
    if ("UnnamedExpr" in item) {
      const expr = item.UnnamedExpr;
      const derivedName = this.extractDerivedColumnName(expr);
      const rawExpression = this.stringifyExpr(expr);
      const sourceReferences = this.extractColumnReferences(expr, "select");

      return {
        name: derivedName,
        expr,
        rawExpression,
        sourceReferences,
      };
    }

    // Aliased Expression (SELECT expr AS alias)
    if ("ExprWithAlias" in item) {
      const { expr, alias } = item.ExprWithAlias;
      const name = extractIdentValue(alias);
      const rawExpression = this.stringifyExpr(expr);
      const sourceReferences = this.extractColumnReferences(expr, "select");

      return {
        name,
        alias: name,
        expr,
        rawExpression,
        sourceReferences,
      };
    }

    return { name: "?", sourceReferences: [] };
  }

  // ---------------------------------------------------------------------------
  // FROM clause & Joins
  // ---------------------------------------------------------------------------

  private normalizeTableWithJoins(twj: any): NormalizedFromItem[] {
    const items: NormalizedFromItem[] = [];

    // Base Relation
    if (twj.relation) {
      items.push(this.normalizeTableFactor(twj.relation, "NONE"));
    }

    // Joins
    const joins = twj.joins;
    if (Array.isArray(joins)) {
      for (const join of joins) {
        const op = join.join_operator || join.joinOperator;
        const { joinType, onCondition, usingColumns } = this.parseJoinOperator(op);
        const joinItem = this.normalizeTableFactor(join.relation, joinType, onCondition, usingColumns);
        items.push(joinItem);
      }
    }

    return items;
  }

  private normalizeTableFactor(
    relation: any,
    joinType: JoinType = "NONE",
    onCondition?: any,
    usingColumns?: string[],
  ): NormalizedFromItem {
    // 0. Pivot / Unpivot table wrapper
    if ("Pivot" in relation) {
      return this.normalizeTableFactor((relation as any).Pivot.table, joinType, onCondition, usingColumns);
    }

    // 1. Physical Table
    if ("Table" in relation) {
      const { name, alias } = relation.Table;
      const { tableName, schemaName, databaseName } = this.parseObjectName(name);
      return {
        type: "table",
        tableName,
        schemaName,
        databaseName,
        alias: extractIdentValue(alias?.name) || extractIdentValue(alias) || undefined,
        joinType,
        onCondition,
        usingColumns,
      };
    }

    // 2. Derived Subquery in FROM
    if ("Derived" in relation) {
      const { subquery, alias } = relation.Derived;
      const { selectStatement } = this.normalizeQuery(subquery);
      return {
        type: "subquery",
        alias: extractIdentValue(alias?.name) || extractIdentValue(alias) || undefined,
        subquery: selectStatement,
        joinType,
        onCondition,
        usingColumns,
      };
    }

    // 3. Table Function (e.g. read_csv_auto, unnest)
    if ("TableFunction" in relation) {
      const { expr, alias } = relation.TableFunction;
      const funcName = this.stringifyExpr(expr);
      return {
        type: "function",
        tableName: funcName,
        alias: extractIdentValue(alias?.name) || extractIdentValue(alias) || undefined,
        joinType,
        onCondition,
        usingColumns,
      };
    }

    return {
      type: "table",
      tableName: "unknown",
      joinType,
    };
  }

  private parseJoinOperator(op: any): {
    joinType: JoinType;
    onCondition?: any;
    usingColumns?: string[];
  } {
    if (!op) return { joinType: "INNER" };

    if (
      op === "CrossJoin" ||
      op === "CrossApply" ||
      op === "OuterApply" ||
      (typeof op === "object" && ("CrossJoin" in op || "CrossApply" in op || "OuterApply" in op))
    ) {
      return { joinType: "CROSS" };
    }

    let joinType: JoinType = "INNER";
    let constraint: any;

    if (typeof op === "object") {
      if ("Inner" in op) {
        joinType = "INNER";
        constraint = op.Inner;
      } else if ("Join" in op) {
        joinType = "INNER";
        constraint = op.Join;
      } else if ("Left" in op) {
        joinType = "LEFT";
        constraint = op.Left;
      } else if ("LeftOuter" in op) {
        joinType = "LEFT";
        constraint = op.LeftOuter;
      } else if ("Right" in op) {
        joinType = "RIGHT";
        constraint = op.Right;
      } else if ("RightOuter" in op) {
        joinType = "RIGHT";
        constraint = op.RightOuter;
      } else if ("FullOuter" in op || "Full" in op) {
        joinType = "FULL";
        constraint = op.FullOuter || op.Full;
      } else if ("LeftSemi" in op || "LeftAnti" in op) {
        joinType = "LEFT";
        constraint = op.LeftSemi || op.LeftAnti;
      }
    }

    let onCondition: any;
    let usingColumns: string[] | undefined;

    if (constraint && typeof constraint === "object") {
      if ("On" in constraint) {
        onCondition = constraint.On;
      } else if ("Using" in constraint && Array.isArray(constraint.Using)) {
        usingColumns = constraint.Using.flatMap((u: any) => extractIdents(u));
      }
    }

    return { joinType, onCondition, usingColumns };
  }

  // ---------------------------------------------------------------------------
  // Expression Analysis & Column Reference Extraction
  // ---------------------------------------------------------------------------

  public extractColumnReferences(expr: any, context: ClauseContext = "select"): NormalizedColumnRef[] {
    const refs: NormalizedColumnRef[] = [];
    this.walkExpr(expr, context, refs);
    return refs;
  }

  private walkExpr(expr: any, context: ClauseContext, refs: NormalizedColumnRef[]): void {
    if (!expr || typeof expr !== "object") return;

    // Single Identifier
    if ("Identifier" in expr) {
      const val = extractIdentValue(expr.Identifier);
      if (val) {
        refs.push({ column: val, context });
      }
      return;
    }

    // Compound Identifier (e.g. table.col, schema.table.col)
    if ("CompoundIdentifier" in expr && Array.isArray(expr.CompoundIdentifier)) {
      const parts = expr.CompoundIdentifier.map(extractIdentValue).filter(Boolean);
      if (parts.length === 1) {
        refs.push({ column: parts[0]!, context });
      } else if (parts.length === 2) {
        refs.push({ table: parts[0]!, column: parts[1]!, context });
      } else if (parts.length >= 3) {
        const table = parts.slice(0, -1).join(".");
        const column = parts[parts.length - 1]!;
        refs.push({ table, column, context });
      }
      return;
    }

    // Binary Operation
    if ("BinaryOp" in expr && expr.BinaryOp) {
      this.walkExpr(expr.BinaryOp.left, context, refs);
      this.walkExpr(expr.BinaryOp.right, context, refs);
      return;
    }

    // Unary Operation
    if ("UnaryOp" in expr && expr.UnaryOp) {
      this.walkExpr(expr.UnaryOp.expr, context, refs);
      return;
    }

    // Nested Expression
    if ("Nested" in expr) {
      this.walkExpr(expr.Nested, context, refs);
      return;
    }

    // Function Call
    if ("Function" in expr && expr.Function) {
      const fn = expr.Function;
      const rawArgs = fn.args?.List?.args || fn.args?.args || (Array.isArray(fn.args) ? fn.args : []);
      if (Array.isArray(rawArgs)) {
        for (const arg of rawArgs) {
          this.walkFunctionArg(arg, context, refs);
        }
      }
      return;
    }

    // CASE Statement
    if ("Case" in expr && expr.Case) {
      const c = expr.Case;
      if (c.operand) this.walkExpr(c.operand, context, refs);
      if (Array.isArray(c.conditions)) {
        for (const cond of c.conditions) this.walkExpr(cond, context, refs);
      }
      if (Array.isArray(c.results)) {
        for (const res of c.results) this.walkExpr(res, context, refs);
      }
      if (c.elseResult || c.else_result) this.walkExpr(c.elseResult || c.else_result, context, refs);
      return;
    }

    // Casts
    if ("Cast" in expr && expr.Cast) {
      this.walkExpr(expr.Cast.expr, context, refs);
      return;
    }
    if ("TryCast" in expr && expr.TryCast) {
      this.walkExpr(expr.TryCast.expr, context, refs);
      return;
    }
    if ("SafeCast" in expr && expr.SafeCast) {
      this.walkExpr(expr.SafeCast.expr, context, refs);
      return;
    }

    // BETWEEN
    if ("Between" in expr && expr.Between) {
      this.walkExpr(expr.Between.expr, context, refs);
      this.walkExpr(expr.Between.low, context, refs);
      this.walkExpr(expr.Between.high, context, refs);
      return;
    }

    // IN List
    if ("InList" in expr && expr.InList) {
      this.walkExpr(expr.InList.expr, context, refs);
      if (Array.isArray(expr.InList.list)) {
        for (const item of expr.InList.list) this.walkExpr(item, context, refs);
      }
      return;
    }

    // IN Subquery
    if ("InSubquery" in expr && expr.InSubquery) {
      this.walkExpr(expr.InSubquery.expr, context, refs);
      return;
    }

    // Subquery
    if ("Subquery" in expr) {
      return;
    }

    // IsNull / IsNotNull
    if ("IsNull" in expr) {
      this.walkExpr(expr.IsNull, context, refs);
      return;
    }
    if ("IsNotNull" in expr) {
      this.walkExpr(expr.IsNotNull, context, refs);
      return;
    }
  }

  private walkFunctionArg(arg: any, context: ClauseContext, refs: NormalizedColumnRef[]): void {
    if (!arg) return;
    if (typeof arg === "string") return;

    if ("Unnamed" in arg) {
      const unnamed = arg.Unnamed;
      if (unnamed && typeof unnamed === "object") {
        if ("Expr" in unnamed) {
          this.walkExpr(unnamed.Expr, context, refs);
        } else {
          this.walkExpr(unnamed, context, refs);
        }
      }
    } else if ("Named" in arg) {
      const named = arg.Named;
      if (named?.arg) {
        this.walkExpr(named.arg, context, refs);
      } else if (named?.expr) {
        this.walkExpr(named.expr, context, refs);
      }
    } else if ("FunctionArgExpr" in arg) {
      this.walkExpr(arg.FunctionArgExpr, context, refs);
    } else {
      this.walkExpr(arg, context, refs);
    }
  }

  // ---------------------------------------------------------------------------
  // Stringifiers & Utilities
  // ---------------------------------------------------------------------------

  public parseObjectName(name: any): NormalizedTargetTable {
    const parts = extractIdents(name);
    if (parts.length === 0) {
      return { tableName: "unknown" };
    }
    if (parts.length === 1) {
      return { tableName: parts[0]! };
    }
    if (parts.length === 2) {
      return { schemaName: parts[0]!, tableName: parts[1]! };
    }
    return {
      databaseName: parts[0]!,
      schemaName: parts[1]!,
      tableName: parts.slice(2).join("."),
    };
  }

  public stringifyExpr(expr: any): string {
    if (!expr) return "";

    if ("Identifier" in expr) {
      return extractIdentValue(expr.Identifier);
    }

    if ("CompoundIdentifier" in expr && Array.isArray(expr.CompoundIdentifier)) {
      return expr.CompoundIdentifier.map(extractIdentValue).filter(Boolean).join(".");
    }

    if ("Value" in expr) {
      const rawVal = expr.Value;
      const val = rawVal && typeof rawVal === "object" && "value" in rawVal ? rawVal.value : rawVal;
      if (typeof val === "object" && val !== null) {
        if ("SingleQuotedString" in val) return `'${val.SingleQuotedString}'`;
        if ("Number" in val && Array.isArray(val.Number)) return String(val.Number[0]);
        if ("Boolean" in val) return String(val.Boolean);
        if ("Null" in val) return "NULL";
      }
      return String(val);
    }

    if ("BinaryOp" in expr && expr.BinaryOp) {
      return `${this.stringifyExpr(expr.BinaryOp.left)} ${this.stringifyOp(expr.BinaryOp.op)} ${this.stringifyExpr(expr.BinaryOp.right)}`;
    }

    if ("UnaryOp" in expr && expr.UnaryOp) {
      return `${this.stringifyUnaryOp(expr.UnaryOp.op)} ${this.stringifyExpr(expr.UnaryOp.expr)}`;
    }

    if ("Nested" in expr) {
      return `(${this.stringifyExpr(expr.Nested)})`;
    }

    if ("Function" in expr && expr.Function) {
      const fn = expr.Function;
      const fnName = extractIdents(fn.name).join(".") || "FUNC";
      return `${fnName}(...)`;
    }

    if ("Wildcard" in expr) {
      return "*";
    }

    return String(expr);
  }

  private stringifyOp(op: string): string {
    switch (op) {
      case "Plus":
        return "+";
      case "Minus":
        return "-";
      case "Multiply":
        return "*";
      case "Divide":
        return "/";
      case "Eq":
        return "=";
      case "NotEq":
        return "!=";
      case "Gt":
        return ">";
      case "Lt":
        return "<";
      case "GtEq":
        return ">=";
      case "LtEq":
        return "<=";
      case "And":
        return "AND";
      case "Or":
        return "OR";
      default:
        return op;
    }
  }

  private stringifyUnaryOp(op: string): string {
    return op === "Not" ? "NOT" : op;
  }

  private extractDerivedColumnName(expr: any): string {
    if (!expr) return "?";
    if ("Identifier" in expr) {
      return extractIdentValue(expr.Identifier) || "?";
    }
    if ("CompoundIdentifier" in expr && Array.isArray(expr.CompoundIdentifier)) {
      const parts = expr.CompoundIdentifier.map(extractIdentValue).filter(Boolean);
      return parts[parts.length - 1] || "?";
    }
    if ("Function" in expr && expr.Function) {
      const parts = extractIdents(expr.Function.name);
      return parts.length > 0 ? parts.join(".").toLowerCase() : "fn";
    }
    return this.stringifyExpr(expr);
  }

  private extractNumericLimit(limit: any): number | undefined {
    if (!limit) return undefined;
    if (typeof limit === "number") return limit;
    if ("Value" in limit) {
      const rawVal = limit.Value;
      const val = rawVal && typeof rawVal === "object" && "value" in rawVal ? rawVal.value : rawVal;
      if (val && typeof val === "object" && "Number" in val && Array.isArray(val.Number)) {
        return parseInt(val.Number[0], 10);
      }
    }
    return undefined;
  }
}
