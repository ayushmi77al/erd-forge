import { type IDBPDatabase, openDB } from "idb";
import type { StorageAdapter, StorageEngineType } from "./StorageAdapter";

export class IndexedDBAdapter implements StorageAdapter {
  private db: IDBPDatabase | null = null;
  private dbName: string;

  constructor(dbName = "erd-forge-catalog") {
    this.dbName = dbName;
  }

  async initialize(): Promise<void> {
    this.db = await openDB(this.dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("entities")) {
          db.createObjectStore("entities", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("columns")) {
          db.createObjectStore("columns", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("relationships")) {
          db.createObjectStore("relationships", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("metadata")) {
          db.createObjectStore("metadata", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("_migrations")) {
          db.createObjectStore("_migrations", { keyPath: "version" });
        }
        if (!db.objectStoreNames.contains("_migration_journal")) {
          db.createObjectStore("_migration_journal", { keyPath: "id", autoIncrement: true });
        }
      },
    });
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) throw new Error("IndexedDBAdapter is not initialized.");

    const normalized = sql.trim().toLowerCase();

    // Migration version check: SELECT MAX(version) as version FROM _migrations
    if (normalized.includes("select max(version)") || normalized.includes("from _migrations")) {
      const allMigrations = await this.db.getAll("_migrations");
      const maxVersion = allMigrations.reduce((max: number, m: any) => Math.max(max, m.version || 0), 0);
      return [{ version: maxVersion }] as unknown as T[];
    }

    // Generic COUNT(*) query: SELECT COUNT(*) as count FROM <table>
    const countMatch = normalized.match(/select\s+count\(\*\)\s+(?:as\s+\w+\s+)?from\s+(\w+)/i);
    if (countMatch && countMatch[1]) {
      const storeName = countMatch[1];
      if (this.db.objectStoreNames.contains(storeName)) {
        const count = await this.db.count(storeName);
        return [{ count }] as unknown as T[];
      }
      return [{ count: 0 }] as unknown as T[];
    }

    // SELECT * FROM <table>
    const selectAllMatch = normalized.match(/select\s+\*\s+from\s+(\w+)/i);
    if (selectAllMatch && selectAllMatch[1]) {
      const storeName = selectAllMatch[1];
      if (this.db.objectStoreNames.contains(storeName)) {
        const items = await this.db.getAll(storeName);
        return items as T[];
      }
    }

    return [];
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    if (!this.db) throw new Error("IndexedDBAdapter is not initialized.");

    const normalized = sql.trim().toLowerCase();

    // Table / Index creation DDL is already satisfied by IDB object stores
    if (normalized.startsWith("create table") || normalized.startsWith("create index")) {
      return;
    }

    // Migration INSERT: INSERT INTO _migrations (version, name) VALUES (1, "001_initial_schema")
    if (normalized.includes("insert into _migrations")) {
      const versionMatch = sql.match(/values\s*\(\s*(\d+)\s*,\s*["']([^"']+)["']/i);
      if (versionMatch) {
        const version = Number.parseInt(versionMatch[1] || "1", 10);
        const name = versionMatch[2] || "migration";
        await this.db.put("_migrations", { version, name, applied_at: new Date().toISOString() });
        return;
      }
    }

    // Generic insert / replace if params has record object
    const insertMatch = sql.match(/insert\s+(?:or\s+replace\s+)?into\s+(\w+)/i);
    if (insertMatch && insertMatch[1]) {
      const storeName = insertMatch[1];
      if (this.db.objectStoreNames.contains(storeName) && params.length > 0) {
        if (typeof params[0] === "object" && params[0] !== null) {
          await this.db.put(storeName, params[0]);
        }
      }
    }
  }

  async executeBatch(statements: Array<{ sql: string; params?: any[] }>): Promise<void> {
    for (const stmt of statements) {
      await this.execute(stmt.sql, stmt.params);
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  isDurable(): boolean {
    return true;
  }

  getEngineType(): StorageEngineType {
    return "indexeddb";
  }
}
