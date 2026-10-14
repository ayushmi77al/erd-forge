import { describe, it, expect } from 'vitest';
import { parseSQLLineage } from '@/lineage/parser/sqlLineageParser';

describe('CTE Scope Isolation & Multi-CTE Pipelines', () => {
  it('2.1 prevents single-table heuristic from falsely linking first CTE to itself', () => {
    const sql = `
      WITH FirstCTE AS (
        SELECT user_id, event_time FROM raw_events WHERE event_type = 'page_view'
      )
      SELECT user_id FROM FirstCTE;
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);

    const rawEventsNode = res.graph?.nodes.find((n) => n.id === 'table_raw_events');
    expect(rawEventsNode).toBeDefined();
    // raw_events must have event_type (from WHERE clause)
    expect(rawEventsNode?.columns.some((c) => c.name === 'event_type')).toBe(true);

    const edge = res.graph?.edges.find((e) => e.source === 'table_raw_events' && e.target === 'cte_firstcte');
    expect(edge).toBeDefined();
    // Must include event_type as indirect where mapping
    const whereMapping = edge?.columnLineage?.find((c) => c.sourceColumnName === 'event_type');
    expect(whereMapping).toBeDefined();
    expect(whereMapping?.isDirect).toBe(false);
  });

  it('2.2 resolves multi-level chained CTEs (A -> B -> C -> Final)', () => {
    const sql = `
      WITH StepA AS (
        SELECT id, amount FROM transactions WHERE status = 'SUCCESS'
      ),
      StepB AS (
        SELECT id, amount * 1.1 AS amount_with_tax FROM StepA
      ),
      StepC AS (
        SELECT id, amount_with_tax, DENSE_RANK() OVER (ORDER BY amount_with_tax DESC) AS rank FROM StepB
      )
      SELECT id, rank FROM StepC WHERE rank <= 10;
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);

    const edgeA = res.graph?.edges.find((e) => e.source === 'table_transactions' && e.target === 'cte_stepa');
    const edgeB = res.graph?.edges.find((e) => e.source === 'cte_stepa' && e.target === 'cte_stepb');
    const edgeC = res.graph?.edges.find((e) => e.source === 'cte_stepb' && e.target === 'cte_stepc');
    const edgeFinal = res.graph?.edges.find((e) => e.source === 'cte_stepc' && e.target === 'final_query_1');

    expect(edgeA).toBeDefined();
    expect(edgeB).toBeDefined();
    expect(edgeC).toBeDefined();
    expect(edgeFinal).toBeDefined();
  });

  it('2.3 keeps sibling CTEs completely isolated from cross-polluting scopes', () => {
    const sql = `
      WITH Sibling1 AS (
        SELECT user_id, email FROM users_table WHERE is_active = true
      ),
      Sibling2 AS (
        SELECT order_id, total FROM orders_table WHERE is_paid = true
      )
      SELECT s1.email, s2.total
      FROM Sibling1 s1
      JOIN Sibling2 s2 ON s1.user_id = s2.order_id;
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);

    const usersNode = res.graph?.nodes.find((n) => n.id === 'table_users_table');
    const ordersNode = res.graph?.nodes.find((n) => n.id === 'table_orders_table');

    // Users must NOT have is_paid
    expect(usersNode?.columns.some((c) => c.name === 'is_paid')).toBe(false);
    expect(usersNode?.columns.some((c) => c.name === 'is_active')).toBe(true);

    // Orders must NOT have is_active
    expect(ordersNode?.columns.some((c) => c.name === 'is_active')).toBe(false);
    expect(ordersNode?.columns.some((c) => c.name === 'is_paid')).toBe(true);
  });
});
