export interface ExpectedColumnLineage {
  targetColumn: string;
  sourceTable: string;
  sourceColumn: string;
}

export interface SqlFixtureCase {
  id: string;
  dialect: "postgresql" | "snowflake" | "bigquery" | "databricks" | "duckdb" | "mysql" | "mssql";
  name: string;
  description: string;
  sql: string;
  expectedSourceTables: string[];
  expectedTargetTables: string[];
  expectedColumns?: ExpectedColumnLineage[];
  featuresTested: string[];
}

export const sqlFixtures: SqlFixtureCase[] = [
  {
    id: "pg_multi_level_ctes",
    dialect: "postgresql",
    name: "PostgreSQL Multi-Level CTEs with Window Functions",
    description: "Tests recursive/chained CTE resolution, alias tracking, and column pass-through",
    sql: `
      WITH regional_sales AS (
        SELECT region, SUM(amount) AS total_sales
        FROM orders
        GROUP BY region
      ),
      top_regions AS (
        SELECT region, total_sales,
               RANK() OVER (ORDER BY total_sales DESC) as sales_rank
        FROM regional_sales
        WHERE total_sales > 10000
      )
      INSERT INTO reporting.regional_summary (target_region, sales_volume, rank_position)
      SELECT region, total_sales, sales_rank
      FROM top_regions;
    `,
    expectedSourceTables: ["orders"],
    expectedTargetTables: ["reporting.regional_summary"],
    expectedColumns: [
      { targetColumn: "target_region", sourceTable: "orders", sourceColumn: "region" },
      { targetColumn: "sales_volume", sourceTable: "orders", sourceColumn: "amount" },
    ],
    featuresTested: ["Chained CTEs", "INSERT INTO", "Window Functions", "Aliases"],
  },
  {
    id: "snowflake_qualify_dedup",
    dialect: "snowflake",
    name: "Snowflake QUALIFY Deduplication",
    description: "Tests Snowflake QUALIFY clause parsing and deduplication pattern resolution",
    sql: `
      CREATE TABLE analytics.current_customers AS
      SELECT 
        customer_id,
        email,
        updated_at,
        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC) as row_num
      FROM raw_vault.customer_events
      QUALIFY row_num = 1;
    `,
    expectedSourceTables: ["raw_vault.customer_events"],
    expectedTargetTables: ["analytics.current_customers"],
    expectedColumns: [
      { targetColumn: "customer_id", sourceTable: "raw_vault.customer_events", sourceColumn: "customer_id" },
      { targetColumn: "email", sourceTable: "raw_vault.customer_events", sourceColumn: "email" },
    ],
    featuresTested: ["QUALIFY clause", "CREATE TABLE AS SELECT", "PARTITION BY"],
  },
  {
    id: "bigquery_pivot_sales",
    dialect: "bigquery",
    name: "BigQuery PIVOT Quarterly Sales",
    description: "Tests analytical PIVOT statement parsing and projected column attribution",
    sql: `
      INSERT INTO marts.quarterly_revenue (product_id, q1_rev, q2_rev, q3_rev, q4_rev)
      SELECT * FROM (
        SELECT product_id, quarter, revenue
        FROM raw_pos.transaction_lines
      )
      PIVOT(SUM(revenue) FOR quarter IN ('Q1' AS q1_rev, 'Q2' AS q2_rev, 'Q3' AS q3_rev, 'Q4' AS q4_rev));
    `,
    expectedSourceTables: ["raw_pos.transaction_lines"],
    expectedTargetTables: ["marts.quarterly_revenue"],
    expectedColumns: [
      { targetColumn: "product_id", sourceTable: "raw_pos.transaction_lines", sourceColumn: "product_id" },
      { targetColumn: "q1_rev", sourceTable: "raw_pos.transaction_lines", sourceColumn: "revenue" },
    ],
    featuresTested: ["PIVOT clause", "Nested Subquery", "Column Aliasing"],
  },
  {
    id: "databricks_merge_scd2",
    dialect: "databricks",
    name: "Databricks Delta MERGE INTO Target",
    description: "Tests MERGE INTO statement parsing with matched and unmatched clauses",
    sql: `
      MERGE INTO dw.dim_user AS target
      USING staging.stg_user AS source
      ON target.user_id = source.user_id
      WHEN MATCHED AND target.hash_diff != source.hash_diff THEN
        UPDATE SET target.is_active = false, target.end_date = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN
        INSERT (user_id, email, is_active, start_date)
        VALUES (source.user_id, source.email, true, CURRENT_TIMESTAMP());
    `,
    expectedSourceTables: ["staging.stg_user"],
    expectedTargetTables: ["dw.dim_user"],
    expectedColumns: [
      { targetColumn: "user_id", sourceTable: "staging.stg_user", sourceColumn: "user_id" },
      { targetColumn: "email", sourceTable: "staging.stg_user", sourceColumn: "email" },
    ],
    featuresTested: ["MERGE INTO", "WHEN MATCHED", "WHEN NOT MATCHED"],
  },
  {
    id: "duckdb_exclude_projection",
    dialect: "duckdb",
    name: "DuckDB SELECT * EXCLUDE Syntax",
    description: "Tests DuckDB projection modifiers with star expansion and exclude filters",
    sql: `
      CREATE VIEW mart.clean_orders AS
      SELECT * EXCLUDE (internal_hash, _fivetran_synced),
             amount * 1.05 as gross_amount
      FROM raw.orders
      LEFT JOIN raw.order_metadata USING (order_id);
    `,
    expectedSourceTables: ["raw.orders", "raw.order_metadata"],
    expectedTargetTables: ["mart.clean_orders"],
    expectedColumns: [{ targetColumn: "gross_amount", sourceTable: "raw.orders", sourceColumn: "amount" }],
    featuresTested: ["SELECT * EXCLUDE", "USING join", "CREATE VIEW"],
  },
  {
    id: "mysql_multi_joins",
    dialect: "mysql",
    name: "MySQL Multi-Table Join & Subquery",
    description: "Tests inner, left, and cross joins across multiple normalized entities",
    sql: `
      INSERT INTO dwh.order_facts (order_id, customer_name, product_sku, final_price)
      SELECT 
        o.id,
        c.full_name,
        p.sku,
        (oi.unit_price * oi.quantity) - oi.discount
      FROM orders o
      INNER JOIN order_items oi ON o.id = oi.order_id
      INNER JOIN products p ON oi.product_id = p.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.status = 'completed';
    `,
    expectedSourceTables: ["orders", "order_items", "products", "customers"],
    expectedTargetTables: ["dwh.order_facts"],
    expectedColumns: [
      { targetColumn: "order_id", sourceTable: "orders", sourceColumn: "id" },
      { targetColumn: "customer_name", sourceTable: "customers", sourceColumn: "full_name" },
      { targetColumn: "product_sku", sourceTable: "products", sourceColumn: "sku" },
    ],
    featuresTested: ["Multi-table JOINs", "Arithmetic Expressions", "WHERE Filter"],
  },
  {
    id: "mssql_cross_apply",
    dialect: "mssql",
    name: "T-SQL CROSS APPLY with XML or JSON Parsing",
    description: "Tests SQL Server CROSS APPLY correlation and window ranking",
    sql: `
      SELECT 
        d.department_name,
        e.employee_name,
        e.salary
      FROM departments d
      CROSS APPLY (
        SELECT TOP 3 employee_name, salary
        FROM employees emp
        WHERE emp.department_id = d.id
        ORDER BY salary DESC
      ) e;
    `,
    expectedSourceTables: ["departments", "employees"],
    expectedTargetTables: [],
    featuresTested: ["CROSS APPLY", "TOP clause", "Correlated Subquery"],
  },
];
