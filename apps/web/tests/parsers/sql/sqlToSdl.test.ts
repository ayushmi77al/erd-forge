import { describe, it, expect } from 'vitest';
import { parseSqlToSdl, detectSqlStats, cleanIdentifier } from '@/parsers/sql/sqlToSdl';

describe('sqlToSdl', () => {
  it('cleans identifiers properly', () => {
    expect(cleanIdentifier('`users`')).toBe('users');
    expect(cleanIdentifier('"public"."orders"')).toBe('orders');
    expect(cleanIdentifier('[schema].[products]')).toBe('products');
    expect(cleanIdentifier('  id  ')).toBe('id');
  });

  it('parses basic CREATE TABLE statement', () => {
    const sql = `
      CREATE TABLE users (
        id INT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL
      );
    `;

    const res = parseSqlToSdl(sql);
    expect(res.tables).toHaveLength(1);
    expect(res.tables[0]!.name).toBe('users');
    expect(res.tables[0]!.columns).toHaveLength(3);

    const [idCol, userCol, emailCol] = res.tables[0]!.columns;
    expect(idCol!.name).toBe('id');
    expect(idCol!.isPk).toBe(true);

    expect(userCol!.name).toBe('username');
    expect(userCol!.isNotNull).toBe(true);

    expect(emailCol!.name).toBe('email');
    expect(emailCol!.isUnique).toBe(true);
  });

  it('parses table-level PRIMARY KEY and FOREIGN KEY constraints', () => {
    const sql = `
      CREATE TABLE orders (
        id INT,
        user_id INT,
        total DECIMAL(10, 2),
        PRIMARY KEY (id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `;

    const res = parseSqlToSdl(sql);
    expect(res.tables).toHaveLength(1);
    expect(res.tables[0]!.columns[0]!.isPk).toBe(true);
    expect(res.refs).toHaveLength(1);
    expect(res.refs[0]!).toEqual({
      sourceTable: 'orders',
      sourceColumn: 'user_id',
      targetTable: 'users',
      targetColumn: 'id',
    });
  });

  it('parses ALTER TABLE ADD FOREIGN KEY statements', () => {
    const sql = `
      CREATE TABLE users (id INT PRIMARY KEY);
      CREATE TABLE posts (id INT PRIMARY KEY, author_id INT);

      ALTER TABLE posts
        ADD CONSTRAINT fk_posts_author
        FOREIGN KEY (author_id) REFERENCES users(id);
    `;

    const res = parseSqlToSdl(sql);
    expect(res.tables).toHaveLength(2);
    expect(res.refs).toHaveLength(1);
    expect(res.refs[0]!).toEqual({
      sourceTable: 'posts',
      sourceColumn: 'author_id',
      targetTable: 'users',
      targetColumn: 'id',
    });
  });

  it('generates valid SDL text representation', () => {
    const sql = `
      CREATE TABLE categories (
        id INT PRIMARY KEY,
        title VARCHAR(100) NOT NULL
      );

      CREATE TABLE products (
        id INT PRIMARY KEY,
        category_id INT NOT NULL,
        name VARCHAR(200),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );
    `;

    const res = parseSqlToSdl(sql);
    expect(res.sdl).toContain('Table categories');
    expect(res.sdl).toContain('Table products');
    expect(res.sdl).toContain('Ref: products.category_id > categories.id');
  });

  it('computes live stats accurately with detectSqlStats', () => {
    const sql = `
      CREATE TABLE t1 (id INT PRIMARY KEY);
      CREATE TABLE t2 (id INT PRIMARY KEY, t1_id INT, FOREIGN KEY (t1_id) REFERENCES t1(id));
      CREATE TABLE t3 (id INT PRIMARY KEY, t2_id INT, FOREIGN KEY (t2_id) REFERENCES t2(id));
    `;

    const stats = detectSqlStats(sql);
    expect(stats.tableCount).toBe(3);
    expect(stats.refCount).toBe(2);
  });
});
