import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { expose } from "comlink";

export interface SqliteInitOptions {
  dbName?: string;
  clearOnInit?: boolean;
  allowMemoryFallback?: boolean;
}

export interface SqliteInitResult {
  success: boolean;
  isOpfs: boolean;
  vfsName: string;
  sqliteVersion: string;
  error?: string;
}

export interface SqliteDiagnostics {
  isInitialized: boolean;
  isOpfs: boolean;
  vfsName: string;
  dbName: string;
  sqliteVersion: string;
}

let sqlite3Instance: any = null;
let db: any = null;
let currentVfs = "none";
let currentDbName = "";

export async function getSqlite3() {
  if (!sqlite3Instance) {
    sqlite3Instance = await sqlite3InitModule();
  }
  return sqlite3Instance;
}

export const sqliteWorkerApi = {
  /**
   * Checks whether the browser environment has the required APIs for OPFS SAHPool
   */
  async isOpfsAvailable(): Promise<boolean> {
    try {
      const sqlite3 = await getSqlite3();
      return (
        typeof sqlite3.installOpfsSAHPoolVfs === "function" &&
        typeof (globalThis as any).FileSystemFileHandle?.prototype?.createSyncAccessHandle === "function" &&
        typeof (navigator as any)?.storage?.getDirectory === "function"
      );
    } catch {
      return false;
    }
  },

  /**
   * Initializes the SQLite database engine.
   * Attempts to install and register OPFS SAHPool VFS. If unavailable and allowMemoryFallback
   * is set (e.g. during test suites), uses standard SQLite in-memory mode.
   */
  async init(options?: SqliteInitOptions): Promise<SqliteInitResult> {
    try {
      const sqlite3 = await getSqlite3();
      const dbName = options?.dbName || "catalog.db";
      currentDbName = dbName;

      // Close existing database instance if any
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore
        }
        db = null;
      }

      let isOpfs = false;
      let poolUtil: any = null;

      // Attempt OPFS SAHPool VFS installation
      if (typeof sqlite3.installOpfsSAHPoolVfs === "function") {
        try {
          poolUtil = await sqlite3.installOpfsSAHPoolVfs({
            name: "opfs-sahpool",
            clearOnInit: options?.clearOnInit ?? false,
          });
          isOpfs = true;
          currentVfs = "opfs-sahpool";
        } catch (vfsErr) {
          console.warn("[sqlite.worker] OPFS SAHPool installation failed or unsupported in this context:", vfsErr);
        }
      }

      if (isOpfs && poolUtil?.OpfsSAHPoolDb) {
        db = new poolUtil.OpfsSAHPoolDb(dbName);
      } else if (options?.allowMemoryFallback) {
        // Fallback for node test environments or memory simulation
        db = new sqlite3.oo1.DB(dbName, "c");
        currentVfs = "memory-fallback";
      } else {
        return {
          success: false,
          isOpfs: false,
          vfsName: "none",
          sqliteVersion: sqlite3.version?.libVersion || "unknown",
          error: "OPFS SAHPool VFS is unavailable in this environment and memory fallback was not permitted.",
        };
      }

      return {
        success: true,
        isOpfs,
        vfsName: currentVfs,
        sqliteVersion: sqlite3.version?.libVersion || "unknown",
      };
    } catch (err: any) {
      return {
        success: false,
        isOpfs: false,
        vfsName: "none",
        sqliteVersion: "unknown",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  /**
   * Runs a SQL SELECT query and returns rows as objects
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!db) throw new Error("SQLite database is not initialized.");
    const rows: T[] = [];
    db.exec({
      sql,
      bind: params,
      rowMode: "object",
      callback: (row: any) => {
        rows.push({ ...row } as T);
      },
    });
    return rows;
  },

  /**
   * Executes a single DDL or DML statement
   */
  async execute(sql: string, params: any[] = []): Promise<void> {
    if (!db) throw new Error("SQLite database is not initialized.");
    db.exec({
      sql,
      bind: params,
    });
  },

  /**
   * Executes multiple statements atomically inside a single SQLite transaction
   */
  async executeBatch(statements: Array<{ sql: string; params?: any[] }>): Promise<void> {
    if (!db) throw new Error("SQLite database is not initialized.");
    db.transaction((database: any) => {
      for (const stmt of statements) {
        database.exec({
          sql: stmt.sql,
          bind: stmt.params || [],
        });
      }
    });
  },

  /**
   * Closes the active database connection
   */
  async close(): Promise<void> {
    if (db) {
      db.close();
      db = null;
      currentVfs = "none";
    }
  },

  /**
   * Returns current engine diagnostics
   */
  async getDiagnostics(): Promise<SqliteDiagnostics> {
    const sqlite3 = await getSqlite3().catch(() => null);
    return {
      isInitialized: db !== null,
      isOpfs: currentVfs === "opfs-sahpool",
      vfsName: currentVfs,
      dbName: currentDbName,
      sqliteVersion: sqlite3?.version?.libVersion || "unknown",
    };
  },
};

export type SqliteWorkerAPI = typeof sqliteWorkerApi;

// Expose via Comlink only when running inside a dedicated worker thread
const isDedicatedWorker =
  typeof self !== "undefined" &&
  typeof (self as any).postMessage === "function" &&
  typeof (self as any).document === "undefined";

if (isDedicatedWorker) {
  expose(sqliteWorkerApi);
}
