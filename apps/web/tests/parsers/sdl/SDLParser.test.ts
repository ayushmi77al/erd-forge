import { describe, it, expect } from 'vitest';
import { SDLParser } from '@/parsers/sdl/SDLParser';

describe('SDLParser', () => {
  it('Test 1: Minimal table', () => {
    const { ast, errors } = SDLParser.parse('Table T { ID int [pk] }');
    expect(errors).toHaveLength(0);
    expect(ast?.statements).toHaveLength(1);
    expect(ast?.statements[0]?.type).toBe('Table');
  });

  it('Test 2: All column options', () => {
    const { ast, errors } = SDLParser.parse('Table T { ID int [pk, unique, not null, default: 0, increment] }');
    expect(errors).toHaveLength(0);
  });

  it('Test 3: FK reference variants', () => {
    const text = `
      Table A { BID int [ref: > B.ID] }
      Table A { BID int [ref: < B.ID] }
      Table A { BID int [ref: - B.ID] }
      Table A { BID int [ref: <> B.ID] }
    `;
    const { ast, errors } = SDLParser.parse(text);
    expect(errors).toHaveLength(0);
  });

  it('Test 4: Self-referencing', () => {
    const { ast, errors } = SDLParser.parse('Table Category { ParentID int [ref: > Category.CategoryID] }');
    expect(errors).toHaveLength(0);
  });

  it('Test 5: Composite index', () => {
    const text = `
      Table T { 
        A int
        B int
        indexes { (A, B) [pk] }
      }
    `;
    const { ast, errors } = SDLParser.parse(text);
    expect(errors).toHaveLength(0);
  });

  it('Test 6: Data types with length/precision', () => {
    const text = `
      Table T {
        A varchar(255)
        B decimal(18, 4)
        C nvarchar(max)
        D int[]
      }
    `;
    const { ast, errors } = SDLParser.parse(text);
    expect(errors).toHaveLength(0);
  });

  it('Test 7: Table metadata options', () => {
    const { ast, errors } = SDLParser.parse('Table T [domain: Sales, owner: "John", status: approved, tags: ["a", "b"]] {\n  ID int [pk]\n}');
    expect(errors).toHaveLength(0);
  });

  it('Test 8: View definition', () => {
    const { ast, errors } = SDLParser.parse('View vw_Test { ColumnA varchar ColumnB }');
    expect(errors).toHaveLength(0);
  });

  it('Test 9: Top-level Ref', () => {
    const { ast, errors } = SDLParser.parse('Ref: A.ID > B.AID');
    expect(errors).toHaveLength(0);
  });

  it('Test 10: Multi-line comment', () => {
    const { ast, errors } = SDLParser.parse('/* This is a comment */ Table T { ID int [pk] }');
    expect(errors).toHaveLength(0);
  });

  it('Test 11: Resilient parsing does not vanish valid tables when writing an incomplete table', () => {
    const text = `
Table users {
  id integer [pk]
  name varchar
}

Table posts {
  id integer [pk]
  title varchar
}

Table comments {
  id integer
`;
    const { ast, errors, isResilient } = SDLParser.parse(text);
    expect(isResilient).toBe(true);
    // Errors must report the incomplete comments table on line 12 or 14
    expect(errors.length).toBeGreaterThan(0);
    const err = errors[0]!;
    expect(err.line).toBeGreaterThanOrEqual(12);

    // The two valid tables MUST NOT vanish!
    expect(ast).not.toBeNull();
    const tableNames = ast?.statements.map((s: any) => s.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('posts');
  });

  it('Test 12: Broken statement in middle does not vanish surrounding tables', () => {
    const text = `
Table alpha {
  id integer [pk]
}

Table broken {
  id %%%% syntax error

Table beta {
  id integer [pk]
}
`;
    const { ast, errors, isResilient } = SDLParser.parse(text);
    expect(isResilient).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.line).toBe(7); // Broken line is line 7
    expect(ast).not.toBeNull();
    const tableNames = ast?.statements.map((s: any) => s.name);
    expect(tableNames).toContain('alpha');
    expect(tableNames).toContain('beta');
  });
});
