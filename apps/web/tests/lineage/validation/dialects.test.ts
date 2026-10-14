import { describe, it, expect } from 'vitest';
import { parseSQLLineage } from '@/lineage/parser/sqlLineageParser';

describe('Dialect Specific Parsing & Syntax Support', () => {
  it('6.1 parses PostgreSQL query with type casts and boolean literals', () => {
    const sql = `
      SELECT 
        user_id,
        amount::numeric AS clean_amount,
        is_active
      FROM users
      WHERE is_active = true;
    `;
    const res = parseSQLLineage(sql, 'postgresql');
    expect(res.errors).toHaveLength(0);
    const usersNode = res.graph?.nodes.find((n) => n.id === 'table_users');
    expect(usersNode).toBeDefined();
    expect(usersNode?.columns.some((c) => c.name === 'user_id')).toBe(true);
    expect(usersNode?.columns.some((c) => c.name === 'amount')).toBe(true);
  });

  it('6.2 parses MySQL queries with backtick identifiers', () => {
    const sql = `
      SELECT \`id\`, \`name\`
      FROM \`accounts\`
      WHERE \`status\` = 1;
    `;
    const res = parseSQLLineage(sql, 'mysql');
    expect(res.errors).toHaveLength(0);
    const accountsNode = res.graph?.nodes.find((n) => n.name === 'accounts' || n.id === 'table_accounts');
    expect(accountsNode).toBeDefined();
    expect(accountsNode?.columns.some((c) => c.name.toLowerCase() === 'id')).toBe(true);
  });

  it('6.3 parses Transact-SQL (T-SQL / MSSQL) queries', () => {
    const sql = `
      SELECT [order_id], [total_amount]
      FROM [sales].[orders]
      WHERE [status] = 'SHIPPED';
    `;
    const res = parseSQLLineage(sql, 'mssql');
    expect(res.errors).toHaveLength(0);
    const ordersNode = res.graph?.nodes.find((n) => n.name.toLowerCase() === 'orders');
    expect(ordersNode).toBeDefined();
  });

  it('6.4 parses SQLite queries', () => {
    const sql = `
      SELECT rowid, title FROM documents WHERE title LIKE '%report%';
    `;
    const res = parseSQLLineage(sql, 'sqlite');
    expect(res.errors).toHaveLength(0);
    const docNode = res.graph?.nodes.find((n) => n.id === 'table_documents');
    expect(docNode).toBeDefined();
  });
});
