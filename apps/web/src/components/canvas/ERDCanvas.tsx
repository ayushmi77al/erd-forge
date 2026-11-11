import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionMode,
  ControlButton,
  Controls,
  type Edge,
  type EdgeTypes,
  MiniMap,
  type Node,
  type NodeTypes,
  type OnConnect,
  type OnNodeDrag,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import type React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import { Sparkles } from "lucide-react";
import { calculateAutoLayout } from "../../core/layout/autoLayout";
import { useSdlStore } from "../../stores/sdlStore";
import { useUIStore } from "../../stores/uiStore";
import type { SDLRef, SDLTable } from "../../types/sdl";
import styles from "./ERDCanvas.module.css";
import { RelationEdge, type RelationEdgeData } from "./edges/RelationEdge";
import { TableNode } from "./nodes/TableNode";
import { computeRelationFocus, pickEdgeHandles } from "./relationshipGeometry";

const nodeTypes: NodeTypes = {
  table: TableNode as NodeTypes[string],
};

const edgeTypes: EdgeTypes = {
  relation: RelationEdge as EdgeTypes[string],
};

// Layout helper: Computes initial fallback positions for nodes pending async ELK layout
function computeLayout(tables: SDLTable[], existingPositions: Map<string, { x: number; y: number }>) {
  const positions = new Map<string, { x: number; y: number }>();

  tables.forEach((table, idx) => {
    const saved = existingPositions.get(table.name);
    if (saved) {
      positions.set(table.name, saved);
    } else {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      positions.set(table.name, { x: 80 + col * 380, y: 80 + row * 280 });
    }
  });

  return positions;
}

/**
 * Updates source/target column handles on an edge based on relative node positions.
 */
function orientEdge(edge: Edge, srcPos: { x: number; y: number }, tgtPos: { x: number; y: number }): Edge {
  const edgeData = edge.data as RelationEdgeData | undefined;
  const srcCol = edgeData?.sourceColumn;
  const tgtCol = edgeData?.targetColumn;
  if (!srcCol || !tgtCol) return edge;
  const { sourceHandle, targetHandle } = pickEdgeHandles(srcPos, tgtPos, srcCol, tgtCol);
  return { ...edge, sourceHandle, targetHandle };
}

