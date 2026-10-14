import { StorageAdapter } from '../StorageAdapter';
// @ts-ignore
import initialSchema from './001_initial_schema.sql?raw';

export class MigrationRunner {
  static async run(adapter: StorageAdapter): Promise<void> {
    // Create migrations table if not exists
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check version
    const results = await adapter.query<{ version: number }>('SELECT MAX(version) as version FROM _migrations');
    const currentVersion = results[0]?.version || 0;

    // Run migrations
    if (currentVersion < 1) {
      console.log('Running migration: 001_initial_schema.sql');
      // Split statements and run
      const statements = initialSchema.split(';').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      for (const stmt of statements) {
        await adapter.execute(stmt);
      }
      await adapter.execute('INSERT INTO _migrations (version, name) VALUES (1, "001_initial_schema")');
    }
  }
}
