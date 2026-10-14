import { SQLDialect } from '../../stores/lineageStore';

export interface SampleQuery {
  id: string;
  title: string;
  description: string;
  dialect: SQLDialect;
  sql: string;
}

export const SAMPLE_QUERIES: SampleQuery[] = [
  {
    id: 'ecommerce-cte',
    title: 'E-Commerce CTEs & Aggregations',
    description: 'Calculates monthly sales, rank by country, and filters top customers using CTEs.',
    dialect: 'mssql',
    sql: `-- E-Commerce Top Customers by Country
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
WHERE tc.rank <= 5;`,
  },
  {
    id: 'customer-360',
    title: 'Customer 360 & Activity Union',
    description: 'Combines web logins, mobile purchases, and support tickets with customer master.',
    dialect: 'postgresql',
    sql: `-- Customer 360 Unified Activity Stream
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
SELECT 
  c.customer_id,
  c.first_name,
  c.last_name,
  c.email,
  act.activity_type,
  COUNT(act.event_time) AS total_events
FROM customers c
LEFT JOIN AllActivities act ON c.customer_id = act.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name, c.email, act.activity_type;`,
  },
  {
    id: 'financial-reporting',
    title: 'Financial Ledger & Department Rollup',
    description: 'Aggregates general ledger transactions into department budget variances.',
    dialect: 'mysql',
    sql: `-- Department Budget vs Actual Spend
WITH ActualSpend AS (
  SELECT 
    dept_id,
    SUM(debit_amount - credit_amount) AS total_spent
  FROM general_ledger
  WHERE fiscal_year = 2024
  GROUP BY dept_id
),
DepartmentSummary AS (
  SELECT 
    d.id AS dept_id,
    d.department_name,
    b.allocated_budget,
    COALESCE(s.total_spent, 0) AS total_spent,
    (b.allocated_budget - COALESCE(s.total_spent, 0)) AS remaining_budget
  FROM departments d
  JOIN budgets b ON d.id = b.department_id AND b.year = 2024
  LEFT JOIN ActualSpend s ON d.id = s.dept_id
)
SELECT 
  dept_id,
  department_name,
  allocated_budget,
  total_spent,
  remaining_budget,
  CASE 
    WHEN remaining_budget < 0 THEN 'OVER_BUDGET'
    WHEN remaining_budget < 10000 THEN 'CRITICAL'
    ELSE 'HEALTHY'
  END AS budget_status
FROM DepartmentSummary;`,
  },
  {
    id: 'inventory-supplier',
    title: 'Inventory & Reorder Alert Subquery',
    description: 'Identifies warehouse products requiring restock with supplier contact details.',
    dialect: 'sqlite',
    sql: `-- Warehouse Inventory Reorder Alerts
SELECT 
  p.product_id,
  p.product_name,
  p.units_in_stock,
  p.reorder_level,
  s.supplier_name,
  s.contact_phone
FROM products p
JOIN suppliers s ON p.supplier_id = s.supplier_id
WHERE p.units_in_stock <= (
  SELECT AVG(reorder_level) FROM products WHERE category_id = p.category_id
);`,
  },
];
