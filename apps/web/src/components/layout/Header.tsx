import React, { useState, useEffect } from 'react';
import { Database, Network, GitMerge } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import styles from './Header.module.css';

export const Header: React.FC = () => {
  const projectName = useProjectStore((state) => state.project?.name || 'Untitled Project');
  const setProjectName = useProjectStore((state) => state.setProjectName);
  const appMode = useUIStore((state) => state.appMode);
  const setAppMode = useUIStore((state) => state.setAppMode);
  const [draftName, setDraftName] = useState(projectName);

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
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setDraftName(projectName);
      e.currentTarget.blur();
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <Database className={styles.logoIcon} size={20} />
          <span>ERD Forge</span>
        </div>
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
          className={`${styles.modeTab} ${appMode === 'schema' ? styles.active : ''}`}
          onClick={() => setAppMode('schema')}
          title="Entity Relationship Diagram Designer"
          type="button"
          role="tab"
          aria-selected={appMode === 'schema'}
        >
          <Network size={15} />
          <span>ERD</span>
        </button>
        <button
          className={`${styles.modeTab} ${appMode === 'lineage' ? styles.active : ''}`}
          onClick={() => setAppMode('lineage')}
          title="SQL Query Lineage Analyzer"
          type="button"
          role="tab"
          aria-selected={appMode === 'lineage'}
        >
          <GitMerge size={15} />
          <span>SQL Lineage</span>
        </button>
      </div>
    </header>
  );
};
