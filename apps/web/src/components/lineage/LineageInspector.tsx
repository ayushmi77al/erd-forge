import { ArrowLeft, ArrowRight, Code2, Columns3, Info, Layers, Network, PlusCircle, X } from "lucide-react";
import type React from "react";
import { useCallback } from "react";
import type { LineageNode } from "../../lineage/models/LineageNode";
import { useLineageStore } from "../../stores/lineageStore";
import { useSdlStore } from "../../stores/sdlStore";
import { useUIStore } from "../../stores/uiStore";
import styles from "./LineageInspector.module.css";

export const LineageInspector: React.FC = () => {
  const graph = useLineageStore((s) => s.graph);
  const selectedNodeId = useLineageStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useLineageStore((s) => s.setSelectedNodeId);
  const toggleInspector = useLineageStore((s) => s.toggleInspector);

  const selectedNode: LineageNode | undefined = graph?.nodes.find((n) => n.id === selectedNodeId);

  const handleViewInERD = useCallback(() => {
    if (!selectedNode?.linkedEntityId) return;
    useUIStore.getState().setSelectedTable(selectedNode.linkedEntityId);
    useUIStore.getState().setAppMode("schema");
  }, [selectedNode]);

  const handleAddToERD = useCallback(() => {
    if (!selectedNode) return;
    const { sdlText, setSdlText } = useSdlStore.getState();
    const columns = selectedNode.columns.map((c) => `  ${c.name} ${c.dataType || "varchar"}`).join("\n");
    const newTable = `\nTable ${selectedNode.name} {\n${columns}\n}\n`;
    setSdlText(sdlText + newTable);
    useUIStore.getState().setSelectedTable(selectedNode.name);
    useUIStore.getState().setAppMode("schema");
  }, [selectedNode]);

  // Upstream entities (nodes feeding into this selected node)
  const upstreamNodes =
    graph?.edges
      .filter((e) => e.targetNodeId === selectedNodeId)
      .map((e) => graph.nodes.find((n) => n.id === e.sourceNodeId))
      .filter((n): n is LineageNode => Boolean(n)) || [];

  // Downstream entities (nodes that consume this selected node)
  const downstreamNodes =
    graph?.edges
      .filter((e) => e.sourceNodeId === selectedNodeId)
      .map((e) => graph.nodes.find((n) => n.id === e.targetNodeId))
      .filter((n): n is LineageNode => Boolean(n)) || [];

  return (
    <div className={styles.inspectorContainer}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Info size={15} className={styles.brandIcon} aria-hidden="true" />
          <span>Lineage Inspector</span>
        </div>
        <button
          className={styles.closeBtn}
          onClick={toggleInspector}
          title="Close Inspector"
          type="button"
          aria-label="Close Inspector"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.scrollArea}>
        {selectedNode ? (
          <>
            {/* Selected Node Overview */}
            <div className={styles.nodeCard}>
              <div className={styles.nodeTitleRow}>
                <span className={styles.nodeName}>{selectedNode.name}</span>
                <span className={`${styles.typeBadge} ${styles[selectedNode.type.toLowerCase()] || ""}`}>
                  {selectedNode.type}
                </span>
              </div>
              {selectedNode.alias && selectedNode.alias !== selectedNode.name && (
                <div className={styles.nodeSubtext}>
                  Alias: <strong>{selectedNode.alias}</strong>
                </div>
              )}
              {selectedNode.schema && (
                <div className={styles.nodeSubtext}>
                  Schema: <strong>{selectedNode.schema}</strong>
                </div>
              )}

              {(selectedNode.type === "TABLE" || selectedNode.type === "VIEW") && (
                <div className={styles.erdActions}>
                  {selectedNode.linkedEntityId ? (
                    <button className={styles.actionBtn} onClick={handleViewInERD} type="button">
                      <Network size={14} aria-hidden="true" />
                      <span>View in ERD</span>
                    </button>
                  ) : selectedNode.isPhantom ? (
                    <button className={styles.actionBtn} onClick={handleAddToERD} type="button">
                      <PlusCircle size={14} aria-hidden="true" />
                      <span>Add to ERD</span>
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            {/* Columns List with source mappings */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <Columns3 size={13} aria-hidden="true" />
                <span>Columns ({selectedNode.columns.length})</span>
              </div>
              <div className={styles.columnsList}>
                {selectedNode.columns.map((col) => (
                  <div key={col.id} className={styles.columnRow}>
                    <div className={styles.columnMain}>
                      <span className={styles.columnName}>{col.name}</span>
                      <span className={styles.columnType}>{col.dataType || "any"}</span>
                    </div>
                    {col.sources && col.sources.length > 0 && (
                      <div className={styles.columnSources} title="Derived from source columns">
                        <ArrowLeft size={10} aria-hidden="true" />
                        <span>
                          {col.sources.map((s) => `${s.tableName || s.tableId}.${s.columnName || s.column}`).join(", ")}
                        </span>
                      </div>
                    )}
                    {col.expression && (
                      <div className={`${styles.nodeSubtext} ${styles.monoText}`}>fx: {col.expression}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Upstream Dependencies */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <ArrowLeft size={13} aria-hidden="true" />
                <span>Upstream Sources ({upstreamNodes.length})</span>
              </div>
              {upstreamNodes.length > 0 ? (
                <div className={styles.depList}>
                  {upstreamNodes.map((un) => (
                    <div
                      key={un.id}
                      className={styles.depItem}
                      onClick={() => setSelectedNodeId(un.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedNodeId(un.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select upstream ${un.type.toLowerCase()} ${un.name}`}
                    >
                      <span className={styles.depName}>{un.name}</span>
                      <span className={`${styles.typeBadge} ${styles[un.type.toLowerCase()] || ""}`}>{un.type}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.nodeSubtext}>No upstream dependencies (source root).</div>
              )}
            </div>

            {/* Downstream Dependencies */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <ArrowRight size={13} aria-hidden="true" />
                <span>Downstream Targets ({downstreamNodes.length})</span>
              </div>
              {downstreamNodes.length > 0 ? (
                <div className={styles.depList}>
                  {downstreamNodes.map((dn) => (
                    <div
                      key={dn.id}
                      className={styles.depItem}
                      onClick={() => setSelectedNodeId(dn.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedNodeId(dn.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select downstream ${dn.type.toLowerCase()} ${dn.name}`}
                    >
                      <span className={styles.depName}>{dn.name}</span>
                      <span className={`${styles.typeBadge} ${styles[dn.type.toLowerCase()] || ""}`}>{dn.type}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.nodeSubtext}>No downstream targets (final sink).</div>
              )}
            </div>

            {/* Raw SQL / CTE Definition */}
            {selectedNode.rawSql && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  <Code2 size={13} aria-hidden="true" />
                  <span>SQL Definition</span>
                </div>
                <div className={styles.codeBlock}>{selectedNode.rawSql}</div>
              </div>
            )}
          </>
        ) : (
          /* Empty / Summary state when no node is selected */
          <div className={styles.emptyState}>
            <Layers size={36} className={styles.emptyIcon} aria-hidden="true" />
            <div className={styles.emptyTitle}>Lineage Graph Overview</div>
            <div className={styles.emptyText}>
              Select any table, CTE, or query node on the canvas to inspect its columns, expressions, and dependency
              paths.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
