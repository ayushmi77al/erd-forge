import type { LayoutRef, LayoutTable } from "@/core/layout/autoLayout";

export interface FixtureSchema {
  name: string;
  description: string;
  tables: LayoutTable[];
  refs: LayoutRef[];
}

/**
 * Generates a deterministic relational schema for layout testing.
 * Includes schema namespace collisions, disconnected tables, and domain groupings.
 */
export function generateLayoutFixture(
  tableCount: number,
  options: {
    schemas?: string[];
    domains?: string[];
    disconnectedPercent?: number;
    includeCollisions?: boolean;
  } = {},
): FixtureSchema {
  const {
    schemas = ["public", "analytics", "audit"],
    domains = ["Auth", "Commerce", "Reporting", "Infrastructure"],
    disconnectedPercent = 0.15, // 15% unlinked nodes
    includeCollisions = true,
  } = options;

  const tables: LayoutTable[] = [];
  const refs: LayoutRef[] = [];

  for (let i = 0; i < tableCount; i++) {
    const schema = schemas[i % schemas.length];
    const domain = domains[i % domains.length];

    // Intentionally introduce duplicate table names across schemas
    const tableName =
      includeCollisions && i % 10 === 0 ? `users` : includeCollisions && i % 15 === 0 ? `orders` : `entity_${i}`;

    tables.push({
      name: tableName,
      schema,
      domain,
      columns: [
        { name: "id", type: "uuid" },
        { name: "created_at", type: "timestamp" },
        { name: "status", type: "varchar" },
        { name: "parent_id", type: "uuid" },
      ],
      measuredWidth: 260,
      measuredHeight: 44 + 4 * 32 + 16,
    });

    // Link tables if not part of disconnected percent
    const isDisconnected = i % 100 < disconnectedPercent * 100;
    if (i > 0 && !isDisconnected) {
      const targetIdx = Math.floor((i * 17) % i); // Deterministic pseudo-random parent
      refs.push({
        sourceSchema: schema,
        sourceTable: tableName,
        targetSchema: tables[targetIdx]!.schema,
        targetTable: tables[targetIdx]!.name,
        direction: ">",
      });
    }
  }

  return {
    name: `schema_${tableCount}_tables`,
    description: `Deterministic synthetic schema with ${tableCount} tables and ${refs.length} references`,
    tables,
    refs,
  };
}

export const fixture50Tables: FixtureSchema = generateLayoutFixture(50);
export const fixture500Tables: FixtureSchema = generateLayoutFixture(500);
