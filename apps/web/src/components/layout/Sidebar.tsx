import React, { useState, useMemo } from 'react';
import { useSdlStore } from '../../stores/sdlStore';
import { useUIStore } from '../../stores/uiStore';
import { 
  Table as TableIcon, 
  PanelLeftClose, 
  Search, 
  X, 
  ChevronRight, 
  Key, 
  Plus,
  Upload
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { SDLTable } from '../../types/sdl';

export const Sidebar: React.FC = () => {
  const ast = useSdlStore((state) => state.ast);
  const sdlText = useSdlStore((state) => state.sdlText);
  const setSdlText = useSdlStore((state) => state.setSdlText);
  
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);
  const selectedTable = useUIStore((s) => s.selectedTable);
  const setSelectedTable = useUIStore((s) => s.setSelectedTable);
  const setActiveModal = useUIStore((s) => s.setActiveModal);

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const tables = useMemo(() => {
    return (ast?.statements.filter((s) => s.type === 'Table') as SDLTable[]) || [];
  }, [ast]);

  // Filter tables by table name or column name
  const filteredTables = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q))
    );
  }, [tables, searchQuery]);

  const toggleExpand = (tableName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  };

  const handleSelectTable = (tableName: string) => {
    // If clicking already selected, re-triggering still works via store
    setSelectedTable(tableName);
  };

  const handleAddTable = () => {
    const newName = `table_${tables.length + 1}`;
    const template = `\n\nTable ${newName} {\n  id integer [pk]\n  created_at timestamp\n}`;
    setSdlText(sdlText + template);
    setSelectedTable(newName);
  };

  return (
    <aside className={styles.sidebar}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>Catalog</span>
          <span className={styles.countBadge}>{tables.length}</span>
        </div>
        <div className={styles.headerActions}>
          <button
            onClick={() => setActiveModal('import')}
            className={styles.iconBtn}
            title="Import SQL DDL"
          >
            <Upload size={14} />
          </button>
          <button
            onClick={handleAddTable}
            className={styles.iconBtn}
            title="Add New Table"
          >
            <Plus size={15} />
          </button>
          <button
            onClick={toggleLeftPanel}
            className={styles.iconBtn}
            title="Collapse Sidebar"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className={styles.searchWrapper}>
        <div className={styles.searchBox}>
          <Search size={14} color="var(--color-text-muted)" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Filter tables or columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={styles.clearBtn}
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {filteredTables.length === 0 ? (
          <div className={styles.emptyMessage}>
            {searchQuery ? (
              <span>No tables match "{searchQuery}"</span>
            ) : (
              <span>No tables defined. Click + to add one.</span>
            )}
          </div>
        ) : (
          <ul className={styles.tableList}>
            {filteredTables.map((table) => {
              const isExpanded = expandedTables.has(table.name);
              const isSelected = selectedTable === table.name;

              return (
                <li
                  key={table.name}
                  className={`${styles.tableItem} ${isSelected ? styles.selected : ''}`}
                >
                  <div
                    className={styles.tableHeader}
                    onClick={() => handleSelectTable(table.name)}
                  >
                    <span
                      className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}
                      onClick={(e) => toggleExpand(table.name, e)}
                      title={isExpanded ? 'Collapse columns' : 'Expand columns'}
                    >
                      <ChevronRight size={14} />
                    </span>
                    <TableIcon size={14} className={styles.tableIcon} />
                    <span className={styles.tableName} title={table.name}>
                      {table.name}
                    </span>
                    <span className={styles.colCount}>
                      {table.columns.length}
                    </span>
                  </div>

                  {/* Expanded Columns Tree */}
                  {isExpanded && (
                    <ul className={styles.columnsTree}>
                      {table.columns.map((col) => {
                        const isPk = col.options.some(
                          (o) => o.key === 'pk' && o.value === true
                        );
                        return (
                          <li key={col.name} className={styles.columnLeaf}>
                            <div className={styles.colNameGroup}>
                              {isPk ? (
                                <Key size={11} className={styles.leafPk} />
                              ) : (
                                <span style={{ width: 11, height: 11, display: 'inline-block' }} />
                              )}
                              <span>{col.name}</span>
                            </div>
                            <span className={styles.leafType}>{col.dataType}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};
