import React from "react";

/**
 * Diagonal border data for a table cell.
 * "DiagDown" = top-left to bottom-right (a:lnTlToBr).
 * "DiagUp" = bottom-left to top-right (a:lnBlToTr).
 */
export interface DiagonalBorderInfo {
  diagDownColor?: string;
  diagDownWidth?: number;
  diagUpColor?: string;
  diagUpWidth?: number;
}

/**
 * Renders SVG diagonal border lines inside a table cell.
 * The parent `<td>` must have `position: relative` for this overlay
 * to be positioned correctly.
 */
export function TableCellDiagonalBorders({
  diag,
}: {
  diag: DiagonalBorderInfo;
}): React.ReactElement | null {
  const hasDown = Boolean(diag.diagDownColor && diag.diagDownWidth);
  const hasUp = Boolean(diag.diagUpColor && diag.diagUpWidth);
  if (!hasDown && !hasUp) return null;

  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {hasDown && (
        <line
          x1="0"
          y1="0"
          x2="100%"
          y2="100%"
          stroke={diag.diagDownColor}
          strokeWidth={diag.diagDownWidth}
        />
      )}
      {hasUp && (
        <line
          x1="0"
          y1="100%"
          x2="100%"
          y2="0"
          stroke={diag.diagUpColor}
          strokeWidth={diag.diagUpWidth}
        />
      )}
    </svg>
  );
}
