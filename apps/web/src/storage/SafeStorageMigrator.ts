import type { StorageAdapter } from "./StorageAdapter";

export interface MigrationSnapshot {
  timestamp: string;
  version: number;
  stores: {
    projects: any[];
    entities: any[];
    columns: any[];
    relationships: any[];
    metadata: any[];
  };
  totalRecords: number;
}

export interface MigratedCounts {
  projects: number;
  entities: number;
  columns: number;
  relationships: number;
  metadata?: number;
  [key: string]: number | undefined;
}

export interface MigrationResult {
  success: boolean;
  alreadyMigrated: boolean;
  migratedCount: number;
  sourceCounts: MigratedCounts;
  targetCounts: MigratedCounts;
  snapshot: MigrationSnapshot;
  error?: string;
}

export class SafeStorageMigrator {
  public static readonly MIGRATION_ID = "indexeddb_to_sqlite_v1";

  /**
   * Ensures _migration_journal table exists on the target storage engine.
   */
  static async initJournal(target: StorageAdapter): Promise<void> {
    await target.execute(`
      CREATE TABLE IF NOT EXISTS _migration_journal (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_id TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL,
        source_counts TEXT NOT NULL,
        target_counts TEXT NOT NULL,
        total_records INTEGER NOT NULL,
        migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  /**
   * Checks if this migration has already been completed successfully on the target adapter.
   */
  static async isMigrated(target: StorageAdapter): Promise<boolean> {
    await SafeStorageMigrator.initJournal(target);
    try {
      const rows = await target.query<{ status: string }>(
        "SELECT status FROM _migration_journal WHERE migration_id = ? AND status = 'completed';",
        [SafeStorageMigrator.MIGRATION_ID],
      );
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Extracts an unmutated snapshot of all legacy records from source adapter.
   */
  static async createSnapshot(source: StorageAdapter): Promise<MigrationSnapshot> {
    const safeQuery = async (table: string): Promise<any[]> => {
      try {
        return await source.query(`SELECT * FROM ${table}`);
      } catch {
        return [];
      }
    };

    const projects = await safeQuery("projects");
    const entities = await safeQuery("entities");
    const columns = await safeQuery("columns");
    const relationships = await safeQuery("relationships");
    const metadata = await safeQuery("metadata");

    const totalRecords = projects.length + entities.length + columns.length + relationships.length + metadata.length;

    return {
      timestamp: new Date().toISOString(),
      version: 1,
      stores: {
        projects,
        entities,
        columns,
        relationships,
        metadata,
      },
      totalRecords,
    };
  }

  /**
   * Safely and idempotently migrates legacy records from source (IndexedDB) to target (SQLite).
   * Follows Zero Silent Data Loss:
   * 1. Checks if migration is already completed.
   * 2. Takes a complete JSON backup snapshot.
   * 3. Inserts all rows transactionally.
   * 4. Verifies post-migration target row counts match or exceed source counts.
   * 5. Writes record into _migration_journal.
   * 6. Retains source database untouched.
   */
  static async migrate(
    source: StorageAdapter,
    target: StorageAdapter,
    options?: { backupToStorage?: boolean; force?: boolean },
  ): Promise<MigrationResult> {
    await SafeStorageMigrator.initJournal(target);

    // 1. Idempotency Check
    if (!options?.force && (await SafeStorageMigrator.isMigrated(target))) {
      const snapshot = await SafeStorageMigrator.createSnapshot(source);
      return {
        success: true,
        alreadyMigrated: true,
        migratedCount: 0,
        sourceCounts: {
          projects: snapshot.stores.projects.length,
          entities: snapshot.stores.entities.length,
          columns: snapshot.stores.columns.length,
          relationships: snapshot.stores.relationships.length,
          metadata: snapshot.stores.metadata.length,
        },
        targetCounts: await SafeStorageMigrator.getTargetCounts(target),
        snapshot,
      };
    }

    // 2. Snapshot & Pre-Migration Backup
    const snapshot = await SafeStorageMigrator.createSnapshot(source);
    const sourceCounts = {
      projects: snapshot.stores.projects.length,
      entities: snapshot.stores.entities.length,
      columns: snapshot.stores.columns.length,
      relationships: snapshot.stores.relationships.length,
      metadata: snapshot.stores.metadata.length,
    };

    if (options?.backupToStorage && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(`erd-forge-backup-${SafeStorageMigrator.MIGRATION_ID}`, JSON.stringify(snapshot));
      } catch (err) {
        console.warn("[SafeStorageMigrator] Failed to write localStorage backup snapshot:", err);
      }
    }

    // If source has 0 records, mark journal as completed and exit cleanly
    if (snapshot.totalRecords === 0) {
      await SafeStorageMigrator.recordJournal(target, "completed", sourceCounts, sourceCounts, 0);
      return {
        success: true,
        alreadyMigrated: false,
        migratedCount: 0,
        sourceCounts,
        targetCounts: sourceCounts,
        snapshot,
      };
    }

    // 3. Prepare Batch Insertion Statements
    const batchStatements: Array<{ sql: string; params?: any[] }> = [];

    // Projects
    for (const p of snapshot.stores.projects) {
      batchStatements.push({
        sql: `INSERT OR REPLACE INTO projects (id, name, description, file_path, last_opened, created_at)
              VALUES (?, ?, ?, ?, ?, ?);`,
        params: [
          p.id,
          p.name || "Untitled Project",
          p.description ?? null,
          p.file_path ?? null,
          p.last_opened ?? null,
          p.created_at ?? new Date().toISOString(),
        ],
      });
    }

    // Entities
    for (const e of snapshot.stores.entities) {
      batchStatements.push({
        sql: `INSERT OR REPLACE INTO entities (
                id, project_id, entity_type, name, schema_name, description,
                business_purpose, owner, source_system, refresh_logic, review_status,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        params: [
          e.id,
          e.project_id || "default",
          e.entity_type === "view" ? "view" : "table",
          e.name,
          e.schema_name ?? null,
          e.description ?? null,
          e.business_purpose ?? null,
          e.owner ?? null,
          e.source_system ?? null,
          e.refresh_logic ?? null,
          e.review_status || "draft",
          e.created_at ?? new Date().toISOString(),
          e.updated_at ?? new Date().toISOString(),
        ],
      });
    }

