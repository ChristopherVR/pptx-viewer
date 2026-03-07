import React from "react";

import type { ShapeStyle } from "../../../core";
import { SHAPE_QUICK_STYLES } from "../../constants";
import { LBL } from "./FillStrokeHelpers";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QuickStylesGalleryProps {
  onUpdateShapeStyle: (updates: Partial<ShapeStyle>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuickStylesGallery({
  onUpdateShapeStyle,
}: QuickStylesGalleryProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <span className={LBL}>Quick Styles</span>
      <div className="grid grid-cols-6 gap-1">
        {SHAPE_QUICK_STYLES.map((qs, idx) => (
          <button
            key={idx}
            type="button"
            title={qs.name}
            className="h-7 w-full rounded border border-border hover:border-primary transition-colors"
            style={{
              background:
                qs.style.fillGradient || qs.style.fillColor || "transparent",
              boxShadow: qs.style.shadowColor
                ? `${qs.style.shadowOffsetX ?? 2}px ${qs.style.shadowOffsetY ?? 2}px ${qs.style.shadowBlur ?? 4}px ${qs.style.shadowColor}`
                : undefined,
              border: qs.style.strokeColor
                ? `${qs.style.strokeWidth ?? 1}px solid ${qs.style.strokeColor}`
                : undefined,
            }}
            onClick={() => onUpdateShapeStyle(qs.style)}
          />
        ))}
      </div>
    </div>
  );
}
