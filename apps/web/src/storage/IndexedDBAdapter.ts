import { openDB, IDBPDatabase } from 'idb';
import { StorageAdapter } from './StorageAdapter';

export class IndexedDBAdapter implements StorageAdapter {
  private db: IDBPDatabase | null = null;

  async initialize(): Promise<void> {
    this.db = await openDB('erd-forge-catalog', 1, {
      upgrade(db) {
        // Fallback schema definition
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('entities')) {
          db.createObjectStore('entities', { keyPath: 'id' });
        }
        // ... more stores needed for fallback ...
      },
    });
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    console.warn("SQL queries are not supported in IndexedDB fallback.");
    return [];
  }

  async execute(sql: string, params?: any[]): Promise<void> {
    console.warn("SQL execution is not supported in IndexedDB fallback.");
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
