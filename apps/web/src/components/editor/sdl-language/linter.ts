import { linter, Diagnostic } from '@codemirror/lint';
import { SDLParser } from '../../../parsers/sdl/SDLParser';

export const sdlLinter = () =>
  linter(
    (view) => {
      const doc = view.state.doc;
      const text = doc.toString();
      if (!text.trim()) return [];

      const result = SDLParser.parse(text);
      const diagnostics: Diagnostic[] = [];

      for (const err of result.errors) {
        const lineNum = Math.min(Math.max(1, err.line), doc.lines);
        const lineObj = doc.line(lineNum);
        const col = Math.max(1, err.column || 1);

        let from = Math.min(lineObj.from + col - 1, lineObj.to);
        let to = from;

        if (err.endLine && err.endColumn) {
          const endLineNum = Math.min(Math.max(1, err.endLine), doc.lines);
          const endLineObj = doc.line(endLineNum);
          to = Math.min(endLineObj.from + Math.max(1, err.endColumn) - 1, endLineObj.to);
        }

        if (from === to) {
          if (from < lineObj.to) {
            to = from + 1;
          } else if (from > lineObj.from) {
            from = from - 1;
          } else {
            to = Math.min(lineObj.to + 1, doc.length);
          }
        }

        diagnostics.push({
          from,
          to: Math.max(from + 1, to),
          severity: 'error',
          message: `Line ${err.line}: ${err.message}`,
          source: 'SDL',
        });
      }

      return diagnostics;
    },
    { delay: 250 }
  );

