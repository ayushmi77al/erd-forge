import { SDLProgram, SDLStatement, SDLTable, SDLColumn } from '../../types/sdl';

export class SDLSerializer {
  static serialize(ast: SDLProgram): string {
    return ast.statements.map(stmt => this.serializeStatement(stmt)).join('\n\n');
  }

  private static serializeStatement(stmt: SDLStatement): string {
    switch (stmt.type) {
      case 'Table':
        return this.serializeTable(stmt);
      // Other statements (View, Domain, Group, Ref) go here
      default:
        return '';
    }
  }

  private static serializeTable(table: SDLTable): string {
    let result = `Table ${table.name} {\n`;
    table.columns.forEach(col => {
      result += `  ${this.serializeColumn(col)}\n`;
    });
    if (table.indexes) {
      // serialize indexes
    }
    if (table.note) {
      result += `  Note: "${table.note}"\n`;
    }
    result += `}`;
    return result;
  }

  private static serializeColumn(col: SDLColumn): string {
    let result = `${col.name} ${col.dataType}`;
    if (col.options && col.options.length > 0) {
      result += ` [${col.options.map(o => o.value === true ? o.key : `${o.key}: ${o.value}`).join(', ')}]`;
    }
    if (col.note) {
      result += ` // ${col.note}`;
    }
    return result;
  }
}
