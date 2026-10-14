import { useEffect, useRef } from 'react';
import { wrap, Remote } from 'comlink';
import { useUIStore } from './stores/uiStore';
import { useSdlStore } from './stores/sdlStore';
import { AppShell } from './components/layout/AppShell';
import { ERDCanvas } from './components/canvas/ERDCanvas';
import { SDLEditor } from './components/editor/SDLEditor';
import { ImportModal } from './components/modals/ImportModal';
import type { ParserWorkerAPI } from './workers/parser.worker';
import './styles/global.css';

import { ResizablePanel } from './components/layout/ResizablePanel';
import { MainToolbar } from './components/toolbar/MainToolbar';

import { LineageTab } from './components/lineage/LineageTab';

export default function App() {
  const theme = useUIStore((state) => state.theme);
  const activeModal = useUIStore((state) => state.activeModal);
  const appMode = useUIStore((state) => state.appMode);
  const { sdlText, setSdlText, setParseResult } = useSdlStore();
  const workerRef = useRef<Remote<ParserWorkerAPI> | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Save shortcut (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        useSdlStore.getState().saveToFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Setup worker
  useEffect(() => {
    const worker = new Worker(new URL('./workers/parser.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = wrap<ParserWorkerAPI>(worker);
    return () => worker.terminate();
  }, []);

  // Parse SDL on change
  useEffect(() => {
    if (!workerRef.current) return;
    const timeout = setTimeout(async () => {
      try {
        const result = await workerRef.current!.parseSDL(sdlText);
        setParseResult({
          ast: result.ast,
          errors: result.errors || [],
        });
      } catch (err: any) {
        setParseResult({
          ast: null,
          errors: [{ line: 1, column: 1, message: err.message || 'Parse error' }],
        });
      }
    }, 300); // 300ms debounce
    return () => clearTimeout(timeout);
  }, [sdlText, setParseResult]);

  const viewMode = useUIStore((s) => s.viewMode);

  const showCanvas = viewMode === 'canvas' || viewMode === 'split';
  const showEditor = viewMode === 'sdl' || viewMode === 'split';

  return (
    <AppShell>
      {appMode === 'lineage' ? (
        <LineageTab />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'row', height: '100%', width: '100%', overflow: 'hidden' }}>
          {showCanvas ? (
            <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflow: 'hidden' }}>
              <MainToolbar />
              <div style={{ flex: '1 1 auto', position: 'relative', minWidth: 0, height: '100%', overflow: 'hidden' }}>
                <ERDCanvas />
              </div>
            </div>
          ) : showEditor ? (
            <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflow: 'hidden' }}>
              <MainToolbar />
              <div style={{ flex: '1 1 auto', position: 'relative', minWidth: 0, height: '100%', overflow: 'hidden' }}>
                <SDLEditor value={sdlText} onChange={setSdlText} />
              </div>
            </div>
          ) : null}

          {showCanvas && showEditor && (
            <ResizablePanel key="split-editor" position="right" defaultWidth={400} minWidth={300} maxWidth={800}>
              <SDLEditor value={sdlText} onChange={setSdlText} />
            </ResizablePanel>
          )}
        </div>
      )}

      {activeModal === 'import' && <ImportModal />}
    </AppShell>
  );
}

