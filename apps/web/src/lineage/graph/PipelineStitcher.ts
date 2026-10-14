import { LineageGraph } from '../models/LineageGraph';

/**
 * PipelineStitcher connects multi-statement queries into a single unified pipeline graph.
 * If Statement 1 produces or populates a table (e.g. INSERT INTO TargetTable SELECT ...),
 * and Statement 2 reads from TargetTable, a pipeline dependency edge is created.
 */
export class PipelineStitcher {
  static stitch(graph: LineageGraph): LineageGraph {
    if (!graph.statements || graph.statements.length <= 1) {
      return graph;
    }

    const stitchedEdges = [...graph.edges];
    const createdEdgesSet = new Set(stitchedEdges.map((e) => `${e.source}->${e.target}`));

    // Map statement target tables
    const statementOutputs = new Map<string, string>(); // tableName (lowercase) -> nodeId

    graph.nodes.forEach((node) => {
      if (node.type === 'FINAL_SELECT' || node.type === 'TABLE') {
        statementOutputs.set(node.name.toLowerCase(), node.id);
      }
    });

    // Detect cross-statement dependencies
    graph.nodes.forEach((consumerNode) => {
      if (consumerNode.statementIndex && consumerNode.statementIndex > 1) {
        consumerNode.columns.forEach((col) => {
          col.sources.forEach((src) => {
            const producerNodeId = statementOutputs.get(src.tableId.toLowerCase());
            if (producerNodeId && producerNodeId !== consumerNode.id) {
              const edgeKey = `${producerNodeId}->${consumerNode.id}`;
              if (!createdEdgesSet.has(edgeKey)) {
                createdEdgesSet.add(edgeKey);
                stitchedEdges.push({
                  id: `pipeline_${producerNodeId}_to_${consumerNode.id}`,
                  source: producerNodeId,
                  target: consumerNode.id,
                  sourceNodeId: producerNodeId,
                  targetNodeId: consumerNode.id,
                  type: 'table',
                  label: 'PIPELINE_FLOW',
                  isTransform: true,
                });
              }
            }
          });
        });
      }
    });

    return {
      ...graph,
      edges: stitchedEdges,
    };
  }
}
