import { describe, it, expect } from 'vitest';
import { parseSQLLineage } from '@/lineage/parser/sqlLineageParser';

describe('Rank Lineage & Customer 360 Flow', () => {
  it('correctly maps window function rank and WHERE filter dependency', () => {
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
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);

    const finalEdge = res.graph?.edges.find(e => e.target === 'final_query_1' && e.source === 'cte_topcustomers');
    expect(finalEdge).toBeDefined();

    // Direct rank to rank mapping
    const directRank = finalEdge?.columnLineage?.find(c => c.targetColumnName === 'rank' && c.isDirect);
    expect(directRank).toBeDefined();
    expect(directRank?.sourceColumnName).toBe('rank');

    // Indirect WHERE rank <= 5 mapping
    const whereRank = finalEdge?.columnLineage?.find(c => c.sourceColumnName === 'rank' && c.context === 'where');
    expect(whereRank).toBeDefined();
    expect(whereRank?.isDirect).toBe(false);

    // MonthlySales to TopCustomers rank depends on country and total_amount
    const topCustEdge = res.graph?.edges.find(e => e.target === 'cte_topcustomers' && e.source === 'cte_monthlysales');
    expect(topCustEdge).toBeDefined();
    const rankSources = topCustEdge?.columnLineage?.filter(c => c.targetColumnName === 'rank').map(c => c.sourceColumnName);
    expect(rankSources).toContain('country');
    expect(rankSources).toContain('total_amount');
  });

  it('correctly processes Customer 360 query with UNION ALL and where filters', () => {
    const sql = `
    WITH WebVisits AS (
      SELECT user_id AS customer_id, event_time, 'WEB_VISIT' AS activity_type
      FROM web_analytics.events
      WHERE event_type = 'page_view'
    ),
    Purchases AS (
      SELECT customer_id, order_date AS event_time, 'PURCHASE' AS activity_type
      FROM sales.orders
      WHERE status = 'PAID'
    ),
    AllActivities AS (
      SELECT customer_id, event_time, activity_type FROM WebVisits
      UNION ALL
      SELECT customer_id, event_time, activity_type FROM Purchases
    )
    SELECT * FROM AllActivities;
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);

    const eventsNode = res.graph?.nodes.find(n => n.id === 'table_events');
    const ordersNode = res.graph?.nodes.find(n => n.id === 'table_orders');
    const allActivitiesNode = res.graph?.nodes.find(n => n.id === 'cte_allactivities');

    expect(eventsNode).toBeDefined();
    expect(ordersNode).toBeDefined();
    expect(allActivitiesNode).toBeDefined();

    // Verify filter columns exist in source tables
    expect(eventsNode?.columns.some(c => c.name === 'event_type')).toBe(true);
    expect(ordersNode?.columns.some(c => c.name === 'status')).toBe(true);

    // Verify AllActivities receives edges from BOTH WebVisits and Purchases
    const webVisitsEdge = res.graph?.edges.find(e => e.target === 'cte_allactivities' && e.source === 'cte_webvisits');
    const purchasesEdge = res.graph?.edges.find(e => e.target === 'cte_allactivities' && e.source === 'cte_purchases');

    expect(webVisitsEdge).toBeDefined();
    expect(purchasesEdge).toBeDefined();
    expect(webVisitsEdge?.columnLineage?.length).toBeGreaterThan(0);
    expect(purchasesEdge?.columnLineage?.length).toBeGreaterThan(0);
  });
});
