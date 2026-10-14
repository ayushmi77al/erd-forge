// @ts-ignore
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs';
import * as SQLite from 'wa-sqlite';
// @ts-ignore
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js';
import { StorageAdapter } from './StorageAdapter';

export class OPFSSQLiteAdapter implements StorageAdapter {
  private db: number | null = null;
  private sqlite3: SQLiteAPI | null = null;

  async initialize(): Promise<void> {
    const module = await SQLiteESMFactory();
    this.sqlite3 = SQLite.Factory(module);
    const vfs = new IDBBatchAtomicVFS('erd-forge-catalog');
    this.sqlite3.vfs_register(vfs, true);
    this.db = await this.sqlite3.open_v2('catalog.db');
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.sqlite3 || this.db === null) throw new Error("DB not initialized");
    const results: T[] = [];
    for await (const stmt of this.sqlite3.statements(this.db, sql)) {
      this.sqlite3.bind_collection(stmt, params);
      const columns = this.sqlite3.column_names(stmt);
      while (await this.sqlite3.step(stmt) === SQLite.SQLITE_ROW) {
        const row = {} as Record<string, any>;
        columns.forEach((col, i) => {
          row[col] = this.sqlite3!.column(stmt, i);
        });
        results.push(row as T);
      }
    }
    return results;
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    if (!this.sqlite3 || this.db === null) throw new Error("DB not initialized");
    for await (const stmt of this.sqlite3.statements(this.db, sql)) {
      this.sqlite3.bind_collection(stmt, params);
      await this.sqlite3.step(stmt);
    }
  }

  async close(): Promise<void> {
    if (this.sqlite3 && this.db !== null) {
      await this.sqlite3.close(this.db);
      this.db = null;
    }
  }
}
