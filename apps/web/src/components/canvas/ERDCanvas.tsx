import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  ControlButton,
  MiniMap,
  Node,
  Edge,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  OnConnect,
  addEdge,
  ConnectionMode,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TableNode } from './nodes/TableNode';
import { RelationEdge } from './edges/RelationEdge';
import styles from './ERDCanvas.module.css';
import { useSdlStore } from '../../stores/sdlStore';
import { useUIStore } from '../../stores/uiStore';
import { SDLTable, SDLRef } from '../../types/sdl';
import { calculateAutoLayout } from '../../core/layout/autoLayout';
import { Sparkles } from 'lucide-react';

const nodeTypes: NodeTypes = {
  table: TableNode as any,
};

const edgeTypes: EdgeTypes = {
  relation: RelationEdge as any,
};

// Layout helper: Computes positions using Dagre for any tables not already manually positioned
function computeLayout(
  tables: SDLTable[],
  refs: SDLRef[],
  existingPositions: Map<string, { x: number; y: number }>,
  direction: 'LR' | 'TB' = 'LR'
) {
  const positions = new Map<string, { x: number; y: number }>();
  const missingTables = tables.filter((t) => !existingPositions.has(t.name));

  let autoPositions: Map<string, { x: number; y: number }> | null = null;
  if (missingTables.length > 0) {
    autoPositions = calculateAutoLayout(tables, refs, { direction });
  }

  tables.forEach((table) => {
    if (existingPositions.has(table.name)) {
      positions.set(table.name, existingPositions.get(table.name)!);
    } else if (autoPositions && autoPositions.has(table.name)) {
      const pos = autoPositions.get(table.name)!;
      positions.set(table.name, pos);
      existingPositions.set(table.name, pos);
    } else {
      positions.set(table.name, { x: 80, y: 80 });
    }
  });

  return positions;
}

