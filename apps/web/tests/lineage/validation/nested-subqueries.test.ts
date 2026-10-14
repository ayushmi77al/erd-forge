import { describe, it, expect } from 'vitest';
import { parseSQLLineage } from '@/lineage/parser/sqlLineageParser';

describe('Derived Tables & Nested Subqueries', () => {
  it('5.1 correctly parses derived table in FROM clause with column lineage', () => {
    const sql = `
      SELECT sub.category, sub.total_sales
      FROM (
        SELECT category, SUM(amount) AS total_sales
        FROM sales_records
        GROUP BY category
      ) sub
      WHERE sub.total_sales > 1000;
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);

    const subqueryNode = res.graph?.nodes.find((n) => n.type === 'SUBQUERY');
    expect(subqueryNode).toBeDefined();
    expect(subqueryNode?.columns.some((c) => c.name === 'total_sales')).toBe(true);
    expect(subqueryNode?.columns.some((c) => c.name === 'category')).toBe(true);

    const edgeToSub = res.graph?.edges.find((e) => e.target === subqueryNode?.id);
    expect(edgeToSub?.source).toBe('table_sales_records');
    expect(edgeToSub?.columnLineage?.length).toBeGreaterThan(0);
  });

  it('5.2 handles derived table with internal WHERE clause', () => {
    const sql = `
      SELECT o.order_id
      FROM (
        SELECT order_id, status FROM raw_orders WHERE is_deleted = false
      ) o
      WHERE o.status = 'ACTIVE';
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);

    const rawNode = res.graph?.nodes.find((n) => n.id === 'table_raw_orders');
    expect(rawNode?.columns.some((c) => c.name === 'is_deleted')).toBe(true);
  });
});
