import type { StorageAdapter } from "../StorageAdapter";
import initialSchema from "./001_initial_schema.sql?raw";

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inTrigger = false;

  for (const rawLine of sql.split("\n")) {
    const trimmed = rawLine.trim();
    if (!current && (trimmed.startsWith("--") || trimmed.length === 0)) {
      continue;
    }

    current += rawLine + "\n";

    if (/CREATE\s+TRIGGER/i.test(current)) {
      inTrigger = true;
    }

    const lineWithoutComments = trimmed.replace(/--.*$/, "").trim();

    if (inTrigger) {
      if (/\bEND\s*;/i.test(lineWithoutComments)) {
        statements.push(current.trim());
        current = "";
        inTrigger = false;
      }
    } else if (lineWithoutComments.endsWith(";")) {
      statements.push(current.trim());
      current = "";
    }
  }

  if (current.trim().length > 0) {
    statements.push(current.trim());
  }

  return statements;
}

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
    const results = await adapter.query<{ version: number }>("SELECT MAX(version) as version FROM _migrations");
    const currentVersion = results[0]?.version || 0;

    // Run migrations
    if (currentVersion < 1) {
      console.log("Running migration: 001_initial_schema.sql");
      const statements = splitSqlStatements(initialSchema);
      for (const stmt of statements) {
        await adapter.execute(stmt);
      }
      await adapter.execute("INSERT INTO _migrations (version, name) VALUES (1, '001_initial_schema')");
    }
  }
}
