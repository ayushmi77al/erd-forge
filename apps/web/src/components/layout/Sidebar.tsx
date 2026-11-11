import { ChevronRight, Key, PanelLeftClose, Plus, Search, Table as TableIcon, Upload, X } from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useSdlStore } from "../../stores/sdlStore";
import { useUIStore } from "../../stores/uiStore";
import type { SDLTable } from "../../types/sdl";
import styles from "./Sidebar.module.css";

export const Sidebar: React.FC = () => {
  const ast = useSdlStore((state) => state.ast);
  const sdlText = useSdlStore((state) => state.sdlText);
  const setSdlText = useSdlStore((state) => state.setSdlText);

  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);
  const selectedTable = useUIStore((s) => s.selectedTable);
  const setSelectedTable = useUIStore((s) => s.setSelectedTable);
  const setActiveModal = useUIStore((s) => s.setActiveModal);

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const tables = useMemo(() => {
    return (ast?.statements.filter((s) => s.type === "Table") as SDLTable[]) || [];
  }, [ast]);

  // Filter tables by table name or column name
  const filteredTables = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter(
      (t) => t.name.toLowerCase().includes(q) || t.columns.some((c) => c.name.toLowerCase().includes(q)),
    );
  }, [tables, searchQuery]);

  const toggleExpand = useCallback((tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  }, []);

  const handleSelectTable = useCallback(
    (tableName: string) => {
      setSelectedTable(tableName);
    },
    [setSelectedTable],
  );

  const handleAddTable = useCallback(() => {
    const newName = `table_${tables.length + 1}`;
    const template = `\n\nTable ${newName} {\n  id integer [pk]\n  created_at timestamp\n}`;
    setSdlText(sdlText + template);
    setSelectedTable(newName);
  }, [tables.length, sdlText, setSdlText, setSelectedTable]);

  return (
    <aside className={styles.sidebar} aria-label="Schema table catalog">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>Catalog</span>
          <span className={styles.countBadge}>{tables.length}</span>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={() => setActiveModal("import")}
            className={styles.iconBtn}
            title="Import SQL DDL"
            aria-label="Import SQL DDL"
          >
            <Upload size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleAddTable}
            className={styles.iconBtn}
            title="Add New Table"
            aria-label="Add new table"
          >
            <Plus size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggleLeftPanel}
            className={styles.iconBtn}
            title="Collapse Sidebar"
            aria-label="Close sidebar"
          >
            <PanelLeftClose size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className={styles.searchWrapper}>
        <div className={styles.searchBox}>
          <Search size={14} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Filter tables or columns..."
            aria-label="Filter tables or columns"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className={styles.clearBtn}
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={13} aria-hidden="true" />
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
                <li key={table.name} className={`${styles.tableItem} ${isSelected ? styles.selected : ""}`}>
                  <div className={styles.tableHeader}>
                    <button
                      type="button"
                      className={styles.expandBtn}
                      onClick={() => toggleExpand(table.name)}
                      title={isExpanded ? "Collapse columns" : "Expand columns"}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? `Collapse ${table.name} columns` : `Expand ${table.name} columns`}
                    >
                      <span className={`${styles.chevron} ${isExpanded ? styles.expanded : ""}`}>
                        <ChevronRight size={14} aria-hidden="true" />
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.tableSelectBtn}
                      onClick={() => handleSelectTable(table.name)}
                      aria-pressed={isSelected}
                      title={table.name}
                    >
                      <TableIcon size={14} className={styles.tableIcon} aria-hidden="true" />
                      <span className={styles.tableName}>{table.name}</span>
                      <span className={styles.colCount}>{table.columns.length}</span>
                    </button>
                  </div>

                  {/* Expanded Columns Tree */}
                  {isExpanded && (
                    <ul className={styles.columnsTree}>
                      {table.columns.map((col) => {
                        const isPk = col.options.some((o) => o.key === "pk" && o.value === true);
                        return (
                          <li key={col.name} className={styles.columnLeaf}>
                            <div className={styles.colNameGroup}>
                              {isPk ? (
                                <Key size={11} className={styles.leafPk} aria-label="Primary key" />
                              ) : (
                                <span className={styles.pkIconSpacer} aria-hidden="true" />
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
