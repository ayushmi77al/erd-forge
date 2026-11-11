import { describe, expect, it } from "vitest";
import {
  calculateAutoLayout,
  estimateTableHeight,
  getTableKey,
  type LayoutRef,
  type LayoutTable,
} from "@/core/layout/autoLayout";

describe("autoLayout (ELK Layout Engine)", () => {
  it("estimates table height correctly", () => {
    expect(estimateTableHeight(0)).toBe(100);
    expect(estimateTableHeight(3)).toBe(44 + 3 * 32 + 16);
  });

  it("derives collision-safe table keys", () => {
    expect(getTableKey(undefined, "users")).toBe("users");
    expect(getTableKey("public", "users")).toBe("public.users");
    expect(getTableKey("audit", "users")).toBe("audit.users");
    expect(getTableKey(undefined, "users", "custom-uuid-1")).toBe("custom-uuid-1");
  });

  it("handles empty tables cleanly", async () => {
    const positions = await calculateAutoLayout([], []);
    expect(positions.size).toBe(0);
  });

  it("positions single table at default margins", async () => {
    const table: LayoutTable = {
      name: "users",
      columns: [{ name: "id", type: "int" }],
    };

    const positions = await calculateAutoLayout([table], []);
    expect(positions.has("users")).toBe(true);
    const pos = positions.get("users")!;
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeGreaterThanOrEqual(0);
  });

  it("lays out relational hierarchy in LR direction with parent to the left", async () => {
    const usersTable: LayoutTable = {
      name: "users",
      columns: [{ name: "id", type: "int" }],
    };

    const ordersTable: LayoutTable = {
      name: "orders",
      columns: [
        { name: "id", type: "int" },
        { name: "user_id", type: "int" },
      ],
    };

    const orderItemsTable: LayoutTable = {
      name: "order_items",
      columns: [
        { name: "id", type: "int" },
        { name: "order_id", type: "int" },
      ],
    };

    const refs: LayoutRef[] = [
      {
        sourceTable: "orders",
        sourceColumn: "user_id",
        direction: ">",
        targetTable: "users",
        targetColumn: "id",
      },
      {
        sourceTable: "order_items",
        sourceColumn: "order_id",
        direction: ">",
        targetTable: "orders",
        targetColumn: "id",
      },
    ];

    const positions = await calculateAutoLayout([usersTable, ordersTable, orderItemsTable], refs, { direction: "LR" });

    const userPos = positions.get("users")!;
    const orderPos = positions.get("orders")!;
    const itemPos = positions.get("order_items")!;

    // In LR layout, parent 'users' must be to the left of child 'orders',
    // and 'orders' must be to the left of child 'order_items'
    expect(userPos.x).toBeLessThan(orderPos.x);
    expect(orderPos.x).toBeLessThan(itemPos.x);
  });

  it("supports TB (Top-to-Bottom) layout direction", async () => {
    const usersTable: LayoutTable = {
      name: "users",
      columns: [{ name: "id", type: "int" }],
    };

    const ordersTable: LayoutTable = {
      name: "orders",
      columns: [
        { name: "id", type: "int" },
        { name: "user_id", type: "int" },
      ],
    };

    const refs: LayoutRef[] = [
      {
        sourceTable: "orders",
        sourceColumn: "user_id",
        direction: ">",
        targetTable: "users",
        targetColumn: "id",
      },
    ];

    const positions = await calculateAutoLayout([usersTable, ordersTable], refs, {
      direction: "TB",
    });

    const userPos = positions.get("users")!;
    const orderPos = positions.get("orders")!;

    expect(userPos.y).toBeLessThan(orderPos.y);
  });

  it("handles self-referencing relationship without infinite loop or failure", async () => {
    const employeesTable: LayoutTable = {
      name: "employees",
      columns: [
        { name: "id", type: "int" },
        { name: "manager_id", type: "int" },
      ],
    };

    const refs: LayoutRef[] = [
      {
        sourceTable: "employees",
        sourceColumn: "manager_id",
        direction: ">",
        targetTable: "employees",
        targetColumn: "id",
      },
    ];

    const positions = await calculateAutoLayout([employeesTable], refs);
    expect(positions.has("employees")).toBe(true);
  });

  it("differentiates tables with identical names across distinct schemas (Collision Safety)", async () => {
    const publicUsers: LayoutTable = {
      schema: "public",
      name: "users",
      columns: [{ name: "id", type: "int" }],
    };

    const auditUsers: LayoutTable = {
      schema: "audit",
      name: "users",
      columns: [{ name: "log_id", type: "int" }],
    };

    const auditLog: LayoutTable = {
      schema: "audit",
      name: "user_logs",
      columns: [
        { name: "id", type: "int" },
        { name: "user_id", type: "int" },
      ],
    };

    const refs: LayoutRef[] = [
      {
        sourceSchema: "audit",
        sourceTable: "user_logs",
        direction: ">",
        targetSchema: "audit",
        targetTable: "users",
      },
    ];

    const positions = await calculateAutoLayout([publicUsers, auditUsers, auditLog], refs);

    // Both public.users and audit.users must have distinct positions in the map
    expect(positions.has("public.users")).toBe(true);
    expect(positions.has("audit.users")).toBe(true);

    const pubPos = positions.get("public.users")!;
    const auditPos = positions.get("audit.users")!;

    // They must not occupy the exact same coordinate
    const isSameCoordinate = pubPos.x === auditPos.x && pubPos.y === auditPos.y;
    expect(isSameCoordinate).toBe(false);
  });

  it("respects compound domain hierarchy for grouped tables", async () => {
    const tables: LayoutTable[] = [
      { schema: "billing", name: "invoices", domain: "Finance", columns: [{ name: "id" }] },
      { schema: "billing", name: "payments", domain: "Finance", columns: [{ name: "id" }] },
      { schema: "auth", name: "accounts", domain: "Security", columns: [{ name: "id" }] },
      { schema: "auth", name: "roles", domain: "Security", columns: [{ name: "id" }] },
    ];

    const refs: LayoutRef[] = [
      {
        sourceSchema: "billing",
        sourceTable: "payments",
        direction: ">",
        targetSchema: "billing",
        targetTable: "invoices",
      },
      { sourceSchema: "auth", sourceTable: "roles", direction: ">", targetSchema: "auth", targetTable: "accounts" },
    ];

    const positions = await calculateAutoLayout(tables, refs);

    expect(positions.has("billing.invoices")).toBe(true);
    expect(positions.has("billing.payments")).toBe(true);
    expect(positions.has("auth.accounts")).toBe(true);
    expect(positions.has("auth.roles")).toBe(true);
  });

  it("places unlinked tables on a deterministic non-overlapping grid", async () => {
    const tables: LayoutTable[] = [
      { name: "connected_parent", columns: [{ name: "id" }] },
      { name: "connected_child", columns: [{ name: "id" }] },
      { name: "unlinked_1", columns: [{ name: "id" }] },
      { name: "unlinked_2", columns: [{ name: "id" }] },
      { name: "unlinked_3", columns: [{ name: "id" }] },
    ];

    const refs: LayoutRef[] = [{ sourceTable: "connected_child", direction: ">", targetTable: "connected_parent" }];

    const positions = await calculateAutoLayout(tables, refs);

    const pos1 = positions.get("unlinked_1")!;
    const pos2 = positions.get("unlinked_2")!;
    const pos3 = positions.get("unlinked_3")!;

    // Unlinked tables must not be stacked on top of each other at (80, 80)
    expect(pos1.x === pos2.x && pos1.y === pos2.y).toBe(false);
    expect(pos2.x === pos3.x && pos2.y === pos3.y).toBe(false);
  });

  it("preserves measured node dimensions when supplied by React Flow", async () => {
    const tableA: LayoutTable = {
      name: "large_card",
      measuredWidth: 400,
      measuredHeight: 600,
      columns: [{ name: "id" }],
    };

    const tableB: LayoutTable = {
      name: "small_card",
      measuredWidth: 150,
      measuredHeight: 120,
      columns: [{ name: "id" }],
    };

    const refs: LayoutRef[] = [{ sourceTable: "small_card", direction: ">", targetTable: "large_card" }];

    const positions = await calculateAutoLayout([tableA, tableB], refs, { direction: "LR" });
    const posA = positions.get("large_card")!;
    const posB = positions.get("small_card")!;

    // Table B (child) should be placed to the right of Table A, spaced taking measuredWidth (400) into account
    expect(posB.x).toBeGreaterThanOrEqual(posA.x + 400);
  });

  it("successfully lays out 50-table schema fixture without errors", async () => {
    const { fixture50Tables } = await import("../../fixtures/layout/layoutFixtures");
    const positions = await calculateAutoLayout(fixture50Tables.tables, fixture50Tables.refs, { direction: "LR" });
    expect(positions.size).toBeGreaterThanOrEqual(50);
  });

  it("successfully lays out 500-table stress schema fixture", async () => {
    const { fixture500Tables } = await import("../../fixtures/layout/layoutFixtures");
    const positions = await calculateAutoLayout(fixture500Tables.tables, fixture500Tables.refs, { direction: "LR" });
    expect(positions.size).toBeGreaterThanOrEqual(500);
  }, 30000);

  it("aborts layout calculation cleanly when AbortSignal is triggered", async () => {
    const controller = new AbortController();
    controller.abort(); // Pre-aborted signal

    const tables: LayoutTable[] = [{ name: "users" }, { name: "orders" }];
    await expect(calculateAutoLayout(tables, [], { signal: controller.signal })).rejects.toThrow(
      "Layout computation aborted",
    );
  });

  it("produces identical deterministic coordinates across repeated runs", async () => {
    const tables: LayoutTable[] = [
      { name: "users", columns: [{ name: "id" }] },
      { name: "orders", columns: [{ name: "id" }] },
      { name: "items", columns: [{ name: "id" }] },
    ];
    const refs: LayoutRef[] = [
      { sourceTable: "orders", direction: ">", targetTable: "users" },
      { sourceTable: "items", direction: ">", targetTable: "orders" },
    ];

    const run1 = await calculateAutoLayout(tables, refs, { direction: "LR" });
    const run2 = await calculateAutoLayout(tables, refs, { direction: "LR" });

    expect(run1.get("users")).toEqual(run2.get("users"));
    expect(run1.get("orders")).toEqual(run2.get("orders"));
    expect(run1.get("items")).toEqual(run2.get("items"));
  });
});
