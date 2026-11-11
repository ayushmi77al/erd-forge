import { AlertTriangle } from "lucide-react";
import type React from "react";
import styles from "./TabRevokedBanner.module.css";

interface TabRevokedBannerProps {
  onReclaim: () => void;
}

export const TabRevokedBanner: React.FC<TabRevokedBannerProps> = ({ onReclaim }) => {
  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.message}>
        <AlertTriangle size={15} className={styles.icon} aria-hidden="true" />
        <span>
          <strong>Session Inactive:</strong> Another browser tab took over database edit rights. This tab is operating
          in read-only follower mode.
        </span>
      </span>
      <button type="button" className={styles.reclaimButton} onClick={onReclaim}>
        Reclaim Session
      </button>
    </div>
  );
};
