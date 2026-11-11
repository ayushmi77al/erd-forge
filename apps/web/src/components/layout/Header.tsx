import { Database, ExternalLink, GitMerge, Moon, Network, Sun } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { resolveTheme, useUIStore } from "../../stores/uiStore";
import styles from "./Header.module.css";

export const Header: React.FC = () => {
  const projectName = useProjectStore((state) => state.project?.name || "Untitled Project");
  const setProjectName = useProjectStore((state) => state.setProjectName);
  const appMode = useUIStore((state) => state.appMode);
  const setAppMode = useUIStore((state) => state.setAppMode);
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);
  const [draftName, setDraftName] = useState(projectName);

  const resolvedTheme = resolveTheme(theme);

  useEffect(() => {
    setDraftName(projectName);
  }, [projectName]);

  const handleBlur = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== projectName) {
      setProjectName(trimmed);
    } else {
      setDraftName(projectName);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setDraftName(projectName);
      e.currentTarget.blur();
    }
  };

  const handleToggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <Database className={styles.logoIcon} size={20} aria-hidden="true" />
          <span>ERD Forge</span>
        </div>
        <span className={styles.brandDivider} aria-hidden="true" />
        <input
          className={styles.projectNameInput}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          title="Click to rename project (Press Enter to save, Esc to cancel)"
          aria-label="Project name"
        />
      </div>

      <div className={styles.modeSwitcher} role="tablist" aria-label="Application Mode">
        <button
          className={`${styles.modeTab} ${appMode === "schema" ? styles.active : ""}`}
          onClick={() => setAppMode("schema")}
          title="Entity Relationship Diagram Designer"
          type="button"
          role="tab"
          aria-selected={appMode === "schema"}
        >
          <Network size={15} aria-hidden="true" />
          <span>ERD</span>
        </button>
        <button
          className={`${styles.modeTab} ${appMode === "lineage" ? styles.active : ""}`}
          onClick={() => setAppMode("lineage")}
          title="SQL Query Lineage Analyzer"
          type="button"
          role="tab"
          aria-selected={appMode === "lineage"}
        >
          <GitMerge size={15} aria-hidden="true" />
          <span>SQL Lineage</span>
        </button>
      </div>

      <div className={styles.rightGroup}>
        <button
          type="button"
          className={styles.themeBtn}
          onClick={handleToggleTheme}
          title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {resolvedTheme === "dark" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
        </button>

        <a
          href="https://forbiddenai.in"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.attributionBadge}
          aria-label="Built by Forbidden AI — visit forbiddenai.in"
        >
          Built by <strong>Forbidden AI</strong> <ExternalLink size={11} aria-hidden="true" />
        </a>
      </div>
    </header>
  );
};
