import React, {
  useRef,
  useEffect,
  useMemo,
  useLayoutEffect,
  useState,
  useCallback,
} from "react";

/**
 * Overlay that renders draggable column and row resize handles on top of a table.
 */
export function TableResizeOverlay({
  children,
  columnWidths,
  editable,
  onResizeColumns,
  onResizeRow,
}: {
  children: React.ReactNode;
  /** Column widths as proportions summing to ~1 */
  columnWidths: number[];
  editable: boolean;
  onResizeColumns?: (newWidths: number[]) => void;
  onResizeRow?: (rowIndex: number, newHeight: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rowBounds, setRowBounds] = useState<number[]>([]);

  // Drag state stored in a ref to avoid re-renders mid-drag
  const dragRef = useRef<{
    type: "col" | "row";
    index: number;
    startPos: number;
    handleEl: HTMLDivElement;
    initialWidths?: number[];
    initialRowHeight?: number;
  } | null>(null);

  // Column boundary positions (cumulative percentages)
  const colBoundaries = useMemo(() => {
    const result: number[] = [];
    let cum = 0;
    for (let i = 0; i < columnWidths.length - 1; i++) {
      cum += columnWidths[i];
      result.push(cum * 100);
    }
    return result;
  }, [columnWidths]);

  // Measure row boundaries after layout
  const measureRows = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const table = container.querySelector("table");
    if (!table) return;
    const trs = table.querySelectorAll("tbody > tr");
    const bounds: number[] = [];
    let cumHeight = 0;
    trs.forEach((tr, i) => {
      cumHeight += (tr as HTMLElement).offsetHeight;
      if (i < trs.length - 1) {
        bounds.push(cumHeight);
      }
    });
    // Only update state when bounds actually change to avoid infinite re-render loop
    setRowBounds((prev) => {
      if (
        prev.length === bounds.length &&
        prev.every((v, i) => v === bounds[i])
      ) {
        return prev;
      }
      return bounds;
    });
  }, []);

  // Re-measure whenever content changes
  useLayoutEffect(() => {
    measureRows();
  });

  // Global mouse handlers for drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();
      const delta =
        drag.type === "col"
          ? e.clientX - drag.startPos
          : e.clientY - drag.startPos;
      drag.handleEl.style.transform =
        drag.type === "col"
          ? `translateX(${delta}px)`
          : `translateY(${delta}px)`;
    };

    const handleMouseUp = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();

      if (drag.type === "col" && drag.initialWidths && onResizeColumns) {
        const deltaX = e.clientX - drag.startPos;
        const deltaProp = deltaX / rect.width;
        const idx = drag.index;
        const newWidths = [...drag.initialWidths];
        newWidths[idx] = Math.max(0.03, drag.initialWidths[idx] + deltaProp);
        newWidths[idx + 1] = Math.max(
          0.03,
          drag.initialWidths[idx + 1] - deltaProp,
        );
        // Normalise so they sum to 1
        const sum = newWidths.reduce((a, b) => a + b, 0);
        const normed = newWidths.map((w) => w / sum);
        onResizeColumns(normed);
      } else if (drag.type === "row" && onResizeRow) {
        const deltaY = e.clientY - drag.startPos;
        const newHeight = Math.max(16, (drag.initialRowHeight ?? 32) + deltaY);
        onResizeRow(drag.index, Math.round(newHeight));
      }

      drag.handleEl.style.transform = "";
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      dragRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onResizeColumns, onResizeRow]);

  if (!editable) {
    return <>{children}</>;
  }

  const startColDrag = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    dragRef.current = {
      type: "col",
      index,
      startPos: e.clientX,
      handleEl: e.currentTarget,
      initialWidths: [...columnWidths],
    };
  };

  const startRowDrag = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const table = containerRef.current?.querySelector("table");
    const tr = table?.querySelectorAll("tbody > tr")[index];
    const actualHeight = (tr as HTMLElement)?.offsetHeight ?? 32;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    dragRef.current = {
      type: "row",
      index,
      startPos: e.clientY,
      handleEl: e.currentTarget,
      initialRowHeight: actualHeight,
    };
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {children}

      {/* Column resize handles */}
      {colBoundaries.map((leftPct, i) => (
        <div
          key={`col-h-${i}`}
          className="absolute top-0 bottom-0 w-[6px] cursor-col-resize z-10 pointer-events-auto group"
          style={{ left: `calc(${leftPct}% - 3px)` }}
          onMouseDown={(e) => startColDrag(e, i)}
        >
          <div className="w-px h-full mx-auto bg-transparent group-hover:bg-blue-400/60 transition-colors" />
        </div>
      ))}

      {/* Row resize handles */}
      {rowBounds.map((topPx, i) => (
        <div
          key={`row-h-${i}`}
          className="absolute left-0 right-0 h-[6px] cursor-row-resize z-10 pointer-events-auto group"
          style={{ top: `${topPx - 3}px` }}
          onMouseDown={(e) => startRowDrag(e, i)}
        >
          <div className="h-px w-full my-auto bg-transparent group-hover:bg-blue-400/60 transition-colors" />
        </div>
      ))}
    </div>
  );
}
