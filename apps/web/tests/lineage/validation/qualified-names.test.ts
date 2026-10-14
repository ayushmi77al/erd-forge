import { describe, it, expect } from 'vitest';
import { parseSQLLineage } from '@/lineage/parser/sqlLineageParser';

describe('Qualified Identifiers & Table Names', () => {
  it('3.1 handles schema-qualified tables (e.g. schema.table)', () => {
    const sql = `
      SELECT e.event_id, e.payload
      FROM analytics_db.events e
      WHERE e.event_type = 'click';
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);

    const eventNode = res.graph?.nodes.find((n) => n.name === 'events' || n.id === 'table_events');
    expect(eventNode).toBeDefined();
    expect(eventNode?.columns.some((c) => c.name === 'event_id')).toBe(true);
    expect(eventNode?.columns.some((c) => c.name === 'payload')).toBe(true);
    expect(eventNode?.columns.some((c) => c.name === 'event_type')).toBe(true);
  });

  it('3.2 handles multiple schema-qualified tables in a JOIN', () => {
    const sql = `
      SELECT o.order_id, u.user_name
      FROM store_prod.orders o
      JOIN auth_prod.users u ON o.user_id = u.user_id;
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);

    const ordersNode = res.graph?.nodes.find((n) => n.name === 'orders');
    const usersNode = res.graph?.nodes.find((n) => n.name === 'users');
    expect(ordersNode).toBeDefined();
    expect(usersNode).toBeDefined();
  });
});
