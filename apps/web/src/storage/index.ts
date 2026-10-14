import { StorageAdapter } from './StorageAdapter';
import { OPFSSQLiteAdapter } from './OPFSSQLiteAdapter';
import { IndexedDBAdapter } from './IndexedDBAdapter';
import { FileSystemAdapter } from './FileSystemAdapter';
import { MigrationRunner } from './migrations/MigrationRunner';

export class StorageService {
  public adapter!: StorageAdapter;
  public fsAdapter: FileSystemAdapter;

  constructor() {
    this.fsAdapter = new FileSystemAdapter();
  }

  async initialize(): Promise<void> {
    // Feature detect OPFS
    const opfsSupported = 'storage' in navigator && 'getDirectory' in navigator.storage;

    if (opfsSupported) {
      console.log('Using OPFSSQLiteAdapter');
      this.adapter = new OPFSSQLiteAdapter();
    } else {
      console.warn('OPFS not supported. Falling back to IndexedDBAdapter.');
      this.adapter = new IndexedDBAdapter();
    }

    await this.adapter.initialize();
    
    if (this.adapter instanceof OPFSSQLiteAdapter) {
      await MigrationRunner.run(this.adapter);
    }
  }

  // Wrappers around adapter methods for easier access
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return this.adapter.query<T>(sql, params);
  }

  async execute(sql: string, params?: any[]): Promise<void> {
    return this.adapter.execute(sql, params);
  }
}

export const storageService = new StorageService();
