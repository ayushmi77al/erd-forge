import type React from "react";
import { useCallback, useRef, useState } from "react";
import styles from "./ResizablePanel.module.css";

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  position: "left" | "right";
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  defaultWidth,
  minWidth,
  maxWidth,
  position,
}) => {
  const [width, setWidth] = useState(defaultWidth);
  const isResizing = useRef(false);

  const startResizing = useCallback(
    (_e: React.MouseEvent) => {
      isResizing.current = true;
      document.body.style.cursor = "col-resize";

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return;

        let newWidth: number;
        if (position === "left") {
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
        document.body.style.cursor = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [minWidth, maxWidth, position],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = 16;
      let delta = 0;
      if (e.key === "ArrowLeft") {
        delta = position === "left" ? -step : step;
      } else if (e.key === "ArrowRight") {
        delta = position === "left" ? step : -step;
      } else {
        return;
      }
      e.preventDefault();
      setWidth((prev) => Math.min(maxWidth, Math.max(minWidth, prev + delta)));
    },
    [minWidth, maxWidth, position],
  );

  const resizerProps = {
    role: "separator" as const,
    "aria-orientation": "vertical" as const,
    "aria-label": `Resize ${position} panel`,
    "aria-valuenow": width,
    "aria-valuemin": minWidth,
    "aria-valuemax": maxWidth,
    tabIndex: 0,
    onMouseDown: startResizing,
    onKeyDown: handleKeyDown,
  };

  return (
    <div className={styles.resizablePanel} style={{ width }}>
      {position === "right" && <div className={styles.resizerLeft} {...resizerProps} />}
      <div className={styles.content}>{children}</div>
      {position === "left" && <div className={styles.resizerRight} {...resizerProps} />}
    </div>
  );
};
