import { SDLProgram } from '../../types/sdl';
import { SDLError } from '../../stores/editorStore';

export class SDLValidator {
  static validate(ast: SDLProgram): SDLError[] {
    const errors: SDLError[] = [];
    const tableNames = new Set<string>();

    // Pass 1: Collect tables
    ast.statements.forEach(stmt => {
      if (stmt.type === 'Table') {
        if (tableNames.has(stmt.name)) {
          errors.push({
            line: stmt.location?.start.line || 1,
            column: stmt.location?.start.column || 1,
            message: `Duplicate table name: ${stmt.name}`
          });
        }
        tableNames.add(stmt.name);
      }
    });

    // Semantic rules (foreign key refs) can be verified here later

    return errors;
  }
}
