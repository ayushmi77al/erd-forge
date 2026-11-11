import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IndexedDBAdapter } from "../../src/storage/IndexedDBAdapter";
import { MigrationRunner } from "../../src/storage/migrations/MigrationRunner";
import { OPFSSQLiteAdapter } from "../../src/storage/OPFSSQLiteAdapter";
import { SafeStorageMigrator } from "../../src/storage/SafeStorageMigrator";
import { sqliteWorkerApi } from "../../src/workers/sqlite.worker";

describe("T3.4: Safe Idempotent Storage Migrator", () => {
  beforeEach(async () => {
    await sqliteWorkerApi.close();
  });

  const setupTargetSqlite = async (dbName: string): Promise<OPFSSQLiteAdapter> => {
    const adapter = new OPFSSQLiteAdapter(dbName, sqliteWorkerApi);
    await adapter.initialize({ allowMemoryFallback: true, clearOnInit: true });
    await MigrationRunner.run(adapter);
    return adapter;
  };

  const populateLegacyIndexedDB = async (dbName: string): Promise<IndexedDBAdapter> => {
    const adapter = new IndexedDBAdapter(dbName);
    await adapter.initialize();

    // Insert legacy project
    await adapter.execute("INSERT INTO projects", [
      {
        id: "proj_ecommerce",
        name: "E-Commerce Catalog",
        description: "Retail and customer ordering schema",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    // Insert legacy entities
    await adapter.execute("INSERT INTO entities", [
      {
        id: "ent_users",
        project_id: "proj_ecommerce",
        entity_type: "table",
        name: "users",
        schema_name: "public",
        description: "Registered customer accounts",
        review_status: "approved",
      },
    ]);

    await adapter.execute("INSERT INTO entities", [
      {
        id: "ent_orders",
        project_id: "proj_ecommerce",
        entity_type: "table",
        name: "orders",
        schema_name: "public",
        description: "Customer purchasing transactions",
        review_status: "approved",
      },
    ]);

    // Insert legacy columns
    await adapter.execute("INSERT INTO columns", [
      {
        id: "col_user_id",
        entity_id: "ent_users",
        project_id: "proj_ecommerce",
        name: "id",
        ordinal_position: 1,
        data_type: "INTEGER",
        is_primary_key: true,
        is_nullable: false,
        pii_classification: "none",
      },
    ]);

    await adapter.execute("INSERT INTO columns", [
      {
        id: "col_user_email",
        entity_id: "ent_users",
        project_id: "proj_ecommerce",
        name: "email",
        ordinal_position: 2,
        data_type: "VARCHAR(255)",
        is_primary_key: false,
        is_nullable: false,
        is_unique: true,
        pii_classification: "pii",
      },
    ]);

    await adapter.execute("INSERT INTO columns", [
      {
        id: "col_order_id",
        entity_id: "ent_orders",
        project_id: "proj_ecommerce",
        name: "id",
        ordinal_position: 1,
        data_type: "INTEGER",
        is_primary_key: true,
        is_nullable: false,
      },
    ]);

    await adapter.execute("INSERT INTO columns", [
      {
        id: "col_order_user_id",
        entity_id: "ent_orders",
        project_id: "proj_ecommerce",
        name: "user_id",
        ordinal_position: 2,
        data_type: "INTEGER",
        is_nullable: false,
      },
    ]);

    // Insert legacy relationships
    await adapter.execute("INSERT INTO relationships", [
      {
        id: "rel_order_user",
        project_id: "proj_ecommerce",
        source_entity_id: "ent_orders",
        source_column_id: "col_order_user_id",
        target_entity_id: "ent_users",
        target_column_id: "col_user_id",
        cardinality: "many_to_one",
        is_enforced: true,
      },
    ]);

    return adapter;
  };

  it("creates accurate snapshot of all source stores without altering source data", async () => {
    const idb = await populateLegacyIndexedDB("snapshot-test-db");
    const snapshot = await SafeStorageMigrator.createSnapshot(idb);

    expect(snapshot.version).toBe(1);
    expect(snapshot.stores.projects).toHaveLength(1);
    expect(snapshot.stores.entities).toHaveLength(2);
    expect(snapshot.stores.columns).toHaveLength(4);
    expect(snapshot.stores.relationships).toHaveLength(1);
    expect(snapshot.totalRecords).toBe(8);

    await idb.close();
  });

  it("handles empty source database gracefully without unnecessary transaction errors", async () => {
    const idb = new IndexedDBAdapter("empty-idb");
    await idb.initialize();

    const sqlite = await setupTargetSqlite("empty-target.db");

    const result = await SafeStorageMigrator.migrate(idb, sqlite);
    expect(result.success).toBe(true);
    expect(result.alreadyMigrated).toBe(false);
    expect(result.migratedCount).toBe(0);

    const isMigrated = await SafeStorageMigrator.isMigrated(sqlite);
    expect(isMigrated).toBe(true);

    await idb.close();
    await sqlite.close();
  });

  it("migrates legacy schema data into SQLite and passes row-count verification", async () => {
    const idb = await populateLegacyIndexedDB("migration-source-db");
    const sqlite = await setupTargetSqlite("migration-target.db");

    const result = await SafeStorageMigrator.migrate(idb, sqlite, { backupToStorage: true });

    expect(result.success).toBe(true);
    expect(result.alreadyMigrated).toBe(false);
    expect(result.migratedCount).toBe(8);
    expect(result.sourceCounts).toEqual({
      projects: 1,
      entities: 2,
      columns: 4,
      relationships: 1,
      metadata: 0,
    });
    expect(result.targetCounts).toEqual({
      projects: 1,
      entities: 2,
      columns: 4,
      relationships: 1,
    });

    // Verify actual rows in SQLite target
    const projects = await sqlite.query<{ id: string; name: string }>("SELECT id, name FROM projects;");
    expect(projects).toEqual([{ id: "proj_ecommerce", name: "E-Commerce Catalog" }]);

    const entities = await sqlite.query<{ id: string; name: string; review_status: string }>(
      "SELECT id, name, review_status FROM entities ORDER BY name ASC;",
    );
    expect(entities).toEqual([
      { id: "ent_orders", name: "orders", review_status: "approved" },
      { id: "ent_users", name: "users", review_status: "approved" },
    ]);

    const piiColumns = await sqlite.query<{ name: string; pii_classification: string }>(
      "SELECT name, pii_classification FROM columns WHERE pii_classification != 'none';",
    );
    expect(piiColumns).toEqual([{ name: "email", pii_classification: "pii" }]);

    // Verify _migration_journal record
    const journalEntries = await sqlite.query<{ migration_id: string; status: string; total_records: number }>(
      "SELECT migration_id, status, total_records FROM _migration_journal;",
    );
    expect(journalEntries).toHaveLength(1);
    expect(journalEntries[0]!.migration_id).toBe(SafeStorageMigrator.MIGRATION_ID);
    expect(journalEntries[0]!.status).toBe("completed");
    expect(journalEntries[0]!.total_records).toBe(8);

    await idb.close();
    await sqlite.close();
  });

  it("strictly enforces idempotency on repeated runs", async () => {
    const idb = await populateLegacyIndexedDB("idempotency-source-db");
    const sqlite = await setupTargetSqlite("idempotency-target.db");

    // First migration run
    const result1 = await SafeStorageMigrator.migrate(idb, sqlite);
    expect(result1.success).toBe(true);
    expect(result1.alreadyMigrated).toBe(false);
    expect(result1.migratedCount).toBe(8);

    // Second migration run on same target
    const result2 = await SafeStorageMigrator.migrate(idb, sqlite);
    expect(result2.success).toBe(true);
    expect(result2.alreadyMigrated).toBe(true);
    expect(result2.migratedCount).toBe(0);

    // Ensure target tables were not duplicated or corrupted
    const entityCount = await sqlite.query<{ count: number }>("SELECT COUNT(*) as count FROM entities;");
    expect(entityCount[0]!.count).toBe(2);

    await idb.close();
    await sqlite.close();
  });

  it("leaves legacy source IndexedDB 100% intact (zero destructive operations)", async () => {
    const idb = await populateLegacyIndexedDB("retention-source-db");
    const sqlite = await setupTargetSqlite("retention-target.db");

    await SafeStorageMigrator.migrate(idb, sqlite);

    // Verify all legacy tables remain intact with identical counts
    const sourceProjects = await idb.query("SELECT * FROM projects");
    const sourceEntities = await idb.query("SELECT * FROM entities");
    const sourceColumns = await idb.query("SELECT * FROM columns");
    const sourceRelationships = await idb.query("SELECT * FROM relationships");

    expect(sourceProjects).toHaveLength(1);
    expect(sourceEntities).toHaveLength(2);
    expect(sourceColumns).toHaveLength(4);
    expect(sourceRelationships).toHaveLength(1);

    await idb.close();
    await sqlite.close();
  });

  it("aborts cleanly and records aborted status in journal if batch insertion fails", async () => {
    const idb = await populateLegacyIndexedDB("fail-source-db");
    const sqlite = await setupTargetSqlite("fail-target.db");

    // Force failure during batch insertion by mocking target.executeBatch to reject
    const originalExecuteBatch = sqlite.executeBatch.bind(sqlite);
    vi.spyOn(sqlite, "executeBatch").mockRejectedValueOnce(
      new Error("Simulated storage disk full during batch insert"),
    );

    const result = await SafeStorageMigrator.migrate(idb, sqlite);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Simulated storage disk full");

    // Restore and verify journal recorded 'aborted'
    sqlite.executeBatch = originalExecuteBatch;
    const journalEntries = await sqlite.query<{ status: string }>(
      "SELECT status FROM _migration_journal WHERE migration_id = ?;",
      [SafeStorageMigrator.MIGRATION_ID],
    );
    expect(journalEntries).toHaveLength(1);
    expect(journalEntries[0]!.status).toBe("aborted");

    await idb.close();
    await sqlite.close();
  });
});
