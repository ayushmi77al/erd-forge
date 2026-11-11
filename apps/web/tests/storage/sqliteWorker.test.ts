import { beforeEach, describe, expect, it } from "vitest";
import { getSqlite3, sqliteWorkerApi } from "../../src/workers/sqlite.worker";

describe("T3.1: SQLite WASM Worker Engine & OPFS SAHPool Integration", () => {
  beforeEach(async () => {
    await sqliteWorkerApi.close();
  });

  it("successfully loads official @sqlite.org/sqlite-wasm binary", async () => {
    const sqlite3 = await getSqlite3();
    expect(sqlite3).toBeDefined();
    expect(sqlite3.version).toBeDefined();
    expect(sqlite3.version.libVersion).toMatch(/^3\.\d+\.\d+/);
    expect(sqlite3.oo1).toBeDefined();
    expect(typeof sqlite3.oo1.DB).toBe("function");
  });

  it("checks OPFS availability based on environment capabilities", async () => {
    const isAvailable = await sqliteWorkerApi.isOpfsAvailable();
    // In Node.js / non-browser test environment, sync access handles do not exist
    expect(typeof isAvailable).toBe("boolean");
  });

  it("enforces Zero Silent Data Loss: rejects initialization if OPFS SAHPool is unavailable and memory fallback is disallowed", async () => {
    const result = await sqliteWorkerApi.init({
      dbName: "catalog.db",
      allowMemoryFallback: false,
    });

    // In Node test runner without browser OPFS SAH, it must NOT silently use memory
    expect(result.success).toBe(false);
    expect(result.isOpfs).toBe(false);
    expect(result.error).toContain("OPFS SAHPool VFS is unavailable");
  });

  it("initializes successfully when memory fallback is explicitly allowed for testing", async () => {
    const result = await sqliteWorkerApi.init({
      dbName: "test_catalog.db",
      allowMemoryFallback: true,
    });

    expect(result.success).toBe(true);
    expect(result.sqliteVersion).toMatch(/^3\.\d+\.\d+/);

    const diagnostics = await sqliteWorkerApi.getDiagnostics();
    expect(diagnostics.isInitialized).toBe(true);
    expect(diagnostics.dbName).toBe("test_catalog.db");
  });

  it("executes DDL, DML with parameter binding, and queries rows", async () => {
    await sqliteWorkerApi.init({ dbName: "test.db", allowMemoryFallback: true });

    // Create table
    await sqliteWorkerApi.execute(`
      CREATE TABLE test_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version INTEGER NOT NULL
      );
    `);

    // Insert with parameters
    await sqliteWorkerApi.execute("INSERT INTO test_projects (id, name, version) VALUES (?, ?, ?);", [
      "proj-1",
      "E-Commerce Schema",
      1,
    ]);
    await sqliteWorkerApi.execute("INSERT INTO test_projects (id, name, version) VALUES (?, ?, ?);", [
      "proj-2",
      "Analytics Warehouse",
      2,
    ]);

    // Query rows
    interface ProjectRow {
      id: string;
      name: string;
      version: number;
    }

    const rows = await sqliteWorkerApi.query<ProjectRow>(
      "SELECT id, name, version FROM test_projects ORDER BY version ASC;",
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: "proj-1", name: "E-Commerce Schema", version: 1 });
    expect(rows[1]).toEqual({ id: "proj-2", name: "Analytics Warehouse", version: 2 });
  });

  it("executes batch statements inside an atomic transaction", async () => {
    await sqliteWorkerApi.init({ dbName: "batch.db", allowMemoryFallback: true });

    await sqliteWorkerApi.execute(`
      CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT NOT NULL
      );
    `);

    const batch = [
      { sql: "INSERT INTO audit_log (event_name) VALUES (?);", params: ["INIT"] },
      { sql: "INSERT INTO audit_log (event_name) VALUES (?);", params: ["MIGRATE"] },
      { sql: "INSERT INTO audit_log (event_name) VALUES (?);", params: ["SYNC"] },
    ];

    await sqliteWorkerApi.executeBatch(batch);

    const results = await sqliteWorkerApi.query<{ count: number }>("SELECT COUNT(*) as count FROM audit_log;");
    expect(results[0]?.count).toBe(3);
  });

  it("throws descriptive error when query is attempted on uninitialized database", async () => {
    await sqliteWorkerApi.close();

    await expect(sqliteWorkerApi.query("SELECT 1;")).rejects.toThrow("SQLite database is not initialized.");
    await expect(sqliteWorkerApi.execute("SELECT 1;")).rejects.toThrow("SQLite database is not initialized.");
  });

  it("properly closes database connection and resets diagnostics", async () => {
    await sqliteWorkerApi.init({ dbName: "close_test.db", allowMemoryFallback: true });
    let diag = await sqliteWorkerApi.getDiagnostics();
    expect(diag.isInitialized).toBe(true);

    await sqliteWorkerApi.close();
    diag = await sqliteWorkerApi.getDiagnostics();
    expect(diag.isInitialized).toBe(false);
    expect(diag.vfsName).toBe("none");
  });
});