const ERDCanvasInner = memo(function ERDCanvasInner() {
  const ast = useSdlStore((state) => state.ast);
  const isStale = useSdlStore((state) => state.isStale);
  const errors = useSdlStore((state) => state.errors);
  const primaryError = errors[0] ?? null;

  const layoutEpoch = useUIStore((s) => s.layoutEpoch);
  const layoutDirection = useUIStore((s) => s.layoutDirection);
  const triggerAutoLayout = useUIStore((s) => s.triggerAutoLayout);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const handleEdgeHover = useCallback((edgeId: string | null) => {
    setHoveredEdgeId(edgeId);
  }, []);

  const selectedTable = useUIStore((s) => s.selectedTable);
  const setSelectedTable = useUIStore((s) => s.setSelectedTable);

  const handleEdgeSelect = useCallback(
    (edgeId: string) => {
      setSelectedEdgeId(edgeId);
      setSelectedTable(null);
    },
    [setSelectedTable],
  );

  // Track manually moved node positions so re-parses don't reset layout
  const savedPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  const { nodes: initNodes, edges: initEdges } = useMemo(() => {
    if (!ast) return { nodes: [], edges: [] };

    const tables: SDLTable[] = [];
    const refs: SDLRef[] = [];

    ast.statements.forEach((stmt) => {
      if (stmt.type === "Table") tables.push(stmt as SDLTable);
      else if (stmt.type === "Ref") refs.push(stmt as SDLRef);
    });

    const fkColumnsByTable = new Map<string, string[]>();
    refs.forEach((ref) => {
      const list = fkColumnsByTable.get(ref.sourceTable) || [];
      list.push(ref.sourceColumn);
      fkColumnsByTable.set(ref.sourceTable, list);
    });

    const positions = computeLayout(tables, savedPositions.current);

    const newNodes: Node[] = tables.map((table) => {
      return {
        id: table.name,
        type: "table",
        position: positions.get(table.name) ?? { x: 80, y: 80 },
        data: {
          entity: table,
          fkColumns: fkColumnsByTable.get(table.name) || [],
        },
      };
    });

    // Stagger smooth-step channel offsets when multiple edges share an endpoint table
    const sourceCountByTable = new Map<string, number>();

    const newEdges: Edge[] = refs.map((ref) => {
      const srcPos = positions.get(ref.sourceTable) || { x: 0, y: 0 };
      const tgtPos = positions.get(ref.targetTable) || { x: 0, y: 0 };
      const { sourceHandle, targetHandle } = pickEdgeHandles(srcPos, tgtPos, ref.sourceColumn, ref.targetColumn);
      const staggerIndex = sourceCountByTable.get(ref.sourceTable) ?? 0;
      sourceCountByTable.set(ref.sourceTable, staggerIndex + 1);

      return {
        id: `${ref.sourceTable}.${ref.sourceColumn}-${ref.targetTable}.${ref.targetColumn}`,
        type: "relation",
        source: ref.sourceTable,
        target: ref.targetTable,
        sourceHandle,
        targetHandle,
        data: {
          direction: ref.direction,
          sourceColumn: ref.sourceColumn,
          targetColumn: ref.targetColumn,
          pathOffset: 24 + (staggerIndex % 3) * 14,
          onEdgeHover: handleEdgeHover,
          onEdgeSelect: handleEdgeSelect,
        },
        style: { stroke: "var(--color-info)", strokeWidth: 2 },
        label: `${ref.sourceColumn} → ${ref.targetColumn}`,
      };
    });

    return { nodes: newNodes, edges: newEdges };
  }, [ast, handleEdgeHover, handleEdgeSelect]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);
  const { fitView } = useReactFlow();

  const prevNodeCountRef = useRef<number>(initNodes.length);

  // Generation tracking and AbortController to discard stale asynchronous layout results
  const layoutGenerationRef = useRef(0);
  const layoutAbortControllerRef = useRef<AbortController | null>(null);

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

  // Compute off-thread ELK layout whenever new unpositioned tables appear
  useEffect(() => {
    if (!ast) return;
    const tables = ast.statements.filter((s) => s.type === "Table") as SDLTable[];
    const refs = ast.statements.filter((s) => s.type === "Ref") as SDLRef[];

    const missingTables = tables.filter((t) => !savedPositions.current.has(t.name));
    if (missingTables.length === 0) return;

    if (layoutAbortControllerRef.current) {
      layoutAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    layoutAbortControllerRef.current = abortController;
    const generation = ++layoutGenerationRef.current;

    const timer = setTimeout(() => {
      calculateAutoLayout(tables, refs, {
        direction: layoutDirection,
        signal: abortController.signal,
      })
        .then((newPositions) => {
          if (generation !== layoutGenerationRef.current) return;
          newPositions.forEach((pos, name) => {
            savedPositions.current.set(name, pos);
          });
          setNodes((prevNodes) =>
            prevNodes.map((n) => {
              const pos = newPositions.get(n.id);
              return pos ? { ...n, position: pos } : n;
            }),
          );
          setEdges((prevEdges) =>
            prevEdges.map((edge) => {
              const srcPos = newPositions.get(edge.source) || savedPositions.current.get(edge.source) || { x: 0, y: 0 };
              const tgtPos = newPositions.get(edge.target) || savedPositions.current.get(edge.target) || { x: 0, y: 0 };
              return orientEdge(edge, srcPos, tgtPos);
            }),
          );
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.error("Auto-layout failed:", err);
          }
        });
    }, 50);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [ast, layoutDirection, setNodes, setEdges]);

  // Listen to layoutEpoch to re-arrange all nodes with stale protection
  const prevEpochRef = useRef(layoutEpoch);
  useEffect(() => {
    if (layoutEpoch > prevEpochRef.current && ast) {
      prevEpochRef.current = layoutEpoch;

      const tables = ast.statements.filter((s) => s.type === "Table") as SDLTable[];
      const refs = ast.statements.filter((s) => s.type === "Ref") as SDLRef[];

      if (layoutAbortControllerRef.current) {
        layoutAbortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      layoutAbortControllerRef.current = abortController;
      const generation = ++layoutGenerationRef.current;

      calculateAutoLayout(tables, refs, {
        direction: layoutDirection,
        signal: abortController.signal,
      })
        .then((newPositions) => {
          if (generation !== layoutGenerationRef.current) return;

          // Overwrite saved positions with freshly computed ELK layout
          newPositions.forEach((pos, name) => {
            savedPositions.current.set(name, pos);
          });

          // Update nodes
          setNodes((prevNodes) =>
            prevNodes.map((n) => {
              const pos = newPositions.get(n.id);
              return pos ? { ...n, position: pos } : n;
            }),
          );

          // Re-orient edges cleanly based on updated node positions
          setEdges((prevEdges) =>
            prevEdges.map((edge) => {
              const srcPos = newPositions.get(edge.source) || { x: 0, y: 0 };
              const tgtPos = newPositions.get(edge.target) || { x: 0, y: 0 };
              return orientEdge(edge, srcPos, tgtPos);
            }),
          );

          setTimeout(() => {
            fitView({ duration: 500, padding: 0.25 });
          }, 50);
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.error("Manual auto-arrange failed:", err);
          }
        });
    }
  }, [layoutEpoch, layoutDirection, ast, setNodes, setEdges, fitView]);

  // When user drags a node, record its new position and re-orient connected edges
  const onNodeDragStop: OnNodeDrag = useCallback(
    (_, node) => {
      savedPositions.current.set(node.id, node.position);
      setEdges((prevEdges) =>
        prevEdges.map((edge) => {
          if (edge.source === node.id || edge.target === node.id) {
            const srcPos =
              edge.source === node.id ? node.position : savedPositions.current.get(edge.source) || { x: 0, y: 0 };
            const tgtPos =
              edge.target === node.id ? node.position : savedPositions.current.get(edge.target) || { x: 0, y: 0 };
            return orientEdge(edge, srcPos, tgtPos);
          }
          return edge;
        }),
      );
    },
    [setEdges],
  );

  const onConnect: OnConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  // Smoothly center and highlight when a table is selected in the Catalog
  useEffect(() => {
    if (selectedTable) {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          selected: n.id === selectedTable,
        })),
      );
      fitView({
        nodes: [{ id: selectedTable }],
        duration: 600,
        maxZoom: 1.2,
        padding: 0.3,
      });
    } else {
      setNodes((nds) => (nds.some((n) => n.selected) ? nds.map((n) => ({ ...n, selected: false })) : nds));
    }
  }, [selectedTable, fitView, setNodes]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedEdgeId(null);
      setSelectedTable(node.id);
    },
    [setSelectedTable],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      handleEdgeSelect(edge.id);
    },
    [handleEdgeSelect],
  );

  const onPaneClick = useCallback(() => {
    setSelectedTable(null);
    setSelectedEdgeId(null);
    setHoveredNodeId(null);
    setHoveredEdgeId(null);
  }, [setSelectedTable]);

  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const onEdgeMouseEnter = useCallback((_: React.MouseEvent, edge: Edge) => {
    setHoveredEdgeId(edge.id);
  }, []);

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null);
  }, []);

  const relationFocus = useMemo(() => {
    const edgeDescriptors = edges.map((edge) => {
      const edgeData = edge.data as RelationEdgeData | undefined;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceColumn: edgeData?.sourceColumn,
        targetColumn: edgeData?.targetColumn,
      };
    });
    const focusedEdgeId = hoveredEdgeId ?? (hoveredNodeId ? null : selectedEdgeId);
    const focusedTableId = hoveredNodeId ?? selectedTable;
    return computeRelationFocus(edgeDescriptors, focusedTableId, focusedEdgeId);
  }, [edges, hoveredEdgeId, hoveredNodeId, selectedEdgeId, selectedTable]);

  const renderedNodes = useMemo(() => {
    if (!relationFocus.isFocused) return nodes;
    return nodes.map((node) => {
      const highlightedCols = relationFocus.highlightedColumnsByTable.get(node.id);
      const isDimmed = !relationFocus.activeTableIds.has(node.id);
      return {
        ...node,
        data: {
          ...node.data,
          highlightedColumns: highlightedCols ? Array.from(highlightedCols) : [],
          isDimmed,
        },
      };
    });
  }, [nodes, relationFocus]);

  const renderedEdges = useMemo(() => {
    if (!relationFocus.isFocused && !selectedEdgeId) return edges;
    return edges.map((edge) => {
      const isHighlighted = relationFocus.isFocused && relationFocus.activeEdgeIds.has(edge.id);
      const isDimmed = relationFocus.isFocused && !isHighlighted;
      return {
        ...edge,
        selected: edge.id === selectedEdgeId,
        zIndex: isHighlighted ? 20 : 0,
        data: {
          ...(edge.data as RelationEdgeData),
          isHighlighted,
          isDimmed,
        },
      };
    });
  }, [edges, relationFocus, selectedEdgeId]);

  return (
    <div className={styles.canvasWrapper} role="application" aria-label="ERD diagram canvas">
      {isStale && primaryError && (
        <div className={styles.staleNotice} title={`SDL error on line ${primaryError.line}: ${primaryError.message}`}>
          <span className={styles.pulseDot} aria-hidden="true" />
          <span>Diagram preserved • SDL error on line {primaryError.line}</span>
        </div>
      )}
      <ReactFlow
        nodes={renderedNodes}
        edges={renderedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
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
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-border-strong)" />
        <Controls>
          <ControlButton
            onClick={() => triggerAutoLayout("LR")}
            title="Auto-Arrange Diagram (Left to Right)"
            aria-label="Auto-Arrange Diagram"
          >
            <Sparkles size={14} color="var(--color-brand-400)" aria-hidden="true" />
          </ControlButton>
        </Controls>
        <MiniMap
          zoomable
          pannable
          nodeColor={(node) => (node.selected ? "var(--color-brand-400)" : "var(--color-text-muted)")}
          nodeStrokeColor="var(--color-border-strong)"
          maskColor="color-mix(in srgb, var(--color-surface-base) 70%, transparent)"
        />
      </ReactFlow>
    </div>
  );
});

export const ERDCanvas: React.FC = () => (
  <ReactFlowProvider>
    <ERDCanvasInner />
  </ReactFlowProvider>
);
