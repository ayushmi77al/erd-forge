import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IndexedDBAdapter } from "../../src/storage/IndexedDBAdapter";
import { StorageService } from "../../src/storage/index";
import { OPFSSQLiteAdapter } from "../../src/storage/OPFSSQLiteAdapter";
import { sqliteWorkerApi } from "../../src/workers/sqlite.worker";

describe("T3.2: Storage Adapter & Durable Fallback Hierarchy", () => {
  beforeEach(async () => {
    await sqliteWorkerApi.close();
  });

  describe("OPFSSQLiteAdapter", () => {
    it("initializes using sqlite worker and rejects silent memory fallback in strict mode", async () => {
      const adapter = new OPFSSQLiteAdapter("test_strict.db", sqliteWorkerApi);

      // In Node environment without OPFS SAH, strict initialization must throw
      await expect(adapter.initialize({ allowMemoryFallback: false })).rejects.toThrow(
        "OPFS SQLite initialization failed",
      );

      expect(adapter.getEngineType()).toBe("opfs-sahpool");
      expect(adapter.isDurable()).toBe(false); // was not successfully initialized
    });

    it("initializes with test memory mode and executes queries and batch transactions", async () => {
      const adapter = new OPFSSQLiteAdapter("test_mem.db", sqliteWorkerApi);
      await adapter.initialize({ allowMemoryFallback: true });

      expect(adapter.getEngineType()).toBe("memory-fallback");

      await adapter.execute(`
        CREATE TABLE sample_items (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL
        );
      `);

      await adapter.execute("INSERT INTO sample_items (id, label) VALUES (?, ?);", ["1", "First Item"]);

      const rows = await adapter.query<{ id: string; label: string }>(
        "SELECT id, label FROM sample_items WHERE id = ?;",
        ["1"],
      );
      expect(rows).toEqual([{ id: "1", label: "First Item" }]);

      // Batch transaction
      await adapter.executeBatch([
        { sql: "INSERT INTO sample_items (id, label) VALUES (?, ?);", params: ["2", "Second Item"] },
        { sql: "INSERT INTO sample_items (id, label) VALUES (?, ?);", params: ["3", "Third Item"] },
      ]);

      const count = await adapter.query<{ count: number }>("SELECT COUNT(*) as count FROM sample_items;");
      expect(count[0]?.count).toBe(3);

      await adapter.close();
    });

    it("throws when queries or executions are attempted on uninitialized adapter", async () => {
      const adapter = new OPFSSQLiteAdapter("uninit.db", sqliteWorkerApi);

      await expect(adapter.query("SELECT 1;")).rejects.toThrow("OPFSSQLiteAdapter is not initialized.");
      await expect(adapter.execute("SELECT 1;")).rejects.toThrow("OPFSSQLiteAdapter is not initialized.");
      await expect(adapter.executeBatch([{ sql: "SELECT 1;" }])).rejects.toThrow(
        "OPFSSQLiteAdapter is not initialized.",
      );
    });
  });

  describe("IndexedDBAdapter (Durable Tier 2 Fallback)", () => {
    it("initializes schema object stores and reports durability", async () => {
      const adapter = new IndexedDBAdapter("test-idb-schema");
      await adapter.initialize();

      expect(adapter.isDurable()).toBe(true);
      expect(adapter.getEngineType()).toBe("indexeddb");

      await adapter.close();
    });

    it("handles migration version queries and inserts cleanly", async () => {
      const adapter = new IndexedDBAdapter("test-idb-migrations");
      await adapter.initialize();

      // Check initial version
      const initVer = await adapter.query<{ version: number }>("SELECT MAX(version) as version FROM _migrations");
      expect(initVer[0]?.version).toBe(0);

      // Record migration
      await adapter.execute('INSERT INTO _migrations (version, name) VALUES (1, "001_initial_schema")');

      // Verify incremented version
      const updatedVer = await adapter.query<{ version: number }>("SELECT MAX(version) as version FROM _migrations");
      expect(updatedVer[0]?.version).toBe(1);

      await adapter.close();
    });

    it("stores and queries records durably via count and select all", async () => {
      const adapter = new IndexedDBAdapter("test-idb-data");
      await adapter.initialize();

      // Insert projects
      await adapter.execute("INSERT INTO projects (id, name) VALUES (?, ?)", [{ id: "p1", name: "Alpha Project" }]);
      await adapter.execute("INSERT INTO projects (id, name) VALUES (?, ?)", [{ id: "p2", name: "Beta Project" }]);

      // Query count
      const countRes = await adapter.query<{ count: number }>("SELECT COUNT(*) as count FROM projects");
      expect(countRes[0]?.count).toBe(2);

      // Select all
      const allRes = await adapter.query<{ id: string; name: string }>("SELECT * FROM projects");
      expect(allRes).toHaveLength(2);
      expect(allRes.some((p) => p.name === "Alpha Project")).toBe(true);
      expect(allRes.some((p) => p.name === "Beta Project")).toBe(true);

      await adapter.close();
    });
  });

  describe("StorageService (Durable Fallback Hierarchy & Zero Silent Data Loss)", () => {
    it("automatically activates durable IndexedDBAdapter fallback when OPFS SAHPool is unavailable", async () => {
      const service = new StorageService();
      await service.initialize();

      const diagnostics = service.getDiagnostics();
      expect(diagnostics.isInitialized).toBe(true);
      expect(diagnostics.activeEngine).toBe("indexeddb");
      expect(diagnostics.fallbackActive).toBe(true);
      expect(diagnostics.fallbackReason).toBeDefined();
      expect(diagnostics.isDurable).toBe(true);

      // Verify service can execute through fallback adapter
      await service.execute("INSERT INTO entities (id, name) VALUES (?, ?)", [{ id: "e1", name: "users_table" }]);

      const count = await service.query<{ count: number }>("SELECT COUNT(*) as count FROM entities");
      expect(count[0]?.count).toBe(1);

      await service.close();
    });

    it("accepts custom injected adapter for testing SQLite workflows", async () => {
      const customAdapter = new OPFSSQLiteAdapter("custom_sqlite.db", sqliteWorkerApi);
      await customAdapter.initialize({ allowMemoryFallback: true });

      const service = new StorageService();
      await service.initialize(customAdapter);

      const diagnostics = service.getDiagnostics();
      expect(diagnostics.isInitialized).toBe(true);
      expect(diagnostics.activeEngine).toBe("memory-fallback");
      expect(diagnostics.fallbackActive).toBe(true);

      await service.execute("CREATE TABLE flags (key TEXT PRIMARY KEY, val TEXT);");
      await service.execute("INSERT INTO flags (key, val) VALUES (?, ?);", ["FEATURE_X", "ENABLED"]);

      const rows = await service.query<{ key: string; val: string }>("SELECT key, val FROM flags WHERE key = ?;", [
        "FEATURE_X",
      ]);
      expect(rows).toEqual([{ key: "FEATURE_X", val: "ENABLED" }]);

      await service.close();
    });

    it("strictly refuses in-memory fallback and throws fatal error if both OPFS and IndexedDB fail", async () => {
      // Mock IndexedDBAdapter to throw on initialization
      vi.spyOn(IndexedDBAdapter.prototype, "initialize").mockRejectedValue(
        new Error("Simulated browser storage permission denied"),
      );

      const service = new StorageService();

      await expect(service.initialize()).rejects.toThrow("Fatal Storage Failure");
      expect(service.getDiagnostics().isInitialized).toBe(false);
      expect(service.getDiagnostics().activeEngine).toBe("none");
    });
  });
});
