/**
 * SQL DDL to ERD Forge SDL Parser & Converter
 * 
 * Supports:
 * - CREATE TABLE [IF NOT EXISTS] [schema.]table_name ( ... )
 * - Column types, lengths, constraints: PRIMARY KEY, NOT NULL, UNIQUE, DEFAULT
 * - Inline references: col INT REFERENCES target_table(target_col)
 * - Table constraints: CONSTRAINT name FOREIGN KEY (col) REFERENCES target_table(target_col)
 * - Standalone ALTER TABLE table ADD CONSTRAINT ... FOREIGN KEY ...
 * - Strips comments (-- and /* * /) and handles quotes/backticks.
 */

export interface ParsedSqlTable {
  name: string;
  columns: {
    name: string;
    type: string;
    isPk: boolean;
    isNotNull: boolean;
    isUnique: boolean;
    defaultValue?: string;
  }[];
}

export interface ParsedSqlRef {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}

export interface SqlParseResult {
  tables: ParsedSqlTable[];
  refs: ParsedSqlRef[];
  sdl: string;
  error?: string;
}

// Strip SQL comments and empty lines
export function cleanSql(sql: string): string {
  return sql
    // Remove multi-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove single-line comments (-- or #)
    .replace(/(--|#)[^\r\n]*/g, '')
    .trim();
}

// Clean SQL identifier (removes ` " [ ] and schema prefix)
export function cleanIdentifier(raw?: string): string {
  if (!raw) return '';
  let cleaned = raw.trim().replace(/^[`"\[]|[`"\]]$/g, '');
  // Remove schema prefix if present: e.g. "public.users" -> "users"
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    cleaned = (parts[parts.length - 1] || '').replace(/^[`"\[]|[`"\]]$/g, '');
  }
  return cleaned;
}

export function parseSqlToSdl(rawSql: string): SqlParseResult {
  try {
    const sql = cleanSql(rawSql);
    const tables: ParsedSqlTable[] = [];
    const refs: ParsedSqlRef[] = [];

    // 1. Extract ALTER TABLE ... ADD [CONSTRAINT ...] FOREIGN KEY
    const alterTableRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?([^\s;]+)\s+ADD\s+(?:CONSTRAINT\s+[^\s;]+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([^\s(;]+)\s*\(([^)]+)\)/gi;
    let alterMatch: RegExpExecArray | null;
    while ((alterMatch = alterTableRegex.exec(sql)) !== null) {
      const sourceTable = cleanIdentifier(alterMatch[1]);
      const sourceCol = cleanIdentifier(alterMatch[2]);
      const targetTable = cleanIdentifier(alterMatch[3]);
      const targetCol = cleanIdentifier(alterMatch[4]);

      if (sourceTable && sourceCol && targetTable && targetCol) {
        refs.push({
          sourceTable,
          sourceColumn: sourceCol,
          targetTable,
          targetColumn: targetCol,
        });
      }
    }

    // 2. Extract CREATE TABLE statements
    // Matches: CREATE [TEMPORARY] TABLE [IF NOT EXISTS] table_name ( body )
    const createTableRegex = /CREATE\s+(?:(?:GLOBAL\s+TEMPORARY|LOCAL\s+TEMPORARY|TEMPORARY|TEMP|UNLOGGED)\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(;]+)\s*\(([\s\S]*?)\)(?:\s*;|\s*ENGINE|\s*DEFAULT|\s*CHARSET|\s*TABLESPACE|\s*$)/gi;
    
    let tableMatch: RegExpExecArray | null;
    while ((tableMatch = createTableRegex.exec(sql)) !== null) {
      const tableName = cleanIdentifier(tableMatch[1]);
      const body = tableMatch[2] || '';

      if (!tableName) continue;

      const currentTable: ParsedSqlTable = {
        name: tableName,
        columns: [],
      };

      // Split body by top-level commas (avoid splitting inside parentheses, e.g. DECIMAL(10, 2))
      const definitions = splitDefinitions(body);

      const tablePkCols = new Set<string>();

      // First pass: look for table-level PRIMARY KEY and FOREIGN KEY constraints
      for (const def of definitions) {
        const trimmed = def.trim();

        // PRIMARY KEY (col1, col2)
        const pkMatch = /^(?:CONSTRAINT\s+[^\s]+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(trimmed);
        if (pkMatch && pkMatch[1]) {
          const cols = pkMatch[1].split(',').map(c => cleanIdentifier(c)).filter(Boolean);
          cols.forEach(c => tablePkCols.add(c));
          continue;
        }

        // FOREIGN KEY (source_col) REFERENCES target_table(target_col)
        const fkMatch = /^(?:CONSTRAINT\s+[^\s]+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([^\s(;]+)\s*\(([^)]+)\)/i.exec(trimmed);
        if (fkMatch && fkMatch[1] && fkMatch[2] && fkMatch[3]) {
          const sourceCol = cleanIdentifier(fkMatch[1]);
          const targetTable = cleanIdentifier(fkMatch[2]);
          const targetCol = cleanIdentifier(fkMatch[3]);
          refs.push({
            sourceTable: tableName,
            sourceColumn: sourceCol,
            targetTable,
            targetColumn: targetCol,
          });
          continue;
        }
      }

      // Second pass: column definitions
      for (const def of definitions) {
        const trimmed = def.trim();
        if (!trimmed) continue;

        // Skip table constraints that were already handled
        if (/^(?:CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE\s*\([^)]+\)|KEY\s+|INDEX\s+|CHECK\s*\()/i.test(trimmed)) {
          continue;
        }

        // Format: column_name data_type [constraints...]
        const colMatch = /^([^\s]+)\s+([^\s(]+(?:\([^)]+\))?)([\s\S]*)$/.exec(trimmed);
        if (colMatch && colMatch[1] && colMatch[2]) {
          const colName = cleanIdentifier(colMatch[1]);
          const colType = colMatch[2].toLowerCase();
          const rest = colMatch[3] || '';

          const isInlinePk = /PRIMARY\s+KEY/i.test(rest);
          const isNotNull = /NOT\s+NULL/i.test(rest);
          const isUnique = /UNIQUE/i.test(rest);

          // Check inline REFERENCES target_table(target_col)
          const inlineRefMatch = /REFERENCES\s+([^\s(;]+)\s*\(([^)]+)\)/i.exec(rest);
          if (inlineRefMatch && inlineRefMatch[1] && inlineRefMatch[2]) {
            refs.push({
              sourceTable: tableName,
              sourceColumn: colName,
              targetTable: cleanIdentifier(inlineRefMatch[1]),
              targetColumn: cleanIdentifier(inlineRefMatch[2]),
            });
          }

          currentTable.columns.push({
            name: colName,
            type: colType,
            isPk: isInlinePk || tablePkCols.has(colName),
            isNotNull,
            isUnique,
          });
        }
      }

      if (currentTable.columns.length > 0) {
        tables.push(currentTable);
      }
    }

    // 3. Generate SDL text
    const sdlParts: string[] = [];

    // Tables
    tables.forEach(table => {
      const colLines = table.columns.map(col => {
        const options: string[] = [];
        if (col.isPk) options.push('pk');
        if (col.isUnique && !col.isPk) options.push('unique');
        if (col.isNotNull && !col.isPk) options.push('not null');

        const optStr = options.length > 0 ? ` [${options.join(', ')}]` : '';
        return `  ${col.name.padEnd(16)} ${col.type}${optStr}`;
      });

      sdlParts.push(`Table ${table.name} {\n${colLines.join('\n')}\n}`);
    });

    // Refs
    if (refs.length > 0) {
      sdlParts.push('');
      refs.forEach(ref => {
        sdlParts.push(`Ref: ${ref.sourceTable}.${ref.sourceColumn} > ${ref.targetTable}.${ref.targetColumn}`);
      });
    }

    const sdl = sdlParts.join('\n\n');

    return {
      tables,
      refs,
      sdl,
    };
  } catch (err: any) {
    return {
      tables: [],
      refs: [],
      sdl: '',
      error: err?.message || 'Failed to parse SQL DDL',
    };
  }
}

/**
 * Splits SQL column and constraint definitions by comma,
 * ignoring commas inside parentheses like `DECIMAL(10, 2)` or `ENUM('a', 'b')`.
 */
function splitDefinitions(body: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;

    if (char === ',' && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    result.push(current);
  }

  return result;
}

export function detectSqlStats(rawSql: string): { tableCount: number; refCount: number } {
  const res = parseSqlToSdl(rawSql);
  return {
    tableCount: res.tables.length,
    refCount: res.refs.length,
  };
}
