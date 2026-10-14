import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { 
  Database, 
  GitBranch, 
  Filter, 
  CheckCircle2, 
  Layers, 
  GitMerge, 
  Eye, 
  Table as TableIcon,
  Link,
  Ghost
} from 'lucide-react';
import { LineageNode, LineageNodeType } from '../../../lineage/models/LineageNode';
import styles from './SqlLineageNode.module.css';

export interface SqlLineageNodeData {
  node: LineageNode;
  cardDisplayMode: 'full' | 'compact';
  viewMode: 'table' | 'column';
  layoutDirection: 'LR' | 'TB';
  isDimmed?: boolean;
  isHighlighted?: boolean;
}

function getNodeIcon(type: LineageNodeType) {
  switch (type) {
    case 'TABLE':
      return <Database size={15} className={styles.icon} />;
    case 'VIEW':
      return <Eye size={15} className={styles.icon} />;
    case 'CTE':
      return <GitBranch size={15} className={styles.icon} />;
    case 'SUBQUERY':
      return <Filter size={15} className={styles.icon} />;
    case 'FINAL_SELECT':
      return <CheckCircle2 size={15} className={styles.icon} />;
    case 'WINDOW_FUNCTION':
      return <Layers size={15} className={styles.icon} />;
    case 'SET_OPERATION':
      return <GitMerge size={15} className={styles.icon} />;
    default:
      return <TableIcon size={15} className={styles.icon} />;
  }
}

export const SqlLineageNode = memo(({ data, selected }: NodeProps<any>) => {
  const { 
    node, 
    cardDisplayMode = 'full', 
    viewMode = 'table', 
    layoutDirection = 'LR',
    isDimmed = false,
    isHighlighted = false,
  } = data as SqlLineageNodeData;

  const isLR = layoutDirection === 'LR';
  const Pos1 = isLR ? Position.Left : Position.Top;
  const Pos2 = isLR ? Position.Right : Position.Bottom;
  const pfx1 = isLR ? 'left' : 'top';
  const pfx2 = isLR ? 'right' : 'bottom';

  const typeClass = `type_${node.type.toLowerCase()}`;

  return (
    <div 
      className={`
        ${styles.node} 
        ${styles[typeClass] || ''} 
        ${selected ? styles.selected : ''}
        ${isHighlighted ? styles.highlighted : ''}
        ${isDimmed ? styles.dimmed : ''}
      `}
    >
      {/* Node-level target handles for incoming table-level flow */}
      {node.type !== 'TABLE' && node.type !== 'VIEW' && (
        <>
          <Handle type="target" position={Pos1} id={`${pfx1}-node-target`} className={styles.handle} />
          <Handle type="target" position={Pos2} id={`${pfx2}-node-target`} className={styles.handle} />
        </>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {getNodeIcon(node.type)}
          <div className={styles.titleCol}>
            <span className={styles.title} title={node.name}>
              {node.name}
            </span>
            {node.alias && node.alias !== node.name && (
              <span className={styles.alias}>as {node.alias}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {node.linkedEntityId && (
            <span className={styles.erdBadge} title="Mapped to ERD schema table">
              <Link size={9} /> ERD
            </span>
          )}
          {node.isPhantom && node.type === 'TABLE' && (
            <span className={styles.phantomBadge} title="Virtual / External table">
              <Ghost size={9} /> Virtual
            </span>
          )}
          <span className={styles.badge}>{node.type}</span>
        </div>
      </div>

      {/* Body: Full Columns or Compact summary */}
      {cardDisplayMode === 'full' && node.columns && node.columns.length > 0 ? (
        <div className={styles.columnsContainer}>
          {node.columns.map((col) => (
            <div key={col.id} className={styles.columnRow}>
              {viewMode === 'column' && node.type !== 'TABLE' && node.type !== 'VIEW' && (
                <>
                  <Handle type="target" position={Pos1} id={`${pfx1}-${col.id}-in`} className={styles.columnHandle} />
                  <Handle type="target" position={Pos2} id={`${pfx2}-${col.id}-in`} className={styles.columnHandle} />
                </>
              )}
              <span className={styles.columnName} title={col.name}>
                {col.name}
              </span>
              <span className={styles.columnType}>{col.dataType || 'any'}</span>
              {viewMode === 'column' && node.type !== 'FINAL_SELECT' && (
                <>
                  <Handle type="source" position={Pos1} id={`${pfx1}-${col.id}-out`} className={styles.columnHandle} />
                  <Handle type="source" position={Pos2} id={`${pfx2}-${col.id}-out`} className={styles.columnHandle} />
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.compactFooter}>
          {node.columns?.length || 0} columns
        </div>
      )}

      {/* Node-level source handles for outgoing table-level flow */}
      {node.type !== 'FINAL_SELECT' && (
        <>
          <Handle type="source" position={Pos1} id={`${pfx1}-node-source`} className={styles.handle} />
          <Handle type="source" position={Pos2} id={`${pfx2}-node-source`} className={styles.handle} />
        </>
      )}
    </div>
  );
});

SqlLineageNode.displayName = 'SqlLineageNode';
