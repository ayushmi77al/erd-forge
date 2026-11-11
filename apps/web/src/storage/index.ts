import { FileSystemAdapter } from "./FileSystemAdapter";
import { IndexedDBAdapter } from "./IndexedDBAdapter";
import { MigrationRunner } from "./migrations/MigrationRunner";
import { OPFSSQLiteAdapter } from "./OPFSSQLiteAdapter";
import { SafeStorageMigrator } from "./SafeStorageMigrator";
import type { StorageAdapter, StorageEngineType } from "./StorageAdapter";
import { type TabLockCoordinator, type TabRole, tabLockCoordinator } from "./TabLockCoordinator";

export interface StorageDiagnostics {
  isInitialized: boolean;
  activeEngine: StorageEngineType;
  fallbackActive: boolean;
  fallbackReason?: string;
  isDurable: boolean;
  tabRole?: TabRole;
}

export class StorageService {
  public adapter!: StorageAdapter;
  public fsAdapter: FileSystemAdapter;
  public activeEngine: StorageEngineType = "none";
  public fallbackActive = false;
  public fallbackReason?: string;
  private isInitialized = false;
  private lockCoordinator?: TabLockCoordinator;

  constructor() {
    this.fsAdapter = new FileSystemAdapter();
    this.lockCoordinator = tabLockCoordinator;
  }

  setLockCoordinator(coordinator?: TabLockCoordinator): void {
    this.lockCoordinator = coordinator;
  }

  getLockCoordinator(): TabLockCoordinator | undefined {
    return this.lockCoordinator;
  }

  async initialize(
    customAdapter?: StorageAdapter,
    options?: { allowMemoryFallback?: boolean; clearOnInit?: boolean },
  ): Promise<void> {
    if (customAdapter) {
      this.adapter = customAdapter;
      await this.adapter.initialize(options);
      this.activeEngine = this.adapter.getEngineType();
      this.isInitialized = true;
      this.fallbackActive = this.activeEngine !== "opfs-sahpool";
      return;
    }

    // 1. Attempt Tier 1: OPFS SAHPool SQLite
    try {
      const opfsAdapter = new OPFSSQLiteAdapter();
      await opfsAdapter.initialize({ allowMemoryFallback: false });
      this.adapter = opfsAdapter;
      this.activeEngine = "opfs-sahpool";
      this.fallbackActive = false;
      this.isInitialized = true;
      console.log("[StorageService] Active storage engine: OPFS SAHPool SQLite");
    } catch (opfsErr: any) {
      const reason = opfsErr instanceof Error ? opfsErr.message : String(opfsErr);
      console.warn("[StorageService] OPFS SAHPool initialization failed; falling back to durable IndexedDB:", reason);
      this.fallbackReason = reason;

      // 2. Attempt Tier 2: Durable IndexedDBAdapter fallback
      try {
        const idbAdapter = new IndexedDBAdapter();
        await idbAdapter.initialize();
        this.adapter = idbAdapter;
        this.activeEngine = "indexeddb";
        this.fallbackActive = true;
        this.isInitialized = true;
        console.warn("[StorageService] Active storage engine: IndexedDB (Durable Fallback Mode)");
      } catch (idbErr: any) {
        // 3. Both failed! Enforce Zero Silent Data Loss: Refuse volatile in-memory fallback
        this.activeEngine = "none";
        this.isInitialized = false;
        const fatalMsg = `Fatal Storage Failure: Both OPFS SAHPool and IndexedDB failed to initialize. Data cannot be written safely. Error: ${idbErr?.message || String(idbErr)}`;
        console.error("[StorageService]", fatalMsg);
        throw new Error(fatalMsg);
      }
    }

    // Run schema migrations if SQLite engine is active
    if (this.activeEngine === "opfs-sahpool") {
      try {
        await MigrationRunner.run(this.adapter);

        // Attempt non-destructive data migration from legacy IndexedDB if present
        try {
          const idbSource = new IndexedDBAdapter();
          await idbSource.initialize();
          const migResult = await SafeStorageMigrator.migrate(idbSource, this.adapter, {
            backupToStorage: true,
          });
          if (migResult.success && !migResult.alreadyMigrated && migResult.migratedCount > 0) {
            console.log(
              `[StorageService] Successfully migrated ${migResult.migratedCount} legacy records into OPFS SQLite.`,
            );
          }
          await idbSource.close();
        } catch (migErr) {
          console.warn("[StorageService] Legacy data migration check skipped or completed non-fatally:", migErr);
        }
      } catch (migErr) {
        console.error("[StorageService] Migration failed on active adapter:", migErr);
      }
    }
  }

  // Proxied adapter methods
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.adapter) throw new Error("StorageService is not initialized.");
    return this.adapter.query<T>(sql, params);
  }

  async execute(sql: string, params?: any[]): Promise<void> {
    if (!this.adapter) throw new Error("StorageService is not initialized.");
    const role = this.lockCoordinator?.getRole();
    if (role === "follower" || role === "readonly") {
      throw new Error(
        `Write rejected: Tab role is '${role}'. Leader tab is '${this.lockCoordinator?.getActiveLeaderId() || "unknown"}'.`,
      );
    }
    return this.adapter.execute(sql, params);
  }

  async executeBatch(statements: Array<{ sql: string; params?: any[] }>): Promise<void> {
    if (!this.adapter) throw new Error("StorageService is not initialized.");
    const role = this.lockCoordinator?.getRole();
    if (role === "follower" || role === "readonly") {
      throw new Error(
        `Write rejected: Tab role is '${role}'. Leader tab is '${this.lockCoordinator?.getActiveLeaderId() || "unknown"}'.`,
      );
    }
    if (this.adapter.executeBatch) {
      return this.adapter.executeBatch(statements);
    }
    for (const stmt of statements) {
      await this.adapter.execute(stmt.sql, stmt.params);
    }
  }

  async close(): Promise<void> {
    if (this.adapter) {
      await this.adapter.close();
      this.activeEngine = "none";
      this.isInitialized = false;
    }
  }

  getDiagnostics(): StorageDiagnostics {
    return {
      isInitialized: this.isInitialized,
      activeEngine: this.activeEngine,
      fallbackActive: this.fallbackActive,
      fallbackReason: this.fallbackReason,
      isDurable: this.adapter ? this.adapter.isDurable() : false,
      tabRole: this.lockCoordinator ? this.lockCoordinator.getRole() : undefined,
    };
  }
}

export const storageService = new StorageService();
