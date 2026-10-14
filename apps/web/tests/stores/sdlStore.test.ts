import { describe, it, expect, beforeEach } from 'vitest';
import { useSdlStore } from '@/stores/sdlStore';
import { SDLParser } from '@/parsers/sdl/SDLParser';

describe('sdlStore View Preservation and Error Handling', () => {
  beforeEach(() => {
    // Reset store to initial state
    const initialText = `Table users {\n  id integer [pk]\n}\n\nTable posts {\n  id integer [pk]\n}\n`;
    const res = SDLParser.parse(initialText);
    useSdlStore.setState({
      sdlText: initialText,
      ast: res.ast,
      lastValidAst: res.ast,
      errors: [],
      error: null,
      isStale: false,
    });
  });

  it('keeps valid diagram view active when user starts typing an incomplete new table', () => {
    const store = useSdlStore.getState();
    expect(store.ast?.statements).toHaveLength(2);

    // User types incomplete line: 'Table comments {\n  id integer'
    const draftText = store.sdlText + `\nTable comments {\n  id integer\n`;
    useSdlStore.getState().setSdlText(draftText);

    // Parser runs on draft text
    const parseResult = SDLParser.parse(draftText);
    expect(parseResult.errors.length).toBeGreaterThan(0);

    // Store receives parse result
    useSdlStore.getState().setParseResult(parseResult);

    const updated = useSdlStore.getState();
    // 1. Diagram MUST NOT vanish! Users and posts are still present
    expect(updated.ast).not.toBeNull();
    const tableNames = updated.ast?.statements.map((s: any) => s.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('posts');

    // 2. Error is recorded with line number
    expect(updated.errors.length).toBeGreaterThan(0);
    expect(updated.errors[0]?.line).toBeGreaterThanOrEqual(8);
    expect(updated.isStale).toBe(true);
  });

  it('updates diagram and clears error when user completes the new table', () => {
    // 1. Incomplete state
    const draftText = `Table users {\n  id integer [pk]\n}\n\nTable comments {\n  id integer`;
    const incompleteResult = SDLParser.parse(draftText);
    useSdlStore.getState().setParseResult(incompleteResult);
    expect(useSdlStore.getState().isStale).toBe(true);

    // 2. Completed state
    const completedText = `Table users {\n  id integer [pk]\n}\n\nTable comments {\n  id integer\n}`;
    const completedResult = SDLParser.parse(completedText);
    useSdlStore.getState().setParseResult(completedResult);

    const finalState = useSdlStore.getState();
    expect(finalState.isStale).toBe(false);
    expect(finalState.errors).toHaveLength(0);
    expect(finalState.error).toBeNull();

    const tableNames = finalState.ast?.statements.map((s: any) => s.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('comments');
  });

  it('preserves an existing table definition when user makes a temporary typo inside it', () => {
    const store = useSdlStore.getState();
    expect(store.ast?.statements).toHaveLength(2);

    // User introduces a syntax error inside Table posts:
    const typoText = `Table users {\n  id integer [pk]\n}\n\nTable posts {\n  id %%%% invalid\n}`;
    useSdlStore.getState().setSdlText(typoText);

    const parseResult = SDLParser.parse(typoText);
    useSdlStore.getState().setParseResult(parseResult);

    const updated = useSdlStore.getState();
    // posts table was preserved from lastValidAst because Table posts still exists in draft text
    expect(updated.ast).not.toBeNull();
    const tableNames = updated.ast?.statements.map((s: any) => s.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('posts');
    expect(updated.isStale).toBe(true);
    expect(updated.errors[0]?.line).toBe(6);
  });
});
