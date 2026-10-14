import React, { useState, useCallback, useRef } from 'react';
import styles from './ResizablePanel.module.css';

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  position: 'left' | 'right';
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({ children, defaultWidth, minWidth, maxWidth, position }) => {
  const [width, setWidth] = useState(defaultWidth);
  const isResizing = useRef(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      
      let newWidth;
      if (position === 'left') {
        newWidth = moveEvent.clientX;
      } else {
        newWidth = window.innerWidth - moveEvent.clientX;
      }
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      }
    };
    
    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [minWidth, maxWidth, position]);

  return (
    <div className={styles.resizablePanel} style={{ width }}>
      {position === 'right' && (
        <div className={styles.resizerLeft} onMouseDown={startResizing} />
      )}
      <div className={styles.content}>
        {children}
      </div>
      {position === 'left' && (
        <div className={styles.resizerRight} onMouseDown={startResizing} />
      )}
    </div>
  );
};
