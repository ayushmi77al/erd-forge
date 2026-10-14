import React, { memo } from 'react';
import { Handle, Position, NodeProps, useStore, Node } from '@xyflow/react';
import { Key, Link2 } from 'lucide-react';
import { SDLTable } from '../../../types/sdl';
import styles from './TableNode.module.css';

export interface TableNodeData extends Record<string, unknown> {
  entity: SDLTable;
  domainColor?: string;
  domainName?: string;
  fkColumns?: string[];
}

export type TableNodeType = Node<TableNodeData, 'table'>;

export const TableNode = memo(({ data, selected }: NodeProps<TableNodeType>) => {
  const zoom = useStore((s) => s.transform[2]);
  // Full columns above 35% zoom, compact (PKs only) above 20%, name-only below 20%
  const displayMode = zoom > 0.35 ? 'full' : zoom > 0.2 ? 'compact' : 'name_only';
  
  const entity = data.entity;
  const fkSet = new Set(data.fkColumns || []);

  return (
    <div className={styles.tableNode} data-selected={selected} data-mode={displayMode}>
      <div className={styles.header}>
        <span>{entity.name}</span>
        {data.domainName && (
          <span 
            className={styles.domainBadge} 
            style={{ backgroundColor: data.domainColor }}
          >
            {data.domainName}
          </span>
        )}
      </div>

      {displayMode !== 'name_only' && (
        <div className={styles.columns}>
          {entity.columns.map((col, idx) => {
            const isPk = col.options.some(o => o.key === 'pk' && o.value === true);
            const isFk = fkSet.has(col.name);
            const isNotNull = col.options.some(o => o.key === 'not null' && o.value === true);
            // In compact mode, show only PKs or first 3 columns
            if (displayMode === 'compact' && !isPk && idx > 2) return null;

            return (
              <div key={col.name} className={`${styles.columnRow} ${isPk ? styles.pkRow : ''}`}>
                {/* Column-level handles on both left and right for seamless routing */}
                <Handle type="source" id={`left-${col.name}`} position={Position.Left} className={styles.handle} />
                <Handle type="source" id={`right-${col.name}`} position={Position.Right} className={styles.handle} />

                <div className={styles.column}>
                  <div className={styles.columnName}>
                    {isPk && <Key size={12} className={styles.pkIcon} />}
                    {isFk && !isPk && <Link2 size={12} className={styles.fkIcon} />}
                    <span>{col.name}</span>
                  </div>
                  {displayMode === 'full' && (
                    <div className={styles.columnRight}>
                      <span className={styles.columnType}>{col.dataType}</span>
                      {isNotNull && <span className={styles.optBadge}>NN</span>}
                      {isPk && <span className={styles.optBadge}>PK</span>}
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
