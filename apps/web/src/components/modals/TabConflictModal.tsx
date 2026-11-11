import { ArrowRight, Eye, ShieldAlert, X, Zap } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { tabLockCoordinator } from "../../storage/TabLockCoordinator";
import { useUIStore } from "../../stores/uiStore";
import styles from "./TabConflictModal.module.css";

export const TabConflictModal: React.FC = () => {
  const conflictLeaderId = useUIStore((state) => state.conflictLeaderId);
  const setTabConflict = useUIStore((state) => state.setTabConflict);
  const setTabRole = useUIStore((state) => state.setTabRole);
  const [isTakingOver, setIsTakingOver] = useState(false);

  const handleTakeover = async () => {
    setIsTakingOver(true);
    try {
      const granted = await tabLockCoordinator.requestTakeover();
      if (granted) {
        setTabRole("leader");
        setTabConflict(false);
      }
    } catch (err) {
      console.error("[TabConflictModal] Takeover request failed:", err);
    } finally {
      setIsTakingOver(false);
    }
  };

  const handleReadOnly = () => {
    tabLockCoordinator.setReadOnly();
    setTabRole("readonly");
    setTabConflict(false);
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="tab-conflict-title">
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIconWrapper}>
              <ShieldAlert size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="tab-conflict-title" className={styles.headerTitle}>
                Database In Use in Another Tab
              </h2>
              <p className={styles.headerSubtitle}>Zero Silent Data Loss Protection</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleReadOnly}
            aria-label="Dismiss to Read-Only Mode"
            title="Dismiss to Read-Only Mode"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <p className={styles.description}>
            ERD Forge is currently active in another browser tab. To safeguard database integrity and eliminate write
            collisions, local storage write access is restricted to one tab at a time.
          </p>

          <div className={styles.conflictBox}>
            <span className={styles.conflictLabel}>Active Primary Tab:</span>
            <span className={styles.conflictTabId}>{conflictLeaderId || "Active Session"}</span>
          </div>

          <div className={styles.optionCards}>
            <div className={styles.optionCard}>
              <div className={styles.optionTitle}>
                <Zap size={14} className={styles.optionIcon} aria-hidden="true" />
                <span>Take Over Session</span>
              </div>
              <div className={styles.optionText}>
                Transfers exclusive write leadership to this tab. The other tab will seamlessly step down to follower
                mode.
              </div>
            </div>
            <div className={styles.optionCard}>
              <div className={styles.optionTitle}>
                <Eye size={14} className={styles.optionIcon} aria-hidden="true" />
                <span>Read-Only Mode</span>
              </div>
              <div className={styles.optionText}>
                Explore, visualize, and inspect schemas without writing modifications to the local database.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button type="button" className={styles.readOnlyButton} onClick={handleReadOnly}>
            <span className={styles.btnInner}>
              <Eye size={15} aria-hidden="true" />
              <span>Read-Only Mode</span>
            </span>
          </button>
          <button type="button" className={styles.takeoverButton} onClick={handleTakeover} disabled={isTakingOver}>
            <span>{isTakingOver ? "Requesting Takeover..." : "Take Over Session"}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
