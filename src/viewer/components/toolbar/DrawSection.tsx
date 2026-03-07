import React from "react";
import { cn } from "../../utils";
import type { DrawingTool } from "../../types";
import { gB, gL, grp, DRAW_TOOLS } from "./toolbar-constants";

export interface DrawSectionProps {
  activeTool: DrawingTool;
  drawingColor: string;
  drawingWidth: number;
  onSetActiveTool: (tool: DrawingTool) => void;
  onSetDrawingColor: (color: string) => void;
  onSetDrawingWidth: (width: number) => void;
}

export function DrawSection(p: DrawSectionProps): React.ReactElement {
  return (
    <>
      <div className={grp}>
        {DRAW_TOOLS.map((t, i, a) => (
          <button
            key={t.id}
            type="button"
            onClick={() => p.onSetActiveTool(t.id)}
            className={cn(
              i < a.length - 1 ? gB : gL,
              p.activeTool === t.id
                ? (t.ac ?? "bg-accent text-foreground")
                : "",
            )}
            title={t.t}
          >
            {t.icon}
          </button>
        ))}
      </div>
      <div className="inline-flex items-center gap-2 text-xs">
        <label
          className="inline-flex items-center gap-1 text-muted-foreground"
          title="Pen colour"
        >
          Colour
          <input
            type="color"
            value={p.drawingColor}
            onChange={(e) => p.onSetDrawingColor(e.target.value)}
            className="w-6 h-6 rounded border border-border bg-transparent cursor-pointer"
          />
        </label>
        <label
          className="inline-flex items-center gap-1 text-muted-foreground"
          title="Stroke width"
        >
          Width
          <input
            type="range"
            min={1}
            max={12}
            value={p.drawingWidth}
            onChange={(e) => p.onSetDrawingWidth(Number(e.target.value))}
            className="w-16 h-1 accent-primary"
          />
          <span className="text-foreground w-4 text-right">
            {p.drawingWidth}
          </span>
        </label>
      </div>
    </>
  );
}
