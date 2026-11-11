import { AlertTriangle, CheckCircle2, Eye, HardDrive, Lock, RefreshCw, Users, XCircle } from "lucide-react";
import type React from "react";
import { useLineageStore } from "../../stores/lineageStore";
import { useSdlStore } from "../../stores/sdlStore";
import { useUIStore } from "../../stores/uiStore";
import type { SDLTable } from "../../types/sdl";
import styles from "./StatusBar.module.css";

export const StatusBar: React.FC = () => {
  const appMode = useUIStore((s) => s.appMode);

  // ERD Mode state
  const ast = useSdlStore((s) => s.ast);
  const error = useSdlStore((s) => s.error);
  const errors = useSdlStore((s) => s.errors);
  const isStale = useSdlStore((s) => s.isStale);
  const primaryError = errors[0] ?? null;

  // Lineage Mode state
  const graph = useLineageStore((s) => s.graph);
  const dialect = useLineageStore((s) => s.dialect);
  const parseErrors = useLineageStore((s) => s.parseErrors);
  const isParsing = useLineageStore((s) => s.isParsing);

  const tables = (ast?.statements.filter((s) => s.type === "Table") as SDLTable[]) || [];
  const totalCols = tables.reduce((sum, t) => sum + t.columns.length, 0);

  const storageStatus = useUIStore((s) => s.storageStatus);
  const tabRole = useUIStore((s) => s.tabRole);

  const renderTabIndicator = () => {
    if (tabRole === "leader") {
      return (
        <span className={styles.item} title="This tab has exclusive storage write lock">
          <span className={`${styles.statusItemWithIcon} ${styles.statusSuccess}`}>
            <Lock size={12} aria-hidden="true" />
            <span>Primary</span>
          </span>
        </span>
      );
    }
    if (tabRole === "readonly") {
      return (
        <span className={styles.item} title="This tab is in read-only mode (secondary session)">
          <span className={`${styles.statusItemWithIcon} ${styles.statusSecondary}`}>
            <Eye size={12} aria-hidden="true" />
            <span>Read-Only</span>
          </span>
        </span>
      );
    }
    if (tabRole === "follower") {
      return (
        <span className={styles.item} title="Another tab holds the database write lock">
          <span className={`${styles.statusItemWithIcon} ${styles.statusWarning}`}>
            <Users size={12} aria-hidden="true" />
            <span>Follower</span>
          </span>
        </span>
      );
    }
    return null;
  };

  const renderStorageIndicator = () => {
    return (
      <span
        className={styles.item}
        title={
          storageStatus.isFallback
            ? `Running in durable fallback mode: ${storageStatus.error || "OPFS SAHPool unavailable"}`
            : storageStatus.engine === "opfs-sahpool"
              ? "OPFS SAHPool SQLite catalog active"
              : "Storage uninitialized"
        }
      >
        {storageStatus.isFallback ? (
          <span className={`${styles.statusItemWithIcon} ${styles.statusWarning}`}>
            <AlertTriangle size={12} aria-hidden="true" />
            <span>Storage: IndexedDB</span>
          </span>
        ) : storageStatus.engine === "opfs-sahpool" ? (
          <span className={`${styles.statusItemWithIcon} ${styles.statusSuccess}`}>
            <HardDrive size={12} aria-hidden="true" />
            <span>Storage: OPFS</span>
          </span>
        ) : storageStatus.error ? (
          <span className={`${styles.statusItemWithIcon} ${styles.statusError}`}>
            <XCircle size={12} aria-hidden="true" />
            <span>Storage: Error</span>
          </span>
        ) : (
          <span>Storage: Connecting...</span>
        )}
      </span>
    );
  };

  const lineageError = parseErrors[0] ?? null;

  const renderLeftStatus = () => {
    if (appMode === "lineage") {
      if (lineageError) {
        return (
          <span
            className={`${styles.statusItemWithIcon} ${styles.statusError}`}
            title={`Line ${lineageError.line || 1}: ${lineageError.message}`}
          >
            <XCircle size={12} aria-hidden="true" />
            <span className={styles.truncateText}>
              Line {lineageError.line || 1}: {lineageError.message}
            </span>
          </span>
        );
      }
      if (isParsing) {
        return (
          <span className={`${styles.statusItemWithIcon} ${styles.statusBrand}`}>
            <RefreshCw size={12} aria-hidden="true" />
            <span>Analyzing SQL pipeline...</span>
          </span>
        );
      }
      return (
        <span className={`${styles.statusItemWithIcon} ${styles.statusSuccess}`}>
          <CheckCircle2 size={12} aria-hidden="true" />
          <span>SQL Lineage ready</span>
        </span>
      );
    }

    if (error) {
      return (
        <span className={`${styles.statusRow} ${styles.statusError}`}>
          <span
            className={styles.statusItemWithIcon}
            title={`Line ${primaryError?.line || "?"}: ${primaryError?.message || error}`}
          >
            <XCircle size={12} aria-hidden="true" />
            <span className={styles.truncateText}>
              Line {primaryError?.line || "?"}: {primaryError?.message || error}
            </span>
          </span>
          {isStale && (
            <span className={styles.preservedPill} title="Previous valid diagram is kept active on canvas">
              Diagram preserved
            </span>
          )}
        </span>
      );
    }

    return (
      <span className={`${styles.statusItemWithIcon} ${styles.statusSuccess}`}>
        <CheckCircle2 size={12} aria-hidden="true" />
        <span>SDL valid</span>
      </span>
    );
  };

  return (
    <footer className={styles.statusBar}>
      <div className={styles.left} role="status" aria-live="polite">
        {renderLeftStatus()}
      </div>
      <div className={styles.right}>
        <span className={styles.group}>
          {renderTabIndicator()}
          {renderStorageIndicator()}
        </span>
        <span className={styles.divider} aria-hidden="true" />
        {appMode === "lineage" ? (
          <>
            <span className={styles.item}>Dialect: {dialect.toUpperCase()}</span>
            <span className={styles.divider} aria-hidden="true" />
            <span className={styles.group}>
              <span className={styles.item}>{graph?.nodes.length || 0} entities</span>
              <span className={styles.item}>{graph?.edges.length || 0} flow edges</span>
            </span>
          </>
        ) : (
          <>
            <span className={styles.group}>
              <span className={styles.item}>{tables.length} tables</span>
              <span className={styles.item}>{totalCols} columns</span>
            </span>
            <span className={styles.divider} aria-hidden="true" />
            <span className={styles.item}>{isStale ? "Preserving diagram" : "Saved"}</span>
          </>
        )}
      </div>
    </footer>
  );
};
