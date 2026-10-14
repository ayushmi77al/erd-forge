import { describe, it, expect } from 'vitest';
import { parseSQLLineage } from '@/lineage/parser/sqlLineageParser';

describe('Clause Indirect Dependencies & Calculations', () => {
  it('4.1 extracts indirect columns from WHERE and JOIN ON conditions', () => {
    const sql = `
      SELECT o.order_id, c.customer_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      WHERE o.status = 'COMPLETED' AND c.country = 'US';
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);

    const ordersNode = res.graph?.nodes.find((n) => n.id === 'table_orders');
    const customersNode = res.graph?.nodes.find((n) => n.id === 'table_customers');

    // Both should have customer_id
    expect(ordersNode?.columns.some((c) => c.name === 'customer_id')).toBe(true);
    expect(customersNode?.columns.some((c) => c.name === 'customer_id')).toBe(true);

    // Filter columns
    expect(ordersNode?.columns.some((c) => c.name === 'status')).toBe(true);
    expect(customersNode?.columns.some((c) => c.name === 'country')).toBe(true);
  });

  it('4.2 extracts columns from GROUP BY and HAVING clauses', () => {
    const sql = `
      SELECT department_id, COUNT(*) AS emp_count
      FROM employees
      GROUP BY department_id
      HAVING AVG(salary) > 50000;
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);

    const empNode = res.graph?.nodes.find((n) => n.id === 'table_employees');
    expect(empNode?.columns.some((c) => c.name === 'department_id')).toBe(true);
    expect(empNode?.columns.some((c) => c.name === 'salary')).toBe(true);
  });

  it('4.3 extracts PARTITION BY and ORDER BY columns from Window Function OVER clauses', () => {
    const sql = `
      SELECT 
        employee_id,
        department_id,
        salary,
        DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) as salary_rank
      FROM employee_records;
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);

    const finalNode = res.graph?.nodes.find((n) => n.type === 'FINAL_SELECT');
    const rankCol = finalNode?.columns.find((c) => c.name === 'salary_rank');
    expect(rankCol).toBeDefined();

    const sourceCols = rankCol?.sources.map((s) => s.column);
    expect(sourceCols).toContain('department_id');
    expect(sourceCols).toContain('salary');
  });

  it('4.4 extracts columns inside CASE WHEN conditions and result expressions', () => {
    const sql = `
      SELECT 
        user_id,
        CASE 
          WHEN age >= 18 THEN adult_score
          ELSE child_score
        END AS rating
      FROM survey_data;
    `;
    const res = parseSQLLineage(sql);
    expect(res.errors).toHaveLength(0);

    const surveyNode = res.graph?.nodes.find((n) => n.id === 'table_survey_data');
    expect(surveyNode?.columns.some((c) => c.name === 'age')).toBe(true);
    expect(surveyNode?.columns.some((c) => c.name === 'adult_score')).toBe(true);
    expect(surveyNode?.columns.some((c) => c.name === 'child_score')).toBe(true);
  });
});
