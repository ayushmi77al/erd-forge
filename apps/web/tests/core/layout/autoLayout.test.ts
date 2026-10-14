import { describe, it, expect } from 'vitest';
import { calculateAutoLayout, estimateTableHeight, LayoutTable, LayoutRef } from '@/core/layout/autoLayout';

describe('autoLayout', () => {
  it('estimates table height correctly', () => {
    expect(estimateTableHeight(0)).toBe(100);
    expect(estimateTableHeight(3)).toBe(44 + 3 * 32 + 16);
  });

  it('handles empty tables cleanly', () => {
    const positions = calculateAutoLayout([], []);
    expect(positions.size).toBe(0);
  });

  it('positions single table at default margins', () => {
    const table: LayoutTable = {
      name: 'users',
      columns: [{ name: 'id', type: 'int' }],
    };

    const positions = calculateAutoLayout([table], []);
    expect(positions.has('users')).toBe(true);
    const pos = positions.get('users')!;
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeGreaterThanOrEqual(0);
  });

  it('lays out relational hierarchy in LR direction with parent to the left', () => {
    const usersTable: LayoutTable = {
      name: 'users',
      columns: [{ name: 'id', type: 'int' }],
    };

    const ordersTable: LayoutTable = {
      name: 'orders',
      columns: [
        { name: 'id', type: 'int' },
        { name: 'user_id', type: 'int' },
      ],
    };

    const orderItemsTable: LayoutTable = {
      name: 'order_items',
      columns: [
        { name: 'id', type: 'int' },
        { name: 'order_id', type: 'int' },
      ],
    };

    const refs: LayoutRef[] = [
      {
        sourceTable: 'orders',
        sourceColumn: 'user_id',
        direction: '>',
        targetTable: 'users',
        targetColumn: 'id',
      },
      {
        sourceTable: 'order_items',
        sourceColumn: 'order_id',
        direction: '>',
        targetTable: 'orders',
        targetColumn: 'id',
      },
    ];

    const positions = calculateAutoLayout(
      [usersTable, ordersTable, orderItemsTable],
      refs,
      { direction: 'LR' }
    );

    const userPos = positions.get('users')!;
    const orderPos = positions.get('orders')!;
    const itemPos = positions.get('order_items')!;

    // In LR layout, parent 'users' must be to the left of child 'orders',
    // and 'orders' must be to the left of child 'order_items'
    expect(userPos.x).toBeLessThan(orderPos.x);
    expect(orderPos.x).toBeLessThan(itemPos.x);
  });

  it('supports TB (Top-to-Bottom) layout direction', () => {
    const usersTable: LayoutTable = {
      name: 'users',
      columns: [{ name: 'id', type: 'int' }],
    };

    const ordersTable: LayoutTable = {
      name: 'orders',
      columns: [
        { name: 'id', type: 'int' },
        { name: 'user_id', type: 'int' },
      ],
    };

    const refs: LayoutRef[] = [
      {
        sourceTable: 'orders',
        sourceColumn: 'user_id',
        direction: '>',
        targetTable: 'users',
        targetColumn: 'id',
      },
    ];

    const positions = calculateAutoLayout([usersTable, ordersTable], refs, {
      direction: 'TB',
    });

    const userPos = positions.get('users')!;
    const orderPos = positions.get('orders')!;

    expect(userPos.y).toBeLessThan(orderPos.y);
  });

  it('handles self-referencing relationship without infinite loop or failure', () => {
    const employeesTable: LayoutTable = {
      name: 'employees',
      columns: [
        { name: 'id', type: 'int' },
        { name: 'manager_id', type: 'int' },
      ],
    };

    const refs: LayoutRef[] = [
      {
        sourceTable: 'employees',
        sourceColumn: 'manager_id',
        direction: '>',
        targetTable: 'employees',
        targetColumn: 'id',
      },
    ];

    const positions = calculateAutoLayout([employeesTable], refs);
    expect(positions.has('employees')).toBe(true);
  });
});
