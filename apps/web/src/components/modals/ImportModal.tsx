import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Database, 
  FileCode, 
  Sparkles, 
  Trash2, 
  Layers,
  ArrowRight
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useSdlStore } from '../../stores/sdlStore';
import { parseSqlToSdl, detectSqlStats } from '../../parsers/sql/sqlToSdl';
import styles from './ImportModal.module.css';

const ECOMMERCE_SAMPLE = `-- E-Commerce Sample Schema
CREATE TABLE users (
  id INT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT
);

CREATE TABLE products (
  id INT PRIMARY KEY,
  category_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock INT DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE orders (
  id INT PRIMARY KEY,
  user_id INT NOT NULL,
  status VARCHAR(50) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
  id INT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
`;

const BLOG_SAMPLE = `-- Blog & CMS Schema
CREATE TABLE authors (
  id INT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  bio TEXT,
  created_at TIMESTAMP
);

CREATE TABLE posts (
  id INT PRIMARY KEY,
  author_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  published BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (author_id) REFERENCES authors(id)
);

CREATE TABLE comments (
  id INT PRIMARY KEY,
  post_id INT NOT NULL,
  author_id INT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (author_id) REFERENCES authors(id)
);

CREATE TABLE tags (
  id INT PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE post_tags (
  post_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);
`;

export const ImportModal: React.FC = () => {
  const setActiveModal = useUIStore((s) => s.setActiveModal);
  const { sdlText, setSdlText } = useSdlStore();

  const [sqlContent, setSqlContent] = useState(ECOMMERCE_SAMPLE);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveModal]);

  // Live detection of tables & refs
  const stats = detectSqlStats(sqlContent);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setSqlContent(text);
        setErrorMessage(null);
      }
    };
    reader.readAsText(file);
    // Reset file input so user can pick same file again if desired
    e.target.value = '';
  };

  const triggerAutoLayout = useUIStore((s) => s.triggerAutoLayout);

  const handleImport = () => {
    setErrorMessage(null);
    const result = parseSqlToSdl(sqlContent);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    if (result.tables.length === 0) {
      setErrorMessage('No valid CREATE TABLE statements detected in SQL content.');
      return;
    }

    if (importMode === 'replace') {
      setSdlText(result.sdl);
    } else {
      const current = sdlText.trim();
      const updated = current ? `${current}\n\n// --- Imported from SQL ---\n${result.sdl}` : result.sdl;
      setSdlText(updated);
    }

    // Auto-arrange the imported tables once parsed
    setTimeout(() => {
      triggerAutoLayout('LR');
    }, 400);

    setActiveModal(null);
  };

  return (
    <div className={styles.backdrop} onClick={() => setActiveModal(null)}>
      <div 
        className={styles.modal} 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIconWrapper}>
              <Database size={20} />
            </div>
            <div>
              <h2 id="import-modal-title" className={styles.title}>Import SQL DDL</h2>
              <p className={styles.subtitle}>Convert raw PostgreSQL, MySQL, SQLite, or SQL Server DDL into ERD schema</p>
            </div>
          </div>
          <button 
            className={styles.closeButton} 
            onClick={() => setActiveModal(null)}
            title="Close modal (Esc)"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Preset Samples */}
          <div className={styles.presetBar}>
            <span className={styles.presetLabel}>Quick Presets:</span>
            <button 
              type="button" 
              className={styles.presetButton}
              onClick={() => { setSqlContent(ECOMMERCE_SAMPLE); setErrorMessage(null); }}
            >
              <Sparkles size={13} /> E-Commerce (5 tables)
            </button>
            <button 
              type="button" 
              className={styles.presetButton}
              onClick={() => { setSqlContent(BLOG_SAMPLE); setErrorMessage(null); }}
            >
              <Sparkles size={13} /> Blog & CMS (5 tables)
            </button>
            {sqlContent && (
              <button 
                type="button" 
                className={styles.clearButton}
                onClick={() => { setSqlContent(''); setErrorMessage(null); }}
                title="Clear input"
              >
                <Trash2 size={13} /> Clear
              </button>
            )}
          </div>

          {/* File Upload Zone */}
          <div className={styles.uploadZone}>
            <div className={styles.uploadZoneText}>
              <FileCode size={18} color="var(--color-brand-400)" />
              <span>Upload a <code>.sql</code> or <code>.ddl</code> file from your machine</span>
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".sql,.ddl,.txt" 
              className={styles.uploadInput}
              onChange={handleFileUpload}
            />
            <button 
              type="button" 
              className={styles.fileButton}
              onClick={() => fileInputRef.current?.click()}
            >
              Browse File...
            </button>
          </div>

          {/* SQL Input Textarea */}
          <div className={styles.textareaWrapper}>
            <div className={styles.textareaLabelRow}>
              <span>Paste SQL Statements:</span>
              <span>Supports CREATE TABLE, PRIMARY KEY, FOREIGN KEY, REFERENCES</span>
            </div>
            <textarea 
              className={styles.sqlTextarea}
              value={sqlContent}
              onChange={(e) => {
                setSqlContent(e.target.value);
                setErrorMessage(null);
              }}
              placeholder={`CREATE TABLE example (\n  id INT PRIMARY KEY,\n  title VARCHAR(255) NOT NULL\n);`}
              spellCheck={false}
            />
          </div>

          {/* Live Analysis Banner */}
          <div className={styles.statsBanner}>
            <div className={styles.statsChips}>
              {stats.tableCount > 0 ? (
                <>
                  <span className={styles.statBadge}>
                    <span className={styles.statDot} />
                    {stats.tableCount} {stats.tableCount === 1 ? 'Table' : 'Tables'} Detected
                  </span>
                  <span className={styles.statBadge} style={{ color: 'var(--color-text-secondary)' }}>
                    <Layers size={13} />
                    {stats.refCount} Foreign Key {stats.refCount === 1 ? 'Relation' : 'Relations'}
                  </span>
                </>
              ) : (
                <span className={styles.emptyStat}>
                  No table definitions detected yet. Paste valid SQL CREATE TABLE statements.
                </span>
              )}
            </div>

            {/* Mode Switcher */}
            <div className={styles.modeWrapper}>
              <span className={styles.modeLabel}>Strategy:</span>
              <div className={styles.modeOptions}>
                <button 
                  type="button"
                  className={`${styles.modeButton} ${importMode === 'replace' ? styles.modeButtonActive : ''}`}
                  onClick={() => setImportMode('replace')}
                >
                  Replace
                </button>
                <button 
                  type="button"
                  className={`${styles.modeButton} ${importMode === 'append' ? styles.modeButtonActive : ''}`}
                  onClick={() => setImportMode('append')}
                >
                  Append
                </button>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#f87171',
              fontSize: '0.82rem',
            }}>
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button 
            type="button" 
            className={styles.cancelButton}
            onClick={() => setActiveModal(null)}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className={styles.importButton}
            onClick={handleImport}
            disabled={stats.tableCount === 0}
          >
            <span>Import to Canvas</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
