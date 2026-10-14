import { describe, it, expect } from 'vitest';
import { parseSQLLineage } from '@/lineage/parser/sqlLineageParser';

describe('Set Operations (UNION / UNION ALL / INTERSECT)', () => {
  it('1.1 correctly parses simple UNION ALL in a CTE', () => {
    const sql = `
      WITH Combined AS (
        SELECT id, name FROM users
        UNION ALL
        SELECT id, name FROM admins
      )
      SELECT id, name FROM Combined;
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);
    const combinedNode = res.graph?.nodes.find((n) => n.id === 'cte_combined');
    expect(combinedNode).toBeDefined();
    expect(combinedNode?.columns).toHaveLength(2);

    const edges = res.graph?.edges.filter((e) => e.target === 'cte_combined');
    expect(edges).toHaveLength(2);
    const sources = edges?.map((e) => e.source).sort();
    expect(sources).toEqual(['table_admins', 'table_users']);

    // Check column lineage for both branches
    const userEdge = edges?.find((e) => e.source === 'table_users');
    const adminEdge = edges?.find((e) => e.source === 'table_admins');
    expect(userEdge?.columnLineage).toHaveLength(2);
    expect(adminEdge?.columnLineage).toHaveLength(2);
  });

  it('1.2 correctly handles 3-way chained UNION ALL (N-way set operations)', () => {
    const sql = `
      WITH AllRoles AS (
        SELECT user_id, 'viewer' AS role FROM viewers
        UNION ALL
        SELECT user_id, 'editor' AS role FROM editors
        UNION ALL
        SELECT user_id, 'admin' AS role FROM admins
      )
      SELECT * FROM AllRoles;
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);
    const edges = res.graph?.edges.filter((e) => e.target === 'cte_allroles');
    expect(edges).toHaveLength(3);
    const sources = edges?.map((e) => e.source).sort();
    expect(sources).toEqual(['table_admins', 'table_editors', 'table_viewers']);
  });

  it('1.3 maintains column-by-column positional alignment across branches', () => {
    const sql = `
      WITH Feed AS (
        SELECT post_id AS item_id, created_at AS timestamp FROM posts
        UNION ALL
        SELECT comment_id AS item_id, posted_at AS timestamp FROM comments
      )
      SELECT item_id, timestamp FROM Feed;
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);
    const feedNode = res.graph?.nodes.find((n) => n.id === 'cte_feed');
    expect(feedNode?.columns[0]?.name).toBe('item_id');
    expect(feedNode?.columns[1]?.name).toBe('timestamp');

    // item_id sources should have both post_id and comment_id
    const itemIdSources = feedNode?.columns[0]?.sources.map((s) => s.column);
    expect(itemIdSources).toContain('post_id');
    expect(itemIdSources).toContain('comment_id');

    // timestamp sources should have both created_at and posted_at
    const timestampSources = feedNode?.columns[1]?.sources.map((s) => s.column);
    expect(timestampSources).toContain('created_at');
    expect(timestampSources).toContain('posted_at');
  });

  it('1.4 correctly handles UNION in the main final query', () => {
    const sql = `
      SELECT id, name FROM users
      UNION ALL
      SELECT id, name FROM archived_users;
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);
    const finalNode = res.graph?.nodes.find((n) => n.type === 'FINAL_SELECT');
    expect(finalNode).toBeDefined();

    const edges = res.graph?.edges.filter((e) => e.target === finalNode?.id);
    expect(edges).toHaveLength(2);
    const sources = edges?.map((e) => e.source).sort();
    expect(sources).toEqual(['table_archived_users', 'table_users']);
  });

  it('1.5 captures branch-specific WHERE clause filters in a UNION query', () => {
    const sql = `
      WITH FilteredStream AS (
        SELECT user_id, action FROM app_logs WHERE action = 'login'
        UNION ALL
        SELECT user_id, action FROM audit_logs WHERE severity = 'HIGH'
      )
      SELECT * FROM FilteredStream;
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);
    const appLogNode = res.graph?.nodes.find((n) => n.id === 'table_app_logs');
    const auditLogNode = res.graph?.nodes.find((n) => n.id === 'table_audit_logs');
    expect(appLogNode?.columns.some((c) => c.name === 'action')).toBe(true);
    expect(auditLogNode?.columns.some((c) => c.name === 'severity')).toBe(true);
  });
});
