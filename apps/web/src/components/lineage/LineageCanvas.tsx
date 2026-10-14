import React, { useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  ControlButton,
  Node, 
  Edge, 
  NodeTypes, 
  ReactFlowProvider, 
  BackgroundVariant, 
  MarkerType, 
  useReactFlow,
  NodeChange
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Sparkles, RefreshCw } from 'lucide-react';
import { useLineageStore } from '../../stores/lineageStore';
import { SqlLineageNode } from './nodes/SqlLineageNode';
import { calculateLineageLayout } from '../../lineage/layout/lineageLayout';
import styles from './LineageCanvas.module.css';

const nodeTypes: NodeTypes = {
  sqlLineageNode: SqlLineageNode as any,
};

interface LineageCanvasProps {
  onAnalyze?: () => void;
}

const LineageCanvasInner: React.FC<LineageCanvasProps> = ({ onAnalyze }) => {
  const { fitView } = useReactFlow();

  const graph = useLineageStore((s) => s.graph);
  const nodePositions = useLineageStore((s) => s.nodePositions);
  const setNodePosition = useLineageStore((s) => s.setNodePosition);
  const selectedNodeId = useLineageStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useLineageStore((s) => s.setSelectedNodeId);
  const viewMode = useLineageStore((s) => s.viewMode);
  const cardDisplayMode = useLineageStore((s) => s.cardDisplayMode);
  const layoutDirection = useLineageStore((s) => s.layoutDirection);
  const layoutEpoch = useLineageStore((s) => s.layoutEpoch);
  const triggerAutoLayout = useLineageStore((s) => s.triggerAutoLayout);

  const prevEpochRef = useRef(layoutEpoch);
  const prevGraphRef = useRef<any>(null);

  // Compute or update layout positions when graph or layoutEpoch changes
  useEffect(() => {
    if (!graph || graph.nodes.length === 0) return;

    const isGraphChanged = graph !== prevGraphRef.current;
    const isEpochChanged = layoutEpoch > prevEpochRef.current;

    if (isGraphChanged || isEpochChanged) {
      prevEpochRef.current = layoutEpoch;
      prevGraphRef.current = graph;

      const calculated = calculateLineageLayout(graph.nodes, graph.edges, {
        direction: layoutDirection,
        compact: cardDisplayMode === 'compact',
      });

      const currentPositions = useLineageStore.getState().nodePositions;
      const newPositions: Record<string, { x: number; y: number }> = {};
      calculated.forEach((pos, id) => {
        if (!isEpochChanged && currentPositions[id]) {
          newPositions[id] = currentPositions[id];
        } else {
          newPositions[id] = pos;
        }
      });

      useLineageStore.getState().setAllNodePositions(newPositions);

      // Fit view smoothly after layout calculation
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 400 });
      }, 50);
    }
  }, [graph, layoutEpoch, layoutDirection, cardDisplayMode, fitView]);

  // Trace upstream and downstream connected nodes for interactive path highlighting
  const { connectedNodeIds, connectedEdgeIds } = useMemo(() => {
    if (!graph || !selectedNodeId) {
      return { connectedNodeIds: new Set<string>(), connectedEdgeIds: new Set<string>() };
    }

    const nodeSet = new Set<string>([selectedNodeId]);
    const edgeSet = new Set<string>();

    // BFS Upstream
    const upstreamQueue = [selectedNodeId];
    while (upstreamQueue.length > 0) {
      const current = upstreamQueue.shift()!;
      graph.edges.forEach((e) => {
        const src = e.sourceNodeId || e.source;
        const tgt = e.targetNodeId || e.target;
        if (tgt === current) {
          edgeSet.add(e.id);
          if (!nodeSet.has(src)) {
            nodeSet.add(src);
            upstreamQueue.push(src);
          }
        }
      });
    }

    // BFS Downstream
    const downstreamQueue = [selectedNodeId];
    while (downstreamQueue.length > 0) {
      const current = downstreamQueue.shift()!;
      graph.edges.forEach((e) => {
        const src = e.sourceNodeId || e.source;
        const tgt = e.targetNodeId || e.target;
        if (src === current) {
          edgeSet.add(e.id);
          if (!nodeSet.has(tgt)) {
            nodeSet.add(tgt);
            downstreamQueue.push(tgt);
          }
        }
      });
    }

    return { connectedNodeIds: nodeSet, connectedEdgeIds: edgeSet };
  }, [graph, selectedNodeId]);

  // Convert graph.nodes to ReactFlow Node[]
  const rfNodes: Node[] = useMemo(() => {
    if (!graph) return [];

    return graph.nodes.map((node) => {
      const position = nodePositions[node.id] || { x: 100, y: 100 };
      const isSelected = selectedNodeId === node.id;
      const isConnected = !selectedNodeId || connectedNodeIds.has(node.id);
      const isHighlighted = Boolean(selectedNodeId && connectedNodeIds.has(node.id) && selectedNodeId !== node.id);
      const isDimmed = Boolean(selectedNodeId && !connectedNodeIds.has(node.id));

      return {
        id: node.id,
        type: 'sqlLineageNode',
        position,
        selected: isSelected,
        data: {
          node,
          cardDisplayMode,
          viewMode,
          layoutDirection,
          isDimmed,
          isHighlighted,
        },
      };
    });
  }, [graph, nodePositions, selectedNodeId, connectedNodeIds, cardDisplayMode, viewMode, layoutDirection]);

  // Convert graph.edges to ReactFlow Edge[]
  const rfEdges: Edge[] = useMemo(() => {
    if (!graph) return [];

    if (viewMode === 'column') {
      // Column-level wiring
      const colEdges: Edge[] = [];
      graph.edges.forEach((edge) => {
        const src = edge.sourceNodeId || edge.source;
        const tgt = edge.targetNodeId || edge.target;
        const isEdgeConnected = !selectedNodeId || connectedEdgeIds.has(edge.id);

        const srcPos = nodePositions[src] || { x: 0, y: 0 };
        const tgtPos = nodePositions[tgt] || { x: 0, y: 0 };
        const isLR = layoutDirection === 'LR';
        let pfxSrc = '';
        let pfxTgt = '';
        if (isLR) {
          const tgtIsRight = tgtPos.x >= srcPos.x;
          pfxSrc = tgtIsRight ? 'right' : 'left';
          pfxTgt = tgtIsRight ? 'left' : 'right';
        } else {
          const tgtIsBelow = tgtPos.y >= srcPos.y;
          pfxSrc = tgtIsBelow ? 'bottom' : 'top';
          pfxTgt = tgtIsBelow ? 'top' : 'bottom';
        }

        if (edge.columnLineage && edge.columnLineage.length > 0) {
          // Identify source columns that already have a direct projection to this target node
          const directSourceCols = new Set(
            edge.columnLineage.filter((c) => c.isDirect).map((c) => c.sourceColumnId)
          );

          edge.columnLineage.forEach((colLin, idx) => {
            // Deduplicate: If we already have a direct line from this column, skip drawing the indirect line to the node target
            if (!colLin.isDirect && directSourceCols.has(colLin.sourceColumnId)) {
              return;
            }

            const tgtNode = graph.nodes.find((n) => n.id === tgt);
            const hasTargetColHandle = Boolean(
              colLin.isDirect && tgtNode?.columns?.some((c) => c.id === colLin.targetColumnId)
            );
            const targetHandle = hasTargetColHandle
              ? `${pfxTgt}-${colLin.targetColumnId}-in`
              : `${pfxTgt}-node-target`;

            colEdges.push({
              id: `${edge.id}-col-${idx}`,
              source: src,
              target: tgt,
              sourceHandle: `${pfxSrc}-${colLin.sourceColumnId}-out`,
              targetHandle,
              type: 'bezier',
              animated: Boolean(selectedNodeId && isEdgeConnected),
              style: {
                stroke: isEdgeConnected 
                  ? (selectedNodeId ? 'var(--color-brand-400)' : 'rgba(99, 102, 241, 0.5)')
                  : 'rgba(100, 116, 139, 0.15)',
                strokeWidth: selectedNodeId && isEdgeConnected ? 2 : 1.5,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 12,
                height: 12,
                color: isEdgeConnected 
                  ? (selectedNodeId ? 'var(--color-brand-400)' : 'rgba(99, 102, 241, 0.5)')
                  : 'rgba(100, 116, 139, 0.15)',
              },
            });
          });
        } else {
          // Fallback to table edge if no columns mapped
          colEdges.push({
            id: edge.id,
            source: src,
            target: tgt,
            sourceHandle: `${pfxSrc}-node-source`,
            targetHandle: `${pfxTgt}-node-target`,
            type: 'smoothstep',
            animated: Boolean(selectedNodeId && isEdgeConnected),
            style: { 
              stroke: isEdgeConnected 
                ? (selectedNodeId ? 'var(--color-brand-400)' : 'var(--color-border-strong)')
                : 'rgba(100, 116, 139, 0.15)', 
              strokeWidth: selectedNodeId && isEdgeConnected ? 2.5 : 1.5 
            },
          });
        }
      });
      return colEdges;
    }

    // Entity-level wiring
    return graph.edges.map((edge) => {
      const src = edge.sourceNodeId || edge.source;
      const tgt = edge.targetNodeId || edge.target;
      const isEdgeConnected = !selectedNodeId || connectedEdgeIds.has(edge.id);

      const srcPos = nodePositions[src] || { x: 0, y: 0 };
      const tgtPos = nodePositions[tgt] || { x: 0, y: 0 };
      const isLR = layoutDirection === 'LR';
      let pfxSrc = '';
      let pfxTgt = '';
      if (isLR) {
        const tgtIsRight = tgtPos.x >= srcPos.x;
        pfxSrc = tgtIsRight ? 'right' : 'left';
        pfxTgt = tgtIsRight ? 'left' : 'right';
      } else {
        const tgtIsBelow = tgtPos.y >= srcPos.y;
        pfxSrc = tgtIsBelow ? 'bottom' : 'top';
        pfxTgt = tgtIsBelow ? 'top' : 'bottom';
      }

      return {
        id: edge.id,
        source: src,
        target: tgt,
        sourceHandle: `${pfxSrc}-node-source`,
        targetHandle: `${pfxTgt}-node-target`,
        type: 'smoothstep',
        animated: Boolean(selectedNodeId && isEdgeConnected),
        style: {
          stroke: isEdgeConnected
            ? (selectedNodeId ? 'var(--color-brand-400)' : 'var(--color-border-strong)')
            : 'rgba(100, 116, 139, 0.15)',
          strokeWidth: selectedNodeId && isEdgeConnected ? 2.5 : 1.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: isEdgeConnected
            ? (selectedNodeId ? 'var(--color-brand-400)' : 'var(--color-border-strong)')
            : 'rgba(100, 116, 139, 0.15)',
        },
      };
    });
  }, [graph, viewMode, selectedNodeId, connectedEdgeIds, nodePositions, layoutDirection]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          setNodePosition(change.id, change.position);
        }
      });
    },
    [setNodePosition]
  );

  const onNodeDragStop = useCallback((_: any, node: Node) => {
    setNodePosition(node.id, node.position);
  }, [setNodePosition]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  return (
    <div className={styles.canvasWrapper}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        minZoom={0.2}
        maxZoom={2.5}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255, 255, 255, 0.08)" />
        <Controls showInteractive={false} position="bottom-right">
          <ControlButton 
            onClick={() => triggerAutoLayout()} 
            title="Auto-Arrange Graph Layout"
            aria-label="Auto-Arrange Layout"
          >
            <RefreshCw size={14} color="var(--color-text-secondary)" />
          </ControlButton>
        </Controls>
      </ReactFlow>

      {/* Empty State overlay */}
      {(!graph || graph.nodes.length === 0) && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconWrapper}>
            <Sparkles size={28} />
          </div>
          <div className={styles.emptyTitle}>Interactive SQL Lineage</div>
          <div className={styles.emptyText}>
            Visualize tables, CTEs, subqueries, and column dataflows for complex SQL pipelines across SQL Server, Postgres, MySQL, SQLite, and Oracle.
          </div>
          <button
            className={styles.emptyActionBtn}
            onClick={onAnalyze}
            type="button"
          >
            <Play size={14} fill="currentColor" />
            <span>Analyze SQL Query</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const LineageCanvas: React.FC<LineageCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <LineageCanvasInner {...props} />
    </ReactFlowProvider>
  );
};
