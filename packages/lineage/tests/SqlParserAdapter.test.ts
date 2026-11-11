import { describe, expect, it } from "vitest";
import {
  collectAllFromTables,
  collectAllSubqueries,
  createEmptyNormalizedSelect,
  createEmptyNormalizedStatement,
  isDdlOrDml,
  isSelectStatement,
  mapToWasmDialect,
  type NormalizedCTE,
  type NormalizedSelectStatement,
  type NormalizedStatement,
} from "../src/parser/SqlParserAdapter";
import type { SQLDialect } from "../src/types";

describe("T2.2: Normalized Statement Contract (SqlParserAdapter)", () => {
  describe("mapToWasmDialect", () => {
    it("maps all supported ERD Forge SQL dialects to valid WASM dialects", () => {
      const dialectMappings: Record<SQLDialect, string> = {
        mssql: "mssql",
        postgresql: "postgresql",
        mysql: "mysql",
        sqlite: "sqlite",
        oracle: "oracle",
        bigquery: "bigquery",
        redshift: "redshift",
        snowflake: "snowflake",
        databricks: "databricks",
        generic: "generic",
      };

      for (const [appDialect, expectedWasmDialect] of Object.entries(dialectMappings)) {
        expect(mapToWasmDialect(appDialect as SQLDialect)).toBe(expectedWasmDialect);
      }
    });

    it("falls back to generic for unknown or unlisted dialects", () => {
      expect(mapToWasmDialect("unknown" as any)).toBe("generic");
    });
  });

  describe("Factory functions and Type Guards", () => {
    it("creates an empty normalized select statement", () => {
      const select = createEmptyNormalizedSelect();
      expect(select.columns).toEqual([]);
      expect(select.from).toEqual([]);
      expect(select.where).toBeUndefined();
    });

    it("creates an empty normalized statement with correct type", () => {
      const stmt = createEmptyNormalizedStatement("SELECT");
      expect(stmt.type).toBe("SELECT");
      expect(stmt.ctes).toEqual([]);
      expect(stmt.selectStatement).toBeDefined();

      const insertStmt = createEmptyNormalizedStatement("INSERT");
      expect(insertStmt.type).toBe("INSERT");
      expect(insertStmt.selectStatement).toBeUndefined();
    });

    it("validates type guards for statements", () => {
      const selectStmt = createEmptyNormalizedStatement("SELECT");
      expect(isSelectStatement(selectStmt)).toBe(true);
      expect(isDdlOrDml(selectStmt)).toBe(false);

      const ddlStmt = createEmptyNormalizedStatement("CREATE_TABLE");
      expect(isSelectStatement(ddlStmt)).toBe(false);
      expect(isDdlOrDml(ddlStmt)).toBe(true);
    });
  });

  describe("Complex Statement Modeling", () => {
    it("accurately models CTEs, Joins, QUALIFY, and Set Operations", () => {
      // Build a comprehensive AST contract representation
      const mockCTE: NormalizedCTE = {
        name: "regional_sales",
        columnAliases: ["region", "total_sales"],
        statement: {
          columns: [
            {
              name: "region",
              sourceReferences: [{ table: "orders", column: "region", context: "select" }],
            },
            {
              name: "total_sales",
              rawExpression: "SUM(amount)",
              sourceReferences: [{ table: "orders", column: "amount", context: "select" }],
            },
          ],
          from: [
            {
              type: "table",
              tableName: "orders",
              alias: "o",
            },
          ],
          groupBy: [{ expr: "region" }],
        },
      };

      const mockUnionBranch: NormalizedSelectStatement = {
        columns: [
          {
            name: "region",
            sourceReferences: [{ table: "intl_orders", column: "region", context: "select" }],
          },
          {
            name: "total_sales",
            rawExpression: "SUM(amount)",
            sourceReferences: [{ table: "intl_orders", column: "amount", context: "select" }],
          },
        ],
        from: [
          {
            type: "table",
            tableName: "intl_orders",
          },
        ],
      };

      const mockMainSelect: NormalizedSelectStatement = {
        columns: [
          {
            name: "region",
            sourceReferences: [{ table: "regional_sales", column: "region", context: "select" }],
          },
          {
            name: "total_sales",
            sourceReferences: [{ table: "regional_sales", column: "total_sales", context: "select" }],
          },
          {
            name: "sales_rank",
            rawExpression: "RANK() OVER (ORDER BY total_sales DESC)",
            sourceReferences: [{ table: "regional_sales", column: "total_sales", context: "select" }],
          },
        ],
        from: [
          {
            type: "table",
            tableName: "regional_sales",
            alias: "rs",
            joinType: "NONE",
          },
          {
            type: "table",
            tableName: "regions",
            alias: "r",
            joinType: "INNER",
            onCondition: { type: "binary", op: "=" },
          },
        ],
        qualify: {
          rawExpression: "RANK() OVER (ORDER BY total_sales DESC) <= 5",
        },
        setOperations: [
          {
            operator: "UNION_ALL",
            statement: mockUnionBranch,
          },
        ],
      };

      const statement: NormalizedStatement = {
        type: "CREATE_VIEW",
        targetTable: {
          tableName: "top_regional_sales",
          schemaName: "reporting",
        },
        ctes: [mockCTE],
        selectStatement: mockMainSelect,
      };

      expect(statement.type).toBe("CREATE_VIEW");
      expect(statement.targetTable?.tableName).toBe("top_regional_sales");
      expect(statement.targetTable?.schemaName).toBe("reporting");
      expect(statement.ctes).toHaveLength(1);
      expect(statement.ctes[0]?.name).toBe("regional_sales");
      expect(statement.selectStatement?.qualify).toBeDefined();
      expect(statement.selectStatement?.from).toHaveLength(2);
      expect(statement.selectStatement?.setOperations).toHaveLength(1);
    });

    it("recursively collects all base from tables across joins, subqueries, and set operations", () => {
      const derivedSubquery: NormalizedSelectStatement = {
        columns: [{ name: "id", sourceReferences: [{ table: "legacy_users", column: "id" }] }],
        from: [{ type: "table", tableName: "legacy_users" }],
      };

      const unionStatement: NormalizedSelectStatement = {
        columns: [{ name: "id", sourceReferences: [{ table: "archive_users", column: "id" }] }],
        from: [{ type: "table", tableName: "archive_users" }],
      };

      const rootSelect: NormalizedSelectStatement = {
        columns: [{ name: "id", sourceReferences: [] }],
        from: [
          { type: "table", tableName: "primary_users", alias: "pu" },
          { type: "subquery", alias: "du", subquery: derivedSubquery, joinType: "LEFT" },
        ],
        setOperations: [{ operator: "UNION", statement: unionStatement }],
      };

      const tables = collectAllFromTables(rootSelect);
      const tableNames = tables.map((t) => t.tableName);

      expect(tableNames).toContain("primary_users");
      expect(tableNames).toContain("legacy_users");
      expect(tableNames).toContain("archive_users");
      expect(tables).toHaveLength(3);
    });

    it("recursively collects all nested subqueries", () => {
      const deepSubquery: NormalizedSelectStatement = {
        columns: [{ name: "deep_val", sourceReferences: [] }],
        from: [{ type: "table", tableName: "deep_tbl" }],
      };

      const nestedSubquery: NormalizedSelectStatement = {
        columns: [{ name: "nested_val", sourceReferences: [] }],
        from: [{ type: "subquery", subquery: deepSubquery }],
      };

      const rootSelect: NormalizedSelectStatement = {
        columns: [{ name: "root_val", sourceReferences: [] }],
        from: [{ type: "subquery", subquery: nestedSubquery }],
      };

      const subqueries = collectAllSubqueries(rootSelect);
      expect(subqueries).toHaveLength(2);
      expect(subqueries[0]).toBe(nestedSubquery);
      expect(subqueries[1]).toBe(deepSubquery);
    });
  });
});
