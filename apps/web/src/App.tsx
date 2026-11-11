import { type Remote, wrap } from "comlink";
import { useCallback, useEffect, useRef } from "react";
import styles from "./App.module.css";
import { ERDCanvas } from "./components/canvas/ERDCanvas";
import { SDLEditor } from "./components/editor/SDLEditor";
import { AppShell } from "./components/layout/AppShell";
import { ResizablePanel } from "./components/layout/ResizablePanel";
import { TabRevokedBanner } from "./components/layout/TabRevokedBanner";
import { LineageTab } from "./components/lineage/LineageTab";
import { ImportModal } from "./components/modals/ImportModal";
import { TabConflictModal } from "./components/modals/TabConflictModal";
import { MainToolbar } from "./components/toolbar/MainToolbar";
import { storageService } from "./storage";
import { tabLockCoordinator } from "./storage/TabLockCoordinator";
import { useSdlStore } from "./stores/sdlStore";
import { resolveTheme, useUIStore } from "./stores/uiStore";
import "./styles/global.css";
import type { ParserWorkerAPI } from "./workers/parser.worker";

export default function App() {
  const theme = useUIStore((state) => state.theme);
  const activeModal = useUIStore((state) => state.activeModal);
  const appMode = useUIStore((state) => state.appMode);
  const showTabRevokedBanner = useUIStore((state) => state.showTabRevokedBanner);
  const setStorageStatus = useUIStore((state) => state.setStorageStatus);
  const { sdlText, setSdlText, setParseResult } = useSdlStore();
  const workerRef = useRef<Remote<ParserWorkerAPI> | null>(null);

  useEffect(() => {
    const applyTheme = () => {
      document.documentElement.setAttribute("data-theme", resolveTheme(theme));
    };
    applyTheme();

    if (theme === "system" && typeof window !== "undefined" && window.matchMedia) {
      const mql = window.matchMedia("(prefers-color-scheme: light)");
      mql.addEventListener("change", applyTheme);
      return () => mql.removeEventListener("change", applyTheme);
    }
    return undefined;
  }, [theme]);

  // Tab lock coordinator setup
  useEffect(() => {
    tabLockCoordinator.setOnConflict((leaderId) => {
      useUIStore.getState().setTabRole("follower");
      useUIStore.getState().setTabConflict(true, leaderId);
    });

    tabLockCoordinator.setOnLeaseRevoked(() => {
      useUIStore.getState().setTabRole("follower");
      useUIStore.getState().setShowTabRevokedBanner(true);
    });

    tabLockCoordinator.setOnLeaseGranted(() => {
      useUIStore.getState().setTabRole("leader");
      useUIStore.getState().setShowTabRevokedBanner(false);
    });

    tabLockCoordinator.acquireLease().then((isLeader) => {
      useUIStore.getState().setTabRole(isLeader ? "leader" : "follower");
    });

    const handleBeforeUnload = () => {
      tabLockCoordinator.releaseLease();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      tabLockCoordinator.dispose();
    };
  }, []);

  // Initialize storage engine on startup
  useEffect(() => {
    storageService
      .initialize()
      .then(() => {
        const diag = storageService.getDiagnostics();
        setStorageStatus({
          engine: diag.activeEngine,
          isFallback: diag.fallbackActive,
          error: diag.fallbackReason,
        });
      })
      .catch((err) => {
        setStorageStatus({
          engine: "none",
          isFallback: false,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, [setStorageStatus]);

  // Save shortcut (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        useSdlStore.getState().saveToFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Setup worker
  useEffect(() => {
    const worker = new Worker(new URL("./workers/parser.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = wrap<ParserWorkerAPI>(worker);
    return () => worker.terminate();
  }, []);

  // Parse SDL on change
  useEffect(() => {
    if (!workerRef.current) return;
    const timeout = setTimeout(async () => {
      try {
        const result = await workerRef.current?.parseSDL(sdlText);
        if (!result) return;
        setParseResult({
          ast: result.ast,
          errors: result.errors || [],
        });
      } catch (err: any) {
        setParseResult({
          ast: null,
          errors: [{ line: 1, column: 1, message: err.message || "Parse error" }],
        });
      }
    }, 300); // 300ms debounce
    return () => clearTimeout(timeout);
  }, [sdlText, setParseResult]);

  const handleReclaimSession = useCallback(() => {
    tabLockCoordinator.requestTakeover();
  }, []);

  const viewMode = useUIStore((s) => s.viewMode);

  const showCanvas = viewMode === "canvas" || viewMode === "split";
  const showEditor = viewMode === "sdl" || viewMode === "split";

  return (
    <AppShell>
      {showTabRevokedBanner && <TabRevokedBanner onReclaim={handleReclaimSession} />}

      {appMode === "lineage" ? (
        <LineageTab />
      ) : (
        <div className={styles.workspace}>
          {showCanvas ? (
            <div className={styles.primaryPane}>
              <MainToolbar />
              <div className={styles.paneContent}>
                <ERDCanvas />
              </div>
            </div>
          ) : showEditor ? (
            <div className={styles.primaryPane}>
              <MainToolbar />
              <div className={styles.paneContent}>
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

      {activeModal === "import" && <ImportModal />}
      {activeModal === "tab-conflict" && <TabConflictModal />}
    </AppShell>
  );
}
