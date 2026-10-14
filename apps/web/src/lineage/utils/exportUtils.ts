import { toPng, toSvg } from 'html-to-image';
import { LineageGraph } from '../models/LineageGraph';

export const downloadImage = async (element: HTMLElement, format: 'png' | 'svg', filename: string) => {
  try {
    const filter = (node: HTMLElement) => {
      // Filter out React Flow minimap, controls, and other UI overlays
      const excludeClasses = ['react-flow__minimap', 'react-flow__controls', 'react-flow__panel'];
      if (node.classList) {
        return !excludeClasses.some(c => node.classList.contains(c));
      }
      return true;
    };

    const dataUrl = format === 'png' 
      ? await toPng(element, { filter, backgroundColor: '#0f111a' }) 
      : await toSvg(element, { filter, backgroundColor: '#0f111a' });

    const link = document.createElement('a');
    link.download = `${filename}.${format}`;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Failed to export image', err);
    throw err;
  }
};

export const exportLineageToCsv = (graph: LineageGraph | null, filename: string) => {
  if (!graph) return;

  // We want to export column-level lineage
  const csvRows = [
    ['Target Table', 'Target Column', 'Source Table', 'Source Column', 'Transformation', 'Lineage Type']
  ];

  graph.edges.forEach(edge => {
    if (edge.type === 'table' && edge.columnLineage && edge.columnLineage.length > 0) {
      edge.columnLineage.forEach(colMapping => {
        const targetNode = graph.nodes.find(n => n.id === edge.targetNodeId);
        const sourceNode = graph.nodes.find(n => n.id === edge.sourceNodeId);
        
        csvRows.push([
          targetNode?.name || edge.targetNodeId || '',
          colMapping.targetColumnName || '',
          sourceNode?.name || edge.sourceNodeId || '',
          colMapping.sourceColumnName || '',
          colMapping.transformation || '',
          colMapping.isDirect ? 'Direct' : `Indirect (${colMapping.context || 'unknown'})`
        ]);
      });
    }
  });

  const csvContent = csvRows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
