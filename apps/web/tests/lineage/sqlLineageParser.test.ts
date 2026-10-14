import { describe, it, expect } from 'vitest';
import { parseSQLLineage } from '@/lineage/parser/sqlLineageParser';
import { calculateLineageLayout } from '@/lineage/layout/lineageLayout';

describe('sqlLineageParser', () => {
  it('parses CTE queries in MSSQL (T-SQL) with base tables and output', () => {
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

    const result = parseSQLLineage(sql, 'mssql');

    expect(result.errors).toHaveLength(0);
    expect(result.graph).not.toBeNull();

    const graph = result.graph!;
    const nodeNames = graph.nodes.map((n) => n.name.toLowerCase());

    // Expect base tables
    expect(nodeNames).toContain('orders');
    expect(nodeNames).toContain('customers');

    // Expect CTE
    expect(nodeNames).toContain('monthlysales');

    // Expect Final Result
    const finalNode = graph.nodes.find((n) => n.type === 'FINAL_SELECT');
    expect(finalNode).toBeDefined();

    // Verify edges exist
    expect(graph.edges.length).toBeGreaterThanOrEqual(3);

    // Verify MonthlySales receives data from orders & customers
    const cteNode = graph.nodes.find((n) => n.name.toLowerCase() === 'monthlysales')!;
    const incomingToCte = graph.edges.filter((e) => e.target === cteNode.id);
    expect(incomingToCte.length).toBeGreaterThanOrEqual(2);

    // Verify MonthlySales feeds into final query
    const outgoingFromCte = graph.edges.filter((e) => e.source === cteNode.id && e.target === finalNode!.id);
    expect(outgoingFromCte.length).toBe(1);
  });

  it('parses PostgreSQL queries with multiple tables', () => {
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

    const result = parseSQLLineage(sql, 'postgresql');

    expect(result.errors).toHaveLength(0);
    expect(result.graph).not.toBeNull();

    const graph = result.graph!;
    const tableNodes = graph.nodes.filter((n) => n.type === 'TABLE');

    expect(tableNodes.map((n) => n.name.toLowerCase())).toContain('users');
    expect(tableNodes.map((n) => n.name.toLowerCase())).toContain('orders');
    expect(tableNodes.map((n) => n.name.toLowerCase())).toContain('products');

    const finalNode = graph.nodes.find((n) => n.type === 'FINAL_SELECT')!;
    expect(finalNode.columns.length).toBe(4);
  });

  it('parses MySQL queries with subquery in FROM clause', () => {
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

    const result = parseSQLLineage(sql, 'mysql');

    expect(result.errors).toHaveLength(0);
    expect(result.graph).not.toBeNull();

    const graph = result.graph!;
    const nodeTypes = graph.nodes.map((n) => n.type);

    expect(nodeTypes).toContain('TABLE');
    expect(nodeTypes).toContain('SUBQUERY');
    expect(nodeTypes).toContain('FINAL_SELECT');
  });

  it('captures syntax errors and provides line/column info', () => {
    const badSql = `SELECT FROM WHERE ;;;; INVALID SYNTAX`;
    const result = parseSQLLineage(badSql, 'mssql');

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.graph).toBeNull();
    const firstErr = result.errors[0]!;
    expect(firstErr.line).toBeGreaterThanOrEqual(1);
    expect(firstErr.message).toBeDefined();
  });

  it('computes Left-to-Right layout positions hierarchy', () => {
    const sql = `
      WITH Step1 AS (
        SELECT id, val FROM source_table
      )
      SELECT id, val FROM Step1;
    `;

    const result = parseSQLLineage(sql, 'mssql');
    const graph = result.graph!;

    const positions = calculateLineageLayout(graph.nodes, graph.edges, { direction: 'LR' });

    const srcPos = positions.get('table_source_table');
    const ctePos = positions.get('cte_step1');
    const finalPos = positions.get('final_query_1');

    expect(srcPos).toBeDefined();
    expect(ctePos).toBeDefined();
    expect(finalPos).toBeDefined();

    // Source table must be to the left of CTE, and CTE to the left of final query
    expect(srcPos!.x).toBeLessThan(ctePos!.x);
    expect(ctePos!.x).toBeLessThan(finalPos!.x);
  });

  it('correctly links chained CTEs referencing other CTEs', () => {
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

    const result = parseSQLLineage(sql, 'mssql');

    expect(result.errors).toHaveLength(0);
    expect(result.graph).not.toBeNull();

    const graph = result.graph!;
    const nodeNames = graph.nodes.map((n) => n.name.toLowerCase());

    // Expect base tables
    expect(nodeNames).toContain('orders');
    expect(nodeNames).toContain('customers');

    // Expect both CTEs
    expect(nodeNames).toContain('monthlysales');
    expect(nodeNames).toContain('topcustomers');

    // Expect Final Result
    const finalNode = graph.nodes.find((n) => n.type === 'FINAL_SELECT');
    expect(finalNode).toBeDefined();

    // Verify CTE MonthlySales is linked to TopCustomers
    const monthlySalesNode = graph.nodes.find((n) => n.name.toLowerCase() === 'monthlysales')!;
    const topCustomersNode = graph.nodes.find((n) => n.name.toLowerCase() === 'topcustomers')!;

    const edgeMonthlyToTop = graph.edges.find(
      (e) => e.source === monthlySalesNode.id && e.target === topCustomersNode.id
    );
    expect(edgeMonthlyToTop).toBeDefined();

    // Verify TopCustomers is linked to Final Result
    const edgeTopToFinal = graph.edges.find(
      (e) => e.source === topCustomersNode.id && e.target === finalNode!.id
    );
    expect(edgeTopToFinal).toBeDefined();

    // Verify NO duplicate base table node was created for 'monthlysales'
    const tableNodes = graph.nodes.filter((n) => n.type === 'TABLE');
    expect(tableNodes.map((n) => n.name.toLowerCase())).not.toContain('monthlysales');

    // Verify customers table has both 'country' and 'customer_id' (from JOIN ON condition in CTE)
    const customersNode = graph.nodes.find((n) => n.name.toLowerCase() === 'customers')!;
    const customerCols = customersNode.columns.map((c) => c.name.toLowerCase());
    expect(customerCols).toContain('country');
    expect(customerCols).toContain('customer_id');

    // Verify orders table has customer_id, amount, order_id, status
    const ordersNode = graph.nodes.find((n) => n.name.toLowerCase() === 'orders')!;
    const orderCols = ordersNode.columns.map((c) => c.name.toLowerCase());
    expect(orderCols).toContain('customer_id');
    expect(orderCols).toContain('amount');
    expect(orderCols).toContain('order_id');
    expect(orderCols).toContain('status');
  });

  it('extracts column-level lineage and indirect clause dependencies for subqueries in FROM clause', () => {
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

    const result = parseSQLLineage(sql, 'mysql');

    expect(result.errors).toHaveLength(0);
    expect(result.graph).not.toBeNull();

    const graph = result.graph!;
    const subqueryNode = graph.nodes.find((n) => n.type === 'SUBQUERY')!;
    expect(subqueryNode).toBeDefined();

    // Verify subquery has customer_id and order_count
    const subCols = subqueryNode.columns.map((c) => c.name.toLowerCase());
    expect(subCols).toContain('customer_id');
    expect(subCols).toContain('order_count');

    // Verify edge from orders to subquery contains columnLineage
    const edgeOrdersToSub = graph.edges.find((e) => e.target === subqueryNode.id)!;
    expect(edgeOrdersToSub).toBeDefined();
    expect(edgeOrdersToSub.columnLineage).toBeDefined();
    expect(edgeOrdersToSub.columnLineage!.length).toBeGreaterThanOrEqual(2);

    // Verify orders has status from subquery WHERE clause
    const ordersNode = graph.nodes.find((n) => n.name.toLowerCase() === 'orders')!;
    const orderCols = ordersNode.columns.map((c) => c.name.toLowerCase());
    expect(orderCols).toContain('status');
  });
});
