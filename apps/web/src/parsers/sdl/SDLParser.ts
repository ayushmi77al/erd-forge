// @ts-ignore
import { parse } from './grammar.js';
import { SDLProgram, SDLStatement } from '../../types/sdl';
import { SDLError } from '../../stores/editorStore';

export interface ParseResult {
  ast: SDLProgram | null;
  errors: SDLError[];
  isResilient: boolean;
}

export interface StatementChunk {
  text: string;
  startLine: number;
  startColumn: number;
}

/**
 * Splits SDL text into candidate top-level statements/blocks.
 * Handles multiline comments, strings, and detects top-level keywords
 * (Table, View, Domain, Group, Ref) as statement boundaries.
 */
export function splitStatements(text: string): StatementChunk[] {
  const statements: StatementChunk[] = [];
  const lines = text.split('\n');
  let current: string[] = [];
  let startLine = 1;
  let inBlock = false;
  let braceDepth = 0;
  let inString = false;
  let stringChar = '';
  let inBlockComment = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx] ?? '';
    const lineNum = lineIdx + 1;
    const trimmed = line.trim();
    // Keywords that can only be top-level constructs in SDL
    const isKeywordStart = /^(Table\b|View\b|Domain\b|Group\b|Ref\b|Ref:)/i.test(trimmed);

    // If we encounter a top-level keyword and we have buffered content:
    // In SDL there are no nested tables/views/domains, so a top-level keyword
    // marks the end of the previous construct (even if it was left unclosed).
    if (isKeywordStart && current.length > 0 && (!inBlockComment || braceDepth > 0)) {
      const stmtText = current.join('\n');
      if (stmtText.trim()) {
        statements.push({ text: stmtText, startLine, startColumn: 1 });
      }
      current = [];
      startLine = lineNum;
      braceDepth = 0;
      inBlock = false;
    }

    if (current.length === 0 && trimmed) {
      startLine = lineNum;
    }

    current.push(line);

    for (let i = 0; i < line.length; i++) {
      const c = line[i] ?? '';
      const next = line[i + 1] ?? '';

      if (inBlockComment) {
        if (c === '*' && next === '/') {
          inBlockComment = false;
          i++;
        }
        continue;
      }

      if (inString) {
        if (c === '\\') {
          i++;
        } else if (c === stringChar) {
          inString = false;
        }
        continue;
      }

      if (c === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
      if (c === '/' && next === '/') {
        break;
      }

      if (c === '"' || c === "'" || c === '`') {
        inString = true;
        stringChar = c;
        continue;
      }

      if (c === '{') {
        braceDepth++;
        inBlock = true;
      } else if (c === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
        if (braceDepth === 0 && inBlock) {
          inBlock = false;
          const stmtText = current.join('\n');
          statements.push({ text: stmtText, startLine, startColumn: 1 });
          current = [];
          startLine = lineNum + 1;
        }
      }
    }
  }

  if (current.length > 0) {
    const stmtText = current.join('\n');
    if (stmtText.trim()) {
      statements.push({ text: stmtText, startLine, startColumn: 1 });
    }
  }

  return statements;
}

export class SDLParser {
  static parse(text: string): ParseResult {
    // 1. Attempt standard full parse first
    try {
      const ast = parse(text) as SDLProgram;
      return { ast, errors: [], isResilient: false };
    } catch (fullError: any) {
      const primaryError: SDLError = {
        line: fullError.location?.start?.line ?? 1,
        column: fullError.location?.start?.column ?? 1,
        endLine: fullError.location?.end?.line ?? fullError.location?.start?.line ?? 1,
        endColumn: fullError.location?.end?.column ?? (fullError.location?.start?.column ?? 1) + 1,
        offset: fullError.location?.start?.offset,
        message: fullError.message || 'Syntax error',
      };

      // 2. Fallback: Resilient statement-level parsing
      const stmts = splitStatements(text);
      const validStatements: SDLStatement[] = [];
      const errors: SDLError[] = [];

      for (const stmt of stmts) {
        try {
          const stmtAst = parse(stmt.text) as SDLProgram;
          if (stmtAst?.statements && stmtAst.statements.length > 0) {
            validStatements.push(...stmtAst.statements);
          }
        } catch (stmtError: any) {
          const lineOffset = stmt.startLine - 1;
          const errLine = (stmtError.location?.start?.line ?? 1) + lineOffset;
          const errCol = stmtError.location?.start?.column ?? 1;
          errors.push({
            line: errLine,
            column: errCol,
            endLine: (stmtError.location?.end?.line ?? stmtError.location?.start?.line ?? 1) + lineOffset,
            endColumn: stmtError.location?.end?.column ?? errCol + 1,
            offset: stmtError.location?.start?.offset,
            message: stmtError.message || 'Syntax error',
          });
        }
      }

      // If we isolated errors for specific statements, use them; otherwise use primaryError
      const finalErrors = errors.length > 0 ? errors : [primaryError];

      const ast: SDLProgram | null = validStatements.length > 0 ? {
        type: 'Program',
        statements: validStatements,
      } : null;

      return {
        ast,
        errors: finalErrors,
        isResilient: true,
      };
    }
  }
}

