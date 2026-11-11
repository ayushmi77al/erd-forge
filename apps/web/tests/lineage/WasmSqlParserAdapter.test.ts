import { describe, expect, it } from "vitest";
import { WasmSqlParserAdapter } from "@/lineage/parser/WasmSqlParserAdapter";

describe("T2.3: WasmSqlParserAdapter Implementation", () => {
  const adapter = new WasmSqlParserAdapter();

  it("exposes expected metadata and initializes WASM idempotently", async () => {
    expect(adapter.id).toBe("wasm-sqlparser-rs");
    expect(adapter.name).toBe("WASM sqlparser-rs Adapter");
    expect(adapter.version).toBe("0.63.0");

    await expect(adapter.initialize()).resolves.toBeUndefined();
    await expect(adapter.initialize()).resolves.toBeUndefined();
  });

  describe("SELECT and Projection Normalization", () => {
    it("normalizes basic SELECT with aliases and expressions", async () => {
      const sql = "SELECT id, first_name AS fname, UPPER(last_name) AS lname, 100 * score AS scaled_score FROM users u";
      const result = await adapter.parse(sql, "generic");

      expect(result.errors).toEqual([]);
      expect(result.statements).toHaveLength(1);

      const stmt = result.statements[0]!;
      expect(stmt.type).toBe("SELECT");
      expect(stmt.selectStatement).toBeDefined();

      const select = stmt.selectStatement!;
      expect(select.columns).toHaveLength(4);

      // 1. Plain column: id
      expect(select.columns[0]!.name).toBe("id");
      expect(select.columns[0]!.sourceReferences).toEqual([{ column: "id", context: "select" }]);

      // 2. Aliased column: first_name AS fname
      expect(select.columns[1]!.name).toBe("fname");
      expect(select.columns[1]!.alias).toBe("fname");
      expect(select.columns[1]!.sourceReferences).toEqual([{ column: "first_name", context: "select" }]);

      // 3. Function expression: UPPER(last_name) AS lname
      expect(select.columns[2]!.name).toBe("lname");
      expect(select.columns[2]!.sourceReferences).toEqual([{ column: "last_name", context: "select" }]);

      // 4. Binary expression: 100 * score AS scaled_score
      expect(select.columns[3]!.name).toBe("scaled_score");
      expect(select.columns[3]!.sourceReferences).toEqual([{ column: "score", context: "select" }]);

      // FROM
      expect(select.from).toHaveLength(1);
      expect(select.from[0]!.type).toBe("table");
      expect(select.from[0]!.tableName).toBe("users");
      expect(select.from[0]!.alias).toBe("u");
    });

    it("normalizes wildcards and qualified wildcards", async () => {
      const sql = "SELECT *, u.*, c.country FROM users u JOIN countries c ON u.country_id = c.id";
      const result = await adapter.parse(sql, "generic");

      expect(result.errors).toEqual([]);
      const select = result.statements[0]!.selectStatement!;
      expect(select.columns).toHaveLength(3);

      expect(select.columns[0]!.isStar).toBe(true);
      expect(select.columns[0]!.name).toBe("*");

      expect(select.columns[1]!.isStar).toBe(true);
      expect(select.columns[1]!.starTablePrefix).toBe("u");

      expect(select.columns[2]!.name).toBe("country");
      expect(select.columns[2]!.sourceReferences).toEqual([{ table: "c", column: "country", context: "select" }]);
    });
  });

  describe("CTEs (WITH clause)", () => {
    it("normalizes Common Table Expressions with column aliases", async () => {
      const sql = `
        WITH MonthlySales (cust_id, revenue) AS (
          SELECT customer_id, SUM(amount)
          FROM orders
          GROUP BY customer_id
        )
        SELECT cust_id, revenue
        FROM MonthlySales
        WHERE revenue > 1000
      `;
      const result = await adapter.parse(sql, "generic");

      expect(result.errors).toEqual([]);
      const stmt = result.statements[0]!;
      expect(stmt.ctes).toHaveLength(1);

      const cte = stmt.ctes[0]!;
      expect(cte.name).toBe("MonthlySales");
      expect(cte.columnAliases).toEqual(["cust_id", "revenue"]);
      expect(cte.statement.from[0]!.tableName).toBe("orders");

      expect(stmt.selectStatement?.from[0]?.tableName).toBe("MonthlySales");
    });
  });

  describe("JOINs and FROM items", () => {
    it("normalizes INNER, LEFT, and RIGHT joins with ON conditions", async () => {
      const sql = `
        SELECT o.id, c.name, p.title
        FROM orders o
        INNER JOIN customers c ON o.customer_id = c.id
        LEFT JOIN payments p ON o.payment_id = p.id
      `;
      const result = await adapter.parse(sql, "generic");

      expect(result.errors).toEqual([]);
      const select = result.statements[0]!.selectStatement!;
      expect(select.from).toHaveLength(3);

      // Base table
      expect(select.from[0]!.tableName).toBe("orders");
      expect(select.from[0]!.alias).toBe("o");
      expect(select.from[0]!.joinType).toBe("NONE");

      // Join 1
      expect(select.from[1]!.tableName).toBe("customers");
      expect(select.from[1]!.alias).toBe("c");
      expect(select.from[1]!.joinType).toBe("INNER");
      expect(select.from[1]!.onCondition).toBeDefined();

      // Join 2
      expect(select.from[2]!.tableName).toBe("payments");
      expect(select.from[2]!.alias).toBe("p");
      expect(select.from[2]!.joinType).toBe("LEFT");
      expect(select.from[2]!.onCondition).toBeDefined();
    });

    it("normalizes derived table subqueries in FROM clause", async () => {
      const sql = `
        SELECT sub.id, sub.total
        FROM (
          SELECT user_id AS id, SUM(amount) AS total
          FROM transactions
          GROUP BY user_id
        ) sub
      `;
      const result = await adapter.parse(sql, "generic");

      expect(result.errors).toEqual([]);
      const fromItem = result.statements[0]!.selectStatement!.from[0]!;
      expect(fromItem.type).toBe("subquery");
      expect(fromItem.alias).toBe("sub");
      expect(fromItem.subquery).toBeDefined();
      expect(fromItem.subquery?.from[0]?.tableName).toBe("transactions");
    });
  });

  describe("QUALIFY and Windowing", () => {
    it("normalizes QUALIFY clause in Snowflake/BigQuery dialects", async () => {
      const sql = `
        SELECT id, category, score,
               ROW_NUMBER() OVER (PARTITION BY category ORDER BY score DESC) as rank
        FROM items
        QUALIFY rank <= 3
      `;
      const result = await adapter.parse(sql, "snowflake");

      expect(result.errors).toEqual([]);
      const select = result.statements[0]!.selectStatement!;
      expect(select.qualify).toBeDefined();
    });
  });

  describe("Set Operations (UNION and UNION ALL)", () => {
    it("normalizes UNION and UNION ALL into setOperations array", async () => {
      const sql = `
        SELECT id, name FROM active_users
        UNION ALL
        SELECT id, name FROM archived_users
      `;
      const result = await adapter.parse(sql, "generic");

      expect(result.errors).toEqual([]);
      const select = result.statements[0]!.selectStatement!;
      expect(select.from[0]!.tableName).toBe("active_users");
      expect(select.setOperations).toHaveLength(1);

      const setOp = select.setOperations![0]!;
      expect(setOp.operator).toBe("UNION_ALL");
      expect(setOp.statement.from[0]!.tableName).toBe("archived_users");
    });
  });

  describe("DDL and DML Statements", () => {
    it("normalizes CREATE TABLE AS SELECT", async () => {
      const sql = `
        CREATE TABLE reporting.daily_summary AS
        SELECT date, SUM(amount) as daily_total
        FROM sales
        GROUP BY date
      `;
      const result = await adapter.parse(sql, "postgresql");

      expect(result.errors).toEqual([]);
      const stmt = result.statements[0]!;
      expect(stmt.type).toBe("CREATE_TABLE");
      expect(stmt.targetTable?.schemaName).toBe("reporting");
      expect(stmt.targetTable?.tableName).toBe("daily_summary");
      expect(stmt.selectStatement?.from[0]?.tableName).toBe("sales");
    });

    it("normalizes CREATE VIEW ... AS SELECT", async () => {
      const sql = `
        CREATE VIEW v_active_users AS
        SELECT id, email FROM users WHERE active = true
      `;
      const result = await adapter.parse(sql, "generic");

      expect(result.errors).toEqual([]);
      const stmt = result.statements[0]!;
      expect(stmt.type).toBe("CREATE_VIEW");
      expect(stmt.targetTable?.tableName).toBe("v_active_users");
      expect(stmt.selectStatement?.from[0]?.tableName).toBe("users");
    });

    it("normalizes INSERT INTO ... SELECT", async () => {
      const sql = `
        INSERT INTO audit_log (user_id, action)
        SELECT id, 'LOGIN' FROM current_logins
      `;
      const result = await adapter.parse(sql, "generic");

      expect(result.errors).toEqual([]);
      const stmt = result.statements[0]!;
      expect(stmt.type).toBe("INSERT");
      expect(stmt.targetTable?.tableName).toBe("audit_log");
      expect(stmt.selectStatement?.from[0]?.tableName).toBe("current_logins");
    });
  });

  describe("Syntax Error Recovery", () => {
    it("captures parser error location and dialect cleanly", async () => {
      const badSql = "SELECT * FROM (";
      const result = await adapter.parse(badSql, "bigquery");

      expect(result.statements).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.line).toBeGreaterThanOrEqual(1);
      expect(result.errors[0]!.dialect).toBe("bigquery");
      expect(result.errors[0]!.message).toBeDefined();
    });
  });
});
