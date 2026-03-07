import React, { useState } from "react";

import { LuChevronDown } from "react-icons/lu";

import type { PptxSlide } from "../../../core";
import { cn } from "../../utils";
import type { SlideSectionGroup } from "../../types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SectionBlockProps {
  section: SlideSectionGroup;
  slides: PptxSlide[];
  gridCols: number;
  zoomScale: number;
  renderSlideCard: (
    slide: PptxSlide,
    index: number,
  ) => React.ReactElement | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SectionBlock({
  section,
  slides,
  gridCols,
  zoomScale: _zoomScale,
  renderSlideCard,
}: SectionBlockProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState(section.defaultCollapsed ?? false);

  return (
    <div className="mb-4">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground hover:bg-muted/60 hover:text-foreground mb-2"
        onClick={() => setCollapsed((p) => !p)}
      >
        {/* Section color indicator from p15:sectionPr */}
        {section.color && (
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: section.color }}
          />
        )}
        <LuChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            collapsed ? "-rotate-90" : "rotate-0",
          )}
        />
        <span className="truncate text-left">{section.label}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {section.slideIndexes.length}
        </span>
      </button>

      {!collapsed && (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          }}
        >
          {section.slideIndexes.map((idx) => {
            const slide = slides[idx];
            if (!slide) return null;
            return renderSlideCard(slide, idx);
          })}
        </div>
      )}
    </div>
  );
}
