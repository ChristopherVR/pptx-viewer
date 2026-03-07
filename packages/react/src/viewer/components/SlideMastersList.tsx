import React, { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

import type {
  PptxSlide,
  PptxSlideMaster,
  PptxSlideLayout,
} from "pptx-viewer-core";
import { cn } from "../utils";
import type { CanvasSize } from "../types";
import { SlideThumbnail } from "./SlideThumbnail";

// ---------------------------------------------------------------------------
// Helpers: build pseudo PptxSlide for thumbnail rendering
// ---------------------------------------------------------------------------

function masterToSlide(master: PptxSlideMaster): PptxSlide {
  return {
    id: master.path,
    rId: "",
    slideNumber: 0,
    elements: master.elements ?? [],
    backgroundColor: master.backgroundColor,
    backgroundImage: master.backgroundImage,
  };
}

function layoutToSlide(layout: PptxSlideLayout): PptxSlide {
  return {
    id: layout.path,
    rId: "",
    slideNumber: 0,
    elements: layout.elements ?? [],
    backgroundColor: layout.backgroundColor,
    backgroundImage: layout.backgroundImage,
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SlideMastersListProps {
  slideMasters: PptxSlideMaster[];
  activeMasterIndex: number;
  activeLayoutIndex: number | null;
  canvasSize: CanvasSize;
  onSelectMaster: (index: number) => void;
  onSelectLayout: (masterIndex: number, layoutIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlideMastersList({
  slideMasters,
  activeMasterIndex,
  activeLayoutIndex,
  canvasSize,
  onSelectMaster,
  onSelectLayout,
}: SlideMastersListProps): React.ReactElement {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeMasterIndex, activeLayoutIndex]);

  const { t } = useTranslation();

  return (
    <>
      {slideMasters.map((master, masterIdx) => {
        const isMasterActive =
          masterIdx === activeMasterIndex && activeLayoutIndex === null;
        const layouts = master.layouts ?? [];

        return (
          <div key={master.path} className="space-y-1">
            <div
              ref={isMasterActive ? activeRef : undefined}
              className={cn(
                "group relative cursor-pointer rounded-lg border-2 p-1 transition-all",
                isMasterActive
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-border bg-background/40 hover:border-border",
              )}
              onClick={() => onSelectMaster(masterIdx)}
            >
              <div className="relative overflow-hidden rounded bg-white">
                <SlideThumbnail
                  slide={masterToSlide(master)}
                  templateElements={[]}
                  canvasSize={canvasSize}
                />
              </div>
              <div className="mt-1 px-1">
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    isMasterActive ? "text-amber-400" : "text-muted-foreground",
                  )}
                >
                  {master.name || t("pptx.master.master")}
                </span>
              </div>
            </div>

            {layouts.length > 0 && (
              <div className="ml-3 space-y-1 border-l border-border/40 pl-2">
                {layouts.map((layout, layoutIdx) => {
                  const isLayoutActive =
                    masterIdx === activeMasterIndex &&
                    layoutIdx === activeLayoutIndex;

                  return (
                    <div
                      key={layout.path}
                      ref={isLayoutActive ? activeRef : undefined}
                      className={cn(
                        "group relative cursor-pointer rounded-md border-2 p-0.5 transition-all",
                        isLayoutActive
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background/40 hover:border-border",
                      )}
                      onClick={() => onSelectLayout(masterIdx, layoutIdx)}
                    >
                      <div className="relative overflow-hidden rounded bg-white">
                        <SlideThumbnail
                          slide={layoutToSlide(layout)}
                          templateElements={master.elements ?? []}
                          canvasSize={canvasSize}
                        />
                      </div>
                      <div className="mt-0.5 px-0.5">
                        <span
                          className={cn(
                            "text-[9px]",
                            isLayoutActive
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          {layout.name || t("pptx.master.layout")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {slideMasters.length === 0 && (
        <div className="px-2 py-4 text-center text-xs text-muted-foreground">
          {t("pptx.master.noMasters")}
        </div>
      )}
    </>
  );
}
