import React from 'react';
import { 
  Play, 
  ChevronDown, 
  Layers, 
  Columns3, 
  PanelLeftClose, 
  PanelLeftOpen, 
  PanelRightClose, 
  PanelRightOpen, 
  Maximize2,
  Minimize2,
  Download,
  Image as ImageIcon,
  FileText
} from 'lucide-react';
import { useLineageStore } from '../../stores/lineageStore';
import { exportLineageToCsv, downloadImage } from '../../lineage/utils/exportUtils';
import { SquishyToggle } from './SquishyToggle';
import styles from './LineageToolbar.module.css';

interface LineageToolbarProps {
  onAnalyze?: () => void;
}

export const LineageToolbar: React.FC<LineageToolbarProps> = ({ onAnalyze }) => {
  const sql = useLineageStore((s) => s.sql);
  const viewMode = useLineageStore((s) => s.viewMode);
  const setViewMode = useLineageStore((s) => s.setViewMode);
  const layoutDirection = useLineageStore((s) => s.layoutDirection);
  const setLayoutDirection = useLineageStore((s) => s.setLayoutDirection);
  const cardDisplayMode = useLineageStore((s) => s.cardDisplayMode);
  const setCardDisplayMode = useLineageStore((s) => s.setCardDisplayMode);
  const triggerAutoLayout = useLineageStore((s) => s.triggerAutoLayout);

  const isSQLEditorOpen = useLineageStore((s) => s.isSQLEditorOpen);
  const toggleSQLEditor = useLineageStore((s) => s.toggleSQLEditor);
  const isInspectorOpen = useLineageStore((s) => s.isInspectorOpen);
  const toggleInspector = useLineageStore((s) => s.toggleInspector);

  const isParsing = useLineageStore((s) => s.isParsing);
  const graph = useLineageStore((s) => s.graph);
  
  const [isExportMenuOpen, setIsExportMenuOpen] = React.useState(false);

  const handleExportPng = () => {
    const el = document.querySelector('.react-flow') as HTMLElement;
    if (el) downloadImage(el, 'png', 'sql-lineage');
    setIsExportMenuOpen(false);
  };

  const handleExportSvg = () => {
    const el = document.querySelector('.react-flow') as HTMLElement;
    if (el) downloadImage(el, 'svg', 'sql-lineage');
    setIsExportMenuOpen(false);
  };

  const handleExportCsv = () => {
    exportLineageToCsv(graph, 'sql-lineage-columns');
    setIsExportMenuOpen(false);
  };

  return (
    <div className={styles.toolbar}>
      {/* Left controls: Panel toggles, Dialect & Samples */}
      <div className={styles.leftGroup}>
        {!isSQLEditorOpen && (
          <button
            className={styles.catalogBtn}
            onClick={toggleSQLEditor}
            title="Open SQL Editor"
            type="button"
            aria-label="Open SQL Editor"
          >
            <PanelLeftOpen size={16} />
            <span>Editor</span>
          </button>
        )}
        {isSQLEditorOpen && (
          <button
            className={`${styles.iconBtn} ${styles.active}`}
            onClick={toggleSQLEditor}
            title="Hide SQL Editor Panel"
            type="button"
            aria-label="Toggle SQL Editor"
          >
            <PanelLeftClose size={16} />
          </button>
        )}

        <button
          className={styles.analyzeBtn}
          onClick={onAnalyze}
          disabled={isParsing}
          title="Parse SQL and update visual lineage (Ctrl + Enter)"
          type="button"
        >
          <Play size={14} fill="currentColor" />
          <span>Analyze Lineage</span>
        </button>

        <div className={styles.divider} />

        {/* Table vs Column lineage level */}
        <SquishyToggle
          value={viewMode}
          onChange={setViewMode}
          ariaLabel="Lineage view level"
          options={[
            {
              value: 'table',
              label: 'Entity',
              icon: <Layers size={14} />,
              title: 'Entity Level Lineage (Tables, CTEs, Subqueries)',
            },
            {
              value: 'column',
              label: 'Column',
              icon: <Columns3 size={14} />,
              title: 'Column Level Lineage',
            },
          ]}
        />

        {/* Compact vs Full Card toggle */}
        <SquishyToggle
          value={cardDisplayMode}
          onChange={setCardDisplayMode}
          ariaLabel="Card display mode"
          options={[
            {
              value: 'full',
              label: 'Full',
              icon: <Maximize2 size={13} />,
              title: 'Show full columns and details in nodes',
            },
            {
              value: 'compact',
              label: 'Compact',
              icon: <Minimize2 size={13} />,
              title: 'Show compact nodes',
            },
          ]}
        />
      </div>



      {/* Right controls: Export and Inspector toggle */}
      <div className={styles.rightGroup}>
        <div style={{ position: 'relative' }}>
          <button 
            className={styles.headerBtn} 
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            title="Export Lineage Graph"
          >
            <Download size={13} />
            <span>Export</span>
            <ChevronDown size={11} />
          </button>
          
          {isExportMenuOpen && (
            <div className={styles.dropdownMenu} style={{ right: 0 }}>
              <button className={styles.dropdownItem} onClick={handleExportPng}>
                <ImageIcon size={13} />
                <span>Export as PNG</span>
              </button>
              <button className={styles.dropdownItem} onClick={handleExportSvg}>
                <ImageIcon size={13} />
                <span>Export as SVG</span>
              </button>
              <button className={styles.dropdownItem} onClick={handleExportCsv}>
                <FileText size={13} />
                <span>Export to CSV</span>
              </button>
            </div>
          )}
        </div>

        {!isInspectorOpen && (
          <button
            className={styles.catalogBtn}
            onClick={toggleInspector}
            title="Show Lineage Inspector"
            type="button"
            aria-label="Toggle Lineage Inspector"
          >
            <PanelRightOpen size={16} />
            <span>Inspector</span>
          </button>
        )}
        {isInspectorOpen && (
          <button
            className={`${styles.iconBtn} ${styles.active}`}
            onClick={toggleInspector}
            title="Hide Lineage Inspector"
            type="button"
            aria-label="Toggle Lineage Inspector"
          >
            <PanelRightClose size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