const ERDCanvasInner: React.FC = () => {
  const ast = useSdlStore((state) => state.ast);
  const isStale = useSdlStore((state) => state.isStale);
  const errors = useSdlStore((state) => state.errors);
  const primaryError = errors[0] ?? null;

  const layoutEpoch = useUIStore((s) => s.layoutEpoch);
  const layoutDirection = useUIStore((s) => s.layoutDirection);
  const triggerAutoLayout = useUIStore((s) => s.triggerAutoLayout);

  // Track manually moved node positions so re-parses don't reset layout
  const savedPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  const { nodes: initNodes, edges: initEdges } = useMemo(() => {
    if (!ast) return { nodes: [], edges: [] };

    const tables: SDLTable[] = [];
    const refs: SDLRef[] = [];

    ast.statements.forEach((stmt) => {
      if (stmt.type === 'Table') tables.push(stmt as SDLTable);
      else if (stmt.type === 'Ref') refs.push(stmt as SDLRef);
    });

    const fkColumnsByTable = new Map<string, string[]>();
    refs.forEach((ref) => {
      const list = fkColumnsByTable.get(ref.sourceTable) || [];
      list.push(ref.sourceColumn);
      fkColumnsByTable.set(ref.sourceTable, list);
    });

    const positions = computeLayout(tables, refs, savedPositions.current, layoutDirection);

    const newNodes: Node[] = tables.map((table) => {
      return {
        id: table.name,
        type: 'table',
        position: positions.get(table.name)!,
        data: { 
          entity: table,
          fkColumns: fkColumnsByTable.get(table.name) || [],
        },
      };
    });

    const newEdges: Edge[] = refs.map((ref) => {
      const srcPos = positions.get(ref.sourceTable) || { x: 0, y: 0 };
      const tgtPos = positions.get(ref.targetTable) || { x: 0, y: 0 };
      // Connect to the nearest facing edges:
      const targetIsToTheRight = tgtPos.x >= srcPos.x;
      const srcHandle = targetIsToTheRight ? `right-${ref.sourceColumn}` : `left-${ref.sourceColumn}`;
      const tgtHandle = targetIsToTheRight ? `left-${ref.targetColumn}` : `right-${ref.targetColumn}`;

      return {
        id: `${ref.sourceTable}.${ref.sourceColumn}-${ref.targetTable}.${ref.targetColumn}`,
        type: 'relation',
        source: ref.sourceTable,
        target: ref.targetTable,
        sourceHandle: srcHandle,
        targetHandle: tgtHandle,
        data: { direction: ref.direction, sourceColumn: ref.sourceColumn, targetColumn: ref.targetColumn },
        style: { stroke: '#38bdf8', strokeWidth: 2 },
        label: `${ref.sourceColumn} → ${ref.targetColumn}`,
        labelStyle: { fill: '#e2e8f0', fontSize: 11 },
        labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9 },
      };
    });

    return { nodes: newNodes, edges: newEdges };
  }, [ast, layoutDirection]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);
  const { fitView } = useReactFlow();

  const prevNodeCountRef = useRef<number>(initNodes.length);

  // Synchronize AST changes into React Flow nodes and edges live via useEffect
  useEffect(() => {
    setNodes(initNodes);
    setEdges(initEdges);

    if (initNodes.length > prevNodeCountRef.current) {
      setTimeout(() => {
        fitView({ duration: 400, padding: 0.25 });
      }, 50);
    }
    prevNodeCountRef.current = initNodes.length;
  }, [initNodes, initEdges, setNodes, setEdges, fitView]);

  // Listen to layoutEpoch to re-arrange all nodes
  const prevEpochRef = useRef(layoutEpoch);
  useEffect(() => {
    if (layoutEpoch > prevEpochRef.current && ast) {
      prevEpochRef.current = layoutEpoch;

      const tables = ast.statements.filter((s) => s.type === 'Table') as SDLTable[];
      const refs = ast.statements.filter((s) => s.type === 'Ref') as SDLRef[];

      const newPositions = calculateAutoLayout(tables, refs, { direction: layoutDirection });

      // Overwrite saved positions with freshly computed dagre layout
      newPositions.forEach((pos, name) => {
        savedPositions.current.set(name, pos);
      });

      // Update nodes
      setNodes((prevNodes) =>
        prevNodes.map((n) => {
          const pos = newPositions.get(n.id);
          return pos ? { ...n, position: pos } : n;
        })
      );

      // Re-orient edges to face whichever side is closest
      setEdges((prevEdges) =>
        prevEdges.map((edge) => {
          const srcPos = newPositions.get(edge.source) || { x: 0, y: 0 };
          const tgtPos = newPositions.get(edge.target) || { x: 0, y: 0 };
          const targetIsToTheRight = tgtPos.x >= srcPos.x;
          const srcCol = (edge.data as any)?.sourceColumn;
          const tgtCol = (edge.data as any)?.targetColumn;
          return {
            ...edge,
            sourceHandle: targetIsToTheRight ? `right-${srcCol}` : `left-${srcCol}`,
            targetHandle: targetIsToTheRight ? `left-${tgtCol}` : `right-${tgtCol}`,
          };
        })
      );

      setTimeout(() => {
        fitView({ duration: 500, padding: 0.25 });
      }, 50);
    }
  }, [layoutEpoch, layoutDirection, ast, setNodes, setEdges, fitView]);

  // When user drags a node, record its new position and re-orient connected edges
  const onNodeDragStop = useCallback((_: any, node: Node) => {
    savedPositions.current.set(node.id, node.position);
    setEdges((prevEdges) =>
      prevEdges.map((edge) => {
        if (edge.source === node.id || edge.target === node.id) {
          const srcPos = edge.source === node.id ? node.position : (savedPositions.current.get(edge.source) || { x: 0, y: 0 });
          const tgtPos = edge.target === node.id ? node.position : (savedPositions.current.get(edge.target) || { x: 0, y: 0 });
          const targetIsToTheRight = tgtPos.x >= srcPos.x;
          const srcCol = (edge.data as any)?.sourceColumn;
          const tgtCol = (edge.data as any)?.targetColumn;
          return {
            ...edge,
            sourceHandle: targetIsToTheRight ? `right-${srcCol}` : `left-${srcCol}`,
            targetHandle: targetIsToTheRight ? `left-${tgtCol}` : `right-${tgtCol}`,
          };
        }
        return edge;
      })
    );
  }, [setEdges]);

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const selectedTable = useUIStore((s) => s.selectedTable);
  const setSelectedTable = useUIStore((s) => s.setSelectedTable);

  // Smoothly center and highlight when a table is selected in the Catalog
  useEffect(() => {
    if (selectedTable) {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          selected: n.id === selectedTable,
        }))
      );
      fitView({
        nodes: [{ id: selectedTable }],
        duration: 600,
        maxZoom: 1.2,
        padding: 0.3,
      });
    }
  }, [selectedTable, fitView, setNodes]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedTable(node.id);
    },
    [setSelectedTable]
  );

  const onPaneClick = useCallback(() => {
    setSelectedTable(null);
  }, [setSelectedTable]);

  return (
    <div className={styles.canvasWrapper}>
      {isStale && primaryError && (
        <div className={styles.staleNotice} title={`SDL error on line ${primaryError.line}: ${primaryError.message}`}>
          <span className={styles.pulseDot} />
          <span>Diagram preserved • SDL error on line {primaryError.line}</span>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode="Delete"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-border-subtle)" />
        <Controls>
          <ControlButton 
            onClick={() => triggerAutoLayout('LR')} 
            title="Auto-Arrange Diagram (Left to Right)"
            aria-label="Auto-Arrange Diagram"
          >
            <Sparkles size={14} color="var(--color-brand-400)" />
          </ControlButton>
        </Controls>
        <MiniMap zoomable pannable nodeColor={() => 'var(--color-surface-raised)'} />
      </ReactFlow>
    </div>
  );
};

export const ERDCanvas: React.FC = () => (
  <ReactFlowProvider>
    <ERDCanvasInner />
  </ReactFlowProvider>
);

