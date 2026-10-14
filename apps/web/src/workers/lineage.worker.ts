import { expose } from 'comlink';
import { parseSQLLineage, ParseLineageOptions, ParseLineageResult } from '../lineage/parser/sqlLineageParser';
import { SQLDialect } from '../stores/lineageStore';

const api = {
  parseSQL(sql: string, dialect: SQLDialect, options?: ParseLineageOptions): ParseLineageResult {
    return parseSQLLineage(sql, dialect, options);
  },
};

export type LineageWorkerAPI = typeof api;

expose(api);
