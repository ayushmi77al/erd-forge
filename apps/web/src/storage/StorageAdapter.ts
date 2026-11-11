export type StorageEngineType = "opfs-sahpool" | "indexeddb" | "memory-fallback" | "none";

export interface StorageAdapter {
  initialize(options?: { allowMemoryFallback?: boolean; clearOnInit?: boolean }): Promise<void>;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<void>;
  executeBatch?(statements: Array<{ sql: string; params?: any[] }>): Promise<void>;
  close(): Promise<void>;
  isDurable(): boolean;
  getEngineType(): StorageEngineType;
}
