import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IndexedDBAdapter } from "../../src/storage/IndexedDBAdapter";
import { StorageService } from "../../src/storage/index";
import { OPFSSQLiteAdapter } from "../../src/storage/OPFSSQLiteAdapter";
import { TabLockCoordinator } from "../../src/storage/TabLockCoordinator";
import { sqliteWorkerApi } from "../../src/workers/sqlite.worker";

describe("T3.5: Storage Failure Injection & Adversarial Matrix", () => {
  beforeEach(async () => {
    await sqliteWorkerApi.close();
  });

  describe("1. Private Browsing Simulation (Zero OPFS Support)", () => {
    it("transparently activates durable IndexedDB fallback when OPFS SAHPool throws SecurityError", async () => {
      const storage = new StorageService();

      // Mock OPFS initialization to throw SecurityError (standard in private browsing / incognito mode)
      const opfsSpy = vi
        .spyOn(OPFSSQLiteAdapter.prototype, "initialize")
        .mockRejectedValueOnce(
          new DOMException(
            "Access to storage directory denied: createSyncAccessHandle is restricted in private browsing mode.",
            "SecurityError",
          ),
        );

      // Initialize storage with fallback expectation
      await storage.initialize(undefined, { allowMemoryFallback: false });

      const diagnostics = storage.getDiagnostics();
      expect(diagnostics.isInitialized).toBe(true);
      expect(diagnostics.activeEngine).toBe("indexeddb");
      expect(diagnostics.fallbackActive).toBe(true);
      expect(diagnostics.isDurable).toBe(true);
      expect(diagnostics.fallbackReason).toContain("private browsing mode");

      // Verify that writes and reads to durable fallback succeed seamlessly
      await storage.execute("INSERT INTO projects (id, name) VALUES (?, ?);", [
        { id: "incognito_proj_1", name: "Private Browsing Session" },
      ]);

      const projects = await storage.query("SELECT * FROM projects");
      expect(projects).toHaveLength(1);
      expect(projects[0]).toMatchObject({ id: "incognito_proj_1", name: "Private Browsing Session" });

      opfsSpy.mockRestore();
      await storage.close();
    });

    it("strictly refuses in-memory degradation if both OPFS and IndexedDB are blocked", async () => {
      const storage = new StorageService();

      // Mock IndexedDB to also fail
      const idbSpy = vi
        .spyOn(IndexedDBAdapter.prototype, "initialize")
        .mockRejectedValueOnce(new Error("IDBFactory.open denied by user privacy extension"));

      await expect(storage.initialize()).rejects.toThrow(
        "Fatal Storage Failure: Both OPFS SAHPool and IndexedDB failed to initialize. Data cannot be written safely.",
      );

      const diagnostics = storage.getDiagnostics();
      expect(diagnostics.isInitialized).toBe(false);
      expect(diagnostics.activeEngine).toBe("none");

      idbSpy.mockRestore();
    });
  });

  describe("2. Persistence Across Reloads (Durable State Lifecycle)", () => {
    it("preserves catalog schemas across database close and re-open without data loss", async () => {
      const dbName = "persistent_lifecycle_test.db";

      // Session 1: Create table, insert data
      const session1 = new OPFSSQLiteAdapter(dbName, sqliteWorkerApi);
      await session1.initialize({ allowMemoryFallback: true, clearOnInit: true });

      await session1.execute(`
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          price REAL NOT NULL
        );
      `);

      await session1.execute("INSERT INTO products (id, title, price) VALUES (?, ?, ?);", [
        "prod_100",
        "Analytics Dashboard",
        249.99,
      ]);

      const rows1 = await session1.query("SELECT * FROM products;");
      expect(rows1).toHaveLength(1);
      await session1.close();

      // Session 2: Re-open without clearOnInit, verify rows persisted
      const session2 = new OPFSSQLiteAdapter(dbName, sqliteWorkerApi);
      await session2.initialize({ allowMemoryFallback: true, clearOnInit: false });

      const rows2 = await session2.query<{ id: string; title: string; price: number }>(
        "SELECT id, title, price FROM products WHERE id = ?;",
        ["prod_100"],
      );
      expect(rows2).toEqual([{ id: "prod_100", title: "Analytics Dashboard", price: 249.99 }]);

      await session2.close();
    });
  });

  describe("3. Multi-Tab Crash & Deadlock Watchdog Recovery", () => {
    it("recovers leadership automatically when primary tab freezes or crashes ungracefully", async () => {
      const channelName = "adversarial-crash-recovery";

      const tab1 = new TabLockCoordinator({
        channelName,
        heartbeatIntervalMs: 40,
        heartbeatTimeoutMs: 100,
        electionTimeoutMs: 40,
      });
      await tab1.acquireLease();
      expect(tab1.getRole()).toBe("leader");

      const tab2 = new TabLockCoordinator({
        channelName,
        heartbeatIntervalMs: 40,
        heartbeatTimeoutMs: 100,
        electionTimeoutMs: 40,
      });
      await tab2.acquireLease();
      expect(tab2.getRole()).toBe("follower");

      // Simulate abrupt Tab 1 crash: kill heartbeat timers without releasing lease
      (tab1 as any).stopHeartbeat();

      // Wait for watchdog to detect heartbeat silence > 100ms
      await new Promise((resolve) => setTimeout(resolve, 180));

      expect(tab2.getRole()).toBe("leader");
      expect(tab2.getActiveLeaderId()).toBe(tab2.getTabId());

      tab1.dispose();
      tab2.dispose();
    });

    it("prevents write race when follower tab attempts rogue writes", async () => {
      const storage = new StorageService();
      const mockAdapter = {
        name: "MockAdapter",
        initialize: vi.fn().mockResolvedValue(undefined),
        execute: vi.fn().mockResolvedValue(undefined),
        executeBatch: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue([]),
        close: vi.fn().mockResolvedValue(undefined),
        getEngineType: () => "opfs-sahpool" as const,
        isDurable: () => true,
      };

      await storage.initialize(mockAdapter as any);

      const coord = new TabLockCoordinator({
        channelName: "rogue-write-test",
        heartbeatIntervalMs: 50,
        heartbeatTimeoutMs: 120,
      });
      storage.setLockCoordinator(coord);

      // Force follower role
      (coord as any).role = "follower";
      (coord as any).activeLeaderId = "other_tab_leader";

      await expect(storage.execute("DELETE FROM entities;")).rejects.toThrow(
        "Write rejected: Tab role is 'follower'. Leader tab is 'other_tab_leader'.",
      );

      coord.dispose();
    });
  });
});
