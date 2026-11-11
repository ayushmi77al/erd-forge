import { Handle, type Node, type NodeProps, Position, useStore } from "@xyflow/react";
import { Key, Link2, Table2 } from "lucide-react";
import { memo } from "react";
import type { SDLTable } from "../../../types/sdl";
import styles from "./TableNode.module.css";

export interface TableNodeData extends Record<string, unknown> {
  entity: SDLTable;
  domainColor?: string;
  domainName?: string;
  fkColumns?: string[];
  highlightedColumns?: string[];
  isDimmed?: boolean;
}

export type TableNodeType = Node<TableNodeData, "table">;

export const TableNode = memo(({ data, selected }: NodeProps<TableNodeType>) => {
  const zoom = useStore((s) => s.transform[2]);
  // Full columns above 35% zoom, compact (PKs only) above 20%, name-only below 20%
  const displayMode = zoom > 0.35 ? "full" : zoom > 0.2 ? "compact" : "name_only";

  const entity = data.entity;
  const fkSet = new Set(data.fkColumns || []);
  const highlightedSet = new Set(data.highlightedColumns || []);

  return (
    <div
      className={styles.tableNode}
      data-selected={selected}
      data-dimmed={data.isDimmed || undefined}
      data-mode={displayMode}
      role="figure"
      aria-label={`Table ${entity.name}`}
    >
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          <Table2 size={13} className={styles.tableIcon} aria-hidden="true" />
          <span className={styles.tableName} title={entity.name}>
            {entity.name}
          </span>
        </span>
        {data.domainName ? (
          <span
            className={styles.domainBadge}
            style={data.domainColor ? { backgroundColor: data.domainColor } : undefined}
          >
            {data.domainName}
          </span>
        ) : (
          <span className={styles.colCount} title={`${entity.columns.length} columns`}>
            {entity.columns.length}
          </span>
        )}
      </div>

      {displayMode !== "name_only" && (
        <div className={styles.columns}>
          {entity.columns.map((col, idx) => {
            const isPk = col.options.some((o) => o.key === "pk" && o.value === true);
            const isFk = fkSet.has(col.name);
            const isUnique = col.options.some((o) => o.key === "unique" && o.value === true);
            const isNotNull = col.options.some((o) => o.key === "not null" && o.value === true);
            const isHighlighted = highlightedSet.has(col.name);
            // In compact mode, show only PKs or first 3 columns
            if (displayMode === "compact" && !isPk && idx > 2) return null;

            const rowClasses = [
              styles.columnRow,
              isPk ? styles.pkRow : isFk ? styles.fkRow : "",
              isHighlighted ? styles.highlightedRow : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div key={col.name} className={rowClasses}>
                {/* Column-level handles on both left and right for seamless routing */}
                <Handle
                  type="source"
                  id={`left-${col.name}`}
                  position={Position.Left}
                  className={styles.handle}
                  aria-label={`Connect left handle for ${entity.name}.${col.name}`}
                />
                <Handle
                  type="source"
                  id={`right-${col.name}`}
                  position={Position.Right}
                  className={styles.handle}
                  aria-label={`Connect right handle for ${entity.name}.${col.name}`}
                />

                <div className={styles.column}>
                  <div className={styles.columnName}>
                    {isPk && <Key size={12} className={styles.pkIcon} aria-label="Primary key" />}
                    {isFk && !isPk && <Link2 size={12} className={styles.fkIcon} aria-label="Foreign key" />}
                    <span className={styles.colLabel} title={col.name}>
                      {col.name}
                    </span>
                  </div>
                  {displayMode === "full" && (
                    <div className={styles.columnRight}>
                      <span className={styles.columnType}>{col.dataType}</span>
                      {isPk && <span className={`${styles.optBadge} ${styles.pkBadge}`}>PK</span>}
                      {isFk && <span className={`${styles.optBadge} ${styles.fkBadge}`}>FK</span>}
                      {isUnique && !isPk && <span className={styles.optBadge}>UQ</span>}
                      {isNotNull && !isPk && <span className={styles.optBadge}>NN</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

TableNode.displayName = "TableNode";
