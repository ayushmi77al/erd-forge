import type React from "react";
import { useUIStore } from "../../stores/uiStore";
import styles from "./AppShell.module.css";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const appMode = useUIStore((s) => s.appMode);

  const isSidebarVisible = appMode === "schema" && leftPanelOpen;

  return (
    <div className={`${styles.appShell} ${isSidebarVisible ? "" : styles.sidebarCollapsed}`}>
      <div className={styles.header}>
        <Header />
      </div>
      {appMode === "schema" && (
        <div className={styles.sidebar}>
          <Sidebar />
        </div>
      )}
      <main className={`${styles.mainContent} ${appMode === "lineage" ? styles.lineageMode : ""}`}>{children}</main>
      <div className={styles.statusBarArea}>
        <StatusBar />
      </div>
    </div>
  );
};
