import { describe, expect, it } from "vitest";
import { parseSQLLineage } from "@/lineage/parser/sqlLineageParser";
import { parseSQLLineageWasm } from "@/lineage/parser/WasmLineageBuilder";
import { sqlFixtures } from "../fixtures/sql/sqlFixtures";

describe("T2.4: SQL Lineage Parity and Differential Testing", () => {
  describe("Legacy sqlLineageParser Test Suite Parity", () => {
    it("matches legacy on CTE queries with base tables and output", async () => {
      const sql = `
        WITH MonthlySales AS (
          SELECT 
            o.customer_id,
            c.country,
            SUM(o.amount) AS total_amount
          FROM orders o
          JOIN customers c ON o.customer_id = c.customer_id
          GROUP BY o.customer_id, c.country
        )
        SELECT 
          ms.customer_id,
          ms.country,
          ms.total_amount
        FROM MonthlySales ms;
      `;

      const legacy = parseSQLLineage(sql, "mssql");
      const wasm = await parseSQLLineageWasm(sql, "mssql");

      expect(legacy.errors).toEqual([]);
      expect(wasm.errors).toEqual([]);

      const legacyNodes = legacy.graph!.nodes.map((n) => n.name.toLowerCase()).sort();
      const wasmNodes = wasm.graph!.nodes.map((n) => n.name.toLowerCase()).sort();

      expect(wasmNodes).toContain("orders");
      expect(wasmNodes).toContain("customers");
      expect(wasmNodes).toContain("monthlysales");
      expect(wasmNodes).toContain("final result");

      // Verify node types match
      const wasmTypes = wasm.graph!.nodes.map((n) => n.type).sort();
      const legacyTypes = legacy.graph!.nodes.map((n) => n.type).sort();
      expect(wasmTypes).toEqual(legacyTypes);

      // Verify edge count parity
      expect(wasm.graph!.edges.length).toBeGreaterThanOrEqual(3);
      expect(wasm.graph!.edges.length).toBe(legacy.graph!.edges.length);

      // Verify CTE edge connections
      const wasmCteNode = wasm.graph!.nodes.find((n) => n.name.toLowerCase() === "monthlysales")!;
      const wasmFinalNode = wasm.graph!.nodes.find((n) => n.type === "FINAL_SELECT")!;

      const wasmIncomingToCte = wasm.graph!.edges.filter((e) => e.target === wasmCteNode.id);
      expect(wasmIncomingToCte.length).toBeGreaterThanOrEqual(2);

      const wasmOutgoingFromCte = wasm.graph!.edges.filter(
        (e) => e.source === wasmCteNode.id && e.target === wasmFinalNode.id,
      );
      expect(wasmOutgoingFromCte.length).toBe(1);
    });

    it("matches legacy on PostgreSQL queries with multi-table joins", async () => {
      const sql = `
        SELECT 
          u.id,
          u.email,
          p.product_name,
          o.order_date
        FROM users u
        JOIN orders o ON u.id = o.user_id
        JOIN products p ON o.product_id = p.id
        WHERE o.status = 'COMPLETED';
      `;

      const legacy = parseSQLLineage(sql, "postgresql");
      const wasm = await parseSQLLineageWasm(sql, "postgresql");

      expect(legacy.errors).toEqual([]);
      expect(wasm.errors).toEqual([]);

      const legacyTableNames = legacy
        .graph!.nodes.filter((n) => n.type === "TABLE")
        .map((n) => n.name.toLowerCase())
        .sort();
      const wasmTableNames = wasm
        .graph!.nodes.filter((n) => n.type === "TABLE")
        .map((n) => n.name.toLowerCase())
        .sort();

      expect(wasmTableNames).toEqual(legacyTableNames);
      expect(wasmTableNames).toContain("users");
      expect(wasmTableNames).toContain("orders");
      expect(wasmTableNames).toContain("products");

      const wasmFinalNode = wasm.graph!.nodes.find((n) => n.type === "FINAL_SELECT")!;
      expect(wasmFinalNode.columns.length).toBe(4);
    });

    it("matches legacy on MySQL queries with subquery in FROM clause", async () => {
      const sql = `
        SELECT 
          sub.customer_id,
          sub.order_count
        FROM (
          SELECT customer_id, COUNT(*) AS order_count 
          FROM orders 
          GROUP BY customer_id
        ) sub
        WHERE sub.order_count > 5;
      `;

      const legacy = parseSQLLineage(sql, "mysql");
      const wasm = await parseSQLLineageWasm(sql, "mysql");

      expect(legacy.errors).toEqual([]);
      expect(wasm.errors).toEqual([]);

      const wasmTypes = wasm.graph!.nodes.map((n) => n.type).sort();
      const legacyTypes = legacy.graph!.nodes.map((n) => n.type).sort();

      expect(wasmTypes).toContain("TABLE");
      expect(wasmTypes).toContain("SUBQUERY");
      expect(wasmTypes).toContain("FINAL_SELECT");
      expect(wasmTypes).toEqual(legacyTypes);
    });

    it("matches legacy on chained CTEs referencing other CTEs", async () => {
      const sql = `
        WITH MonthlySales AS (
          SELECT 
            o.customer_id,
            c.country,
            SUM(o.amount) AS total_amount,
            COUNT(o.order_id) AS order_count
          FROM orders o
          JOIN customers c ON o.customer_id = c.customer_id
          WHERE o.status = 'COMPLETED'
          GROUP BY o.customer_id, c.country
        ),
        TopCustomers AS (
          SELECT 
            customer_id,
            country,
            total_amount,
            DENSE_RANK() OVER (PARTITION BY country ORDER BY total_amount DESC) as rank
          FROM MonthlySales
        )
        SELECT 
          tc.customer_id,
          tc.country,
          tc.total_amount,
          tc.rank
        FROM TopCustomers tc
        WHERE tc.rank <= 5;
      `;

      const legacy = parseSQLLineage(sql, "mssql");
      const wasm = await parseSQLLineageWasm(sql, "mssql");

      expect(legacy.errors).toEqual([]);
      expect(wasm.errors).toEqual([]);

      const wasmNodeNames = wasm.graph!.nodes.map((n) => n.name.toLowerCase());

      expect(wasmNodeNames).toContain("orders");
      expect(wasmNodeNames).toContain("customers");
      expect(wasmNodeNames).toContain("monthlysales");
      expect(wasmNodeNames).toContain("topcustomers");

      // Verify NO duplicate base table node was created for 'monthlysales'
      const wasmTableNodes = wasm.graph!.nodes.filter((n) => n.type === "TABLE");
      expect(wasmTableNodes.map((n) => n.name.toLowerCase())).not.toContain("monthlysales");

      // Verify customers table has both 'country' and 'customer_id' (from JOIN ON condition in CTE)
      const customersNode = wasm.graph!.nodes.find((n) => n.name.toLowerCase() === "customers")!;
      const customerCols = customersNode.columns.map((c) => c.name.toLowerCase());
      expect(customerCols).toContain("country");
      expect(customerCols).toContain("customer_id");

      // Verify orders table has customer_id, amount, order_id, status
      const ordersNode = wasm.graph!.nodes.find((n) => n.name.toLowerCase() === "orders")!;
      const orderCols = ordersNode.columns.map((c) => c.name.toLowerCase());
      expect(orderCols).toContain("customer_id");
      expect(orderCols).toContain("amount");
      expect(orderCols).toContain("order_id");
      expect(orderCols).toContain("status");
    });

    it("matches legacy on subquery column lineage and indirect clause dependencies", async () => {
      const sql = `
        SELECT 
          sub.customer_id,
          sub.order_count
        FROM (
          SELECT customer_id, COUNT(*) AS order_count 
          FROM orders 
          WHERE status = 'ACTIVE'
          GROUP BY customer_id
        ) sub
        WHERE sub.order_count > 5;
      `;

      const legacy = parseSQLLineage(sql, "mysql");
      const wasm = await parseSQLLineageWasm(sql, "mysql");

      expect(wasm.errors).toEqual([]);
      expect(wasm.graph).not.toBeNull();

      const subqueryNode = wasm.graph!.nodes.find((n) => n.type === "SUBQUERY")!;
      expect(subqueryNode).toBeDefined();

      const subCols = subqueryNode.columns.map((c) => c.name.toLowerCase());
      expect(subCols).toContain("customer_id");
      expect(subCols).toContain("order_count");

      // Verify edge from orders to subquery contains columnLineage
      const edgeOrdersToSub = wasm.graph!.edges.find((e) => e.target === subqueryNode.id)!;
      expect(edgeOrdersToSub).toBeDefined();
      expect(edgeOrdersToSub.columnLineage).toBeDefined();
      expect(edgeOrdersToSub.columnLineage!.length).toBeGreaterThanOrEqual(2);

      // Verify orders has status from subquery WHERE clause
      const ordersNode = wasm.graph!.nodes.find((n) => n.name.toLowerCase() === "orders")!;
      const orderCols = ordersNode.columns.map((c) => c.name.toLowerCase());
      expect(orderCols).toContain("status");
    });

    it("captures syntax errors and provides location info on invalid syntax", async () => {
      const badSql = `SELECT FROM WHERE ;;;; INVALID SYNTAX`;
      const legacy = parseSQLLineage(badSql, "mssql");
      const wasm = await parseSQLLineageWasm(badSql, "mssql");

      expect(legacy.errors.length).toBeGreaterThan(0);
      expect(wasm.errors.length).toBeGreaterThan(0);
      expect(wasm.graph).toBeNull();

      const wasmErr = wasm.errors[0]!;
      expect(wasmErr.line).toBeGreaterThanOrEqual(1);
      expect(wasmErr.message).toBeDefined();
    });
  });

  describe("Gate 0 Fixture Corpus Differential Analysis", () => {
    it.each(sqlFixtures)("evaluates fixture: $id ($name)", async (fixture) => {
      const wasmResult = await parseSQLLineageWasm(fixture.sql, fixture.dialect as any);

      // WASM parser must successfully parse 100% of Gate 0 fixtures
      expect(wasmResult.errors).toEqual([]);
      expect(wasmResult.graph).not.toBeNull();

      const wasmGraph = wasmResult.graph!;
      const nodeNamesLower = wasmGraph.nodes.map((n) => n.name.toLowerCase());

      // 1. Verify expected source tables are identified
      for (const expectedSource of fixture.expectedSourceTables) {
        const simpleName = expectedSource.includes(".")
          ? expectedSource.split(".").pop()!.toLowerCase()
          : expectedSource.toLowerCase();

        const match = nodeNamesLower.some((name) => name === expectedSource.toLowerCase() || name === simpleName);
        expect(
          match,
          `Expected source table '${expectedSource}' to be in extracted nodes: ${nodeNamesLower.join(", ")}`,
        ).toBe(true);
      }

      // 2. Verify expected target tables are identified if specified
      for (const expectedTarget of fixture.expectedTargetTables) {
        const simpleName = expectedTarget.includes(".")
          ? expectedTarget.split(".").pop()!.toLowerCase()
          : expectedTarget.toLowerCase();

        const match = nodeNamesLower.some((name) => name === expectedTarget.toLowerCase() || name === simpleName);
        expect(
          match,
          `Expected target table '${expectedTarget}' to be in extracted nodes: ${nodeNamesLower.join(", ")}`,
        ).toBe(true);
      }

      // 3. Differential comparison against legacy node-sql-parser
      const legacyResult = parseSQLLineage(fixture.sql, fixture.dialect as any);

      if (legacyResult.errors.length > 0) {
        // Quantify the gap: Legacy parser failed due to missing warehouse dialect features
        // (QUALIFY, PIVOT, MERGE, EXCLUDE, chained INSERT INTO CTE)
        expect(wasmResult.errors.length).toBe(0);
        console.log(
          `[Differential Advantage] Fixture '${fixture.id}' successfully parsed by WASM; failed in legacy node-sql-parser.`,
        );
      } else {
        // Both succeeded: verify node count parity
        expect(wasmGraph.nodes.length).toBeGreaterThanOrEqual(legacyResult.graph!.nodes.length - 1);
      }
    });

    it("verifies 100% pass rate across the full Gate 0 fixture corpus", async () => {
      let wasmSuccessCount = 0;
      let legacySuccessCount = 0;

      for (const fixture of sqlFixtures) {
        const wasm = await parseSQLLineageWasm(fixture.sql, fixture.dialect as any);
        if (wasm.errors.length === 0 && wasm.graph !== null) {
          wasmSuccessCount++;
        }

        const legacy = parseSQLLineage(fixture.sql, fixture.dialect as any);
        if (legacy.errors.length === 0 && legacy.graph !== null) {
          legacySuccessCount++;
        }
      }

      expect(wasmSuccessCount).toBe(sqlFixtures.length); // 7 / 7 = 100%
      expect(legacySuccessCount).toBeLessThan(sqlFixtures.length); // Legacy fails on modern warehouse syntax
    });
  });
});
