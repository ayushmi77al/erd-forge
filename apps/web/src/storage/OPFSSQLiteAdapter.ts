import { type Remote, wrap } from "comlink";
import type { SqliteWorkerAPI } from "../workers/sqlite.worker";
import type { StorageAdapter, StorageEngineType } from "./StorageAdapter";

export class OPFSSQLiteAdapter implements StorageAdapter {
  private worker: Worker | null = null;
  private api: Remote<SqliteWorkerAPI> | SqliteWorkerAPI | null = null;
  private dbName: string;
  private isInitialized = false;
  private engineType: StorageEngineType = "opfs-sahpool";

  constructor(dbName = "catalog.db", directApi?: SqliteWorkerAPI, worker?: Worker) {
    this.dbName = dbName;
    if (directApi) {
      this.api = directApi;
    } else if (worker) {
      this.worker = worker;
      this.api = wrap<SqliteWorkerAPI>(worker);
    }
  }

  async initialize(options?: { allowMemoryFallback?: boolean; clearOnInit?: boolean }): Promise<void> {
    if (this.isInitialized && !options?.clearOnInit) {
      return;
    }

    if (!this.api && !this.worker) {
      this.worker = new Worker(new URL("../workers/sqlite.worker.ts", import.meta.url), {
        type: "module",
      });
      this.api = wrap<SqliteWorkerAPI>(this.worker);
    }

    const initResult = await this.api!.init({
      dbName: this.dbName,
      clearOnInit: options?.clearOnInit ?? false,
      allowMemoryFallback: options?.allowMemoryFallback ?? false,
    });

    if (!initResult.success) {
      await this.close();
      throw new Error(`OPFS SQLite initialization failed: ${initResult.error || "Unknown error"}`);
    }

    this.engineType = initResult.isOpfs ? "opfs-sahpool" : "memory-fallback";
    this.isInitialized = true;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.api || !this.isInitialized) throw new Error("OPFSSQLiteAdapter is not initialized.");
    const rows = await this.api.query<T>(sql, params);
    return rows as T[];
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    if (!this.api || !this.isInitialized) throw new Error("OPFSSQLiteAdapter is not initialized.");
    await this.api.execute(sql, params);
  }

  async executeBatch(statements: Array<{ sql: string; params?: any[] }>): Promise<void> {
    if (!this.api || !this.isInitialized) throw new Error("OPFSSQLiteAdapter is not initialized.");
    await this.api.executeBatch(statements);
  }

  async close(): Promise<void> {
    if (this.api) {
      try {
        await this.api.close();
      } catch {
        // Ignore
      }
      this.api = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
  }

  isDurable(): boolean {
    return this.isInitialized && this.engineType === "opfs-sahpool";
  }

  getEngineType(): StorageEngineType {
    return this.engineType;
  }
}
