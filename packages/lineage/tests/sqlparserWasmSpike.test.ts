import { format, init, ParserError, parse, validate } from "@guanmingchiu/sqlparser-ts";
import { describe, expect, it } from "vitest";

describe("T2.1: @guanmingchiu/sqlparser-ts WASM Spike", () => {
  it("initializes WASM engine idempotently", async () => {
    // Should resolve without error on first and subsequent calls
    await expect(init()).resolves.toBeUndefined();
    await expect(init()).resolves.toBeUndefined();
  });

  it("parses ANSI / Generic SQL into structured AST", async () => {
    await init();
    const sql = "SELECT id, name, email FROM users WHERE active = true";
    const ast = parse(sql);

    expect(ast).toBeDefined();
    expect(Array.isArray(ast)).toBe(true);
    expect(ast.length).toBe(1);

    const queryStmt = ast[0] as any;
    expect(queryStmt).toHaveProperty("Query");
    expect(queryStmt.Query.body).toHaveProperty("Select");
    expect(queryStmt.Query.body.Select.projection).toHaveLength(3);
  });

  it("parses dialect-specific syntax across major data warehouses", async () => {
    await init();

    // 1. PostgreSQL (e.g. :: cast syntax)
    const pgSql = "SELECT id, created_at::date AS dt FROM events";
    const pgAst = parse(pgSql, "postgresql");
    expect(pgAst).toHaveLength(1);

    // 2. BigQuery (e.g. backticked identifiers, standard select)
    const bqSql = "SELECT `order_id`, `amount` FROM `analytics.orders`";
    const bqAst = parse(bqSql, "bigquery");
    expect(bqAst).toHaveLength(1);

    // 3. Snowflake
    const sfSql = "SELECT col1, col2 FROM db.schema.my_table";
    const sfAst = parse(sfSql, "snowflake");
    expect(sfAst).toHaveLength(1);

    // 4. SQLite
    const sqliteSql = "SELECT name FROM sqlite_master WHERE type='table'";
    const sqliteAst = parse(sqliteSql, "sqlite");
    expect(sqliteAst).toHaveLength(1);

    // 5. DuckDB
    const duckSql = "SELECT * FROM read_csv_auto('test.csv')";
    const duckAst = parse(duckSql, "duckdb");
    expect(duckAst).toHaveLength(1);
  });

  it("handles complex queries with CTEs and Window Functions", async () => {
    await init();
    const complexSql = `
      WITH regional_sales AS (
        SELECT region, SUM(amount) AS total_sales
        FROM orders
        GROUP BY region
      )
      SELECT
        region,
        total_sales,
        RANK() OVER (ORDER BY total_sales DESC) as sales_rank
      FROM regional_sales
    `;
    const ast = parse(complexSql);
    expect(ast).toHaveLength(1);

    const queryStmt = ast[0] as any;
    expect(queryStmt.Query).toHaveProperty("with");
    expect(queryStmt.Query.with.cte_tables).toHaveLength(1);
    expect(queryStmt.Query.with.cte_tables[0].alias.name.value).toBe("regional_sales");
  });

  it("validates and formats SQL correctly", async () => {
    await init();
    const dirtySql = "select   a,    b  from   tbl   where a > 10";
    const formatted = format(dirtySql);
    expect(formatted.toLowerCase()).toContain("select a, b from tbl where a > 10");

    expect(() => validate("SELECT 1")).not.toThrow();
  });

  it("throws descriptive ParserError on invalid SQL syntax", async () => {
    await init();
    const badSql = "SELECT * FROM (";
    expect(() => parse(badSql)).toThrow(ParserError);
  });
});