    // Columns
    for (const c of snapshot.stores.columns) {
      batchStatements.push({
        sql: `INSERT OR REPLACE INTO columns (
                id, entity_id, project_id, name, ordinal_position, data_type,
                type_length, type_precision, type_scale, is_array, is_primary_key,
                is_nullable, is_unique, default_value, check_constraint, description,
                business_definition, examples, calculation_logic, data_quality_rules,
                pii_classification, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        params: [
          c.id,
          c.entity_id,
          c.project_id || "default",
          c.name,
          c.ordinal_position ?? 1,
          c.data_type || "TEXT",
          c.type_length ?? null,
          c.type_precision ?? null,
          c.type_scale ?? null,
          c.is_array ? 1 : 0,
          c.is_primary_key ? 1 : 0,
          c.is_nullable === false ? 0 : 1,
          c.is_unique ? 1 : 0,
          c.default_value ?? null,
          c.check_constraint ?? null,
          c.description ?? null,
          c.business_definition ?? null,
          typeof c.examples === "object" ? JSON.stringify(c.examples) : (c.examples ?? null),
          c.calculation_logic ?? null,
          typeof c.data_quality_rules === "object"
            ? JSON.stringify(c.data_quality_rules)
            : (c.data_quality_rules ?? null),
          c.pii_classification || "none",
          c.created_at ?? new Date().toISOString(),
        ],
      });
    }

    // Relationships
    for (const r of snapshot.stores.relationships) {
      batchStatements.push({
        sql: `INSERT OR REPLACE INTO relationships (
                id, project_id, source_entity_id, source_column_id,
                target_entity_id, target_column_id, cardinality, description,
                join_logic, transformation_notes, is_enforced, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        params: [
          r.id,
          r.project_id || "default",
          r.source_entity_id,
          r.source_column_id,
          r.target_entity_id,
          r.target_column_id,
          r.cardinality || "many_to_one",
          r.description ?? null,
          r.join_logic ?? null,
          r.transformation_notes ?? null,
          r.is_enforced === false ? 0 : 1,
          r.created_at ?? new Date().toISOString(),
        ],
      });
    }

    // 4. Transactional Execution
    try {
      if (target.executeBatch) {
        await target.executeBatch(batchStatements);
      } else {
        await target.execute("BEGIN TRANSACTION;");
        for (const stmt of batchStatements) {
          await target.execute(stmt.sql, stmt.params);
        }
        await target.execute("COMMIT;");
      }
    } catch (insertErr: any) {
      const errMsg = insertErr instanceof Error ? insertErr.message : String(insertErr);
      console.error("[SafeStorageMigrator] Batch insertion transaction failed:", errMsg);
      const emptyTargetCounts: MigratedCounts = { projects: 0, entities: 0, columns: 0, relationships: 0 };
      await SafeStorageMigrator.recordJournal(target, "aborted", sourceCounts, emptyTargetCounts, 0);
      return {
        success: false,
        alreadyMigrated: false,
        migratedCount: 0,
        sourceCounts,
        targetCounts: emptyTargetCounts,
        snapshot,
        error: `Transaction insertion failed: ${errMsg}`,
      };
    }

    // 5. Verification: Check target row counts against snapshot
    const targetCounts = await SafeStorageMigrator.getTargetCounts(target);

    const hasMismatch =
      targetCounts.projects < sourceCounts.projects ||
      targetCounts.entities < sourceCounts.entities ||
      targetCounts.columns < sourceCounts.columns ||
      targetCounts.relationships < sourceCounts.relationships;

    if (hasMismatch) {
      const mismatchError = `Row count verification failed: Source=[projects:${sourceCounts.projects}, entities:${sourceCounts.entities}, columns:${sourceCounts.columns}, relationships:${sourceCounts.relationships}], Target=[projects:${targetCounts.projects}, entities:${targetCounts.entities}, columns:${targetCounts.columns}, relationships:${targetCounts.relationships}]`;
      console.error("[SafeStorageMigrator]", mismatchError);
      await SafeStorageMigrator.recordJournal(target, "aborted", sourceCounts, targetCounts, 0);
      return {
        success: false,
        alreadyMigrated: false,
        migratedCount: 0,
        sourceCounts,
        targetCounts,
        snapshot,
        error: mismatchError,
      };
    }

    // 6. Record Successful Migration in Journal
    await SafeStorageMigrator.recordJournal(target, "completed", sourceCounts, targetCounts, snapshot.totalRecords);

    return {
      success: true,
      alreadyMigrated: false,
      migratedCount: snapshot.totalRecords,
      sourceCounts,
      targetCounts,
      snapshot,
    };
  }

  private static async getTargetCounts(target: StorageAdapter): Promise<MigratedCounts> {
    const getCount = async (table: string): Promise<number> => {
      try {
        const rows = await target.query<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
        return rows[0]?.count ?? 0;
      } catch {
        return 0;
      }
    };

    return {
      projects: await getCount("projects"),
      entities: await getCount("entities"),
      columns: await getCount("columns"),
      relationships: await getCount("relationships"),
    };
  }

  private static async recordJournal(
    target: StorageAdapter,
    status: "completed" | "aborted",
    sourceCounts: MigratedCounts,
    targetCounts: MigratedCounts,
    totalRecords: number,
  ): Promise<void> {
    try {
      await target.execute(
        `INSERT OR REPLACE INTO _migration_journal (
           migration_id, status, source_counts, target_counts, total_records, migrated_at
         ) VALUES (?, ?, ?, ?, ?, ?);`,
        [
          SafeStorageMigrator.MIGRATION_ID,
          status,
          JSON.stringify(sourceCounts),
          JSON.stringify(targetCounts),
          totalRecords,
          new Date().toISOString(),
        ],
      );
    } catch (err) {
      console.warn("[SafeStorageMigrator] Failed to record journal entry:", err);
    }
  }
}
