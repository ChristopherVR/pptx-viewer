import React, { useRef } from "react";
import { LuX } from "react-icons/lu";

import { cn } from "../../utils";
import type { PptxSlide, PptxSlideMaster } from "pptx-viewer-core";
import { normalizeHexColor } from "../../utils";
import { CARD, HEADING, BTN } from "./inspector-pane-constants";
import { DebouncedColorInput } from "./DebouncedColorInput";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SlideBackgroundPanelProps {
  activeSlide: PptxSlide;
  canEdit: boolean;
  onUpdateSlide: (patch: Partial<PptxSlide>) => void;

  /** Template-mode fields (only needed for master/layout editing) */
  editTemplateMode?: boolean;
  slideMasters?: PptxSlideMaster[];
  onSetTemplateBackground?: (path: string, color: string) => void;
  onGetTemplateBackgroundColor?: (path: string) => string | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlideBackgroundPanel({
  activeSlide,
  canEdit,
  onUpdateSlide,
  editTemplateMode,
  slideMasters,
  onSetTemplateBackground,
  onGetTemplateBackgroundColor,
}: SlideBackgroundPanelProps): React.ReactElement {
  const bgImageInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Slide Background */}
      <div className={cn(CARD, "space-y-2")}>
        <div className={HEADING}>Background</div>

        {/* Solid colour */}
        <label className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground w-10 shrink-0">Colour</span>
          <DebouncedColorInput
            value={normalizeHexColor(activeSlide.backgroundColor, "#ffffff")}
            disabled={!canEdit}
            className="h-6 w-8 rounded border border-border bg-muted cursor-pointer"
            onCommit={(hex) => onUpdateSlide({ backgroundColor: hex })}
          />
          <span className="text-muted-foreground text-[10px] truncate">
            {activeSlide.backgroundColor || "none"}
          </span>
        </label>

        {/* Background image */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-10 shrink-0">Image</span>
            <input
              ref={bgImageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              className="hidden"
              disabled={!canEdit}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === "string") {
                    onUpdateSlide({ backgroundImage: reader.result });
                  }
                };
                reader.readAsDataURL(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className={cn(BTN, "flex-1 text-center")}
              disabled={!canEdit}
              onClick={() => bgImageInputRef.current?.click()}
            >
              {activeSlide.backgroundImage ? "Replace Image" : "Choose Image"}
            </button>
          </div>
          {activeSlide.backgroundImage && (
            <div className="relative mt-1">
              <img
                src={activeSlide.backgroundImage}
                alt="Background preview"
                className="w-full h-16 object-cover rounded border border-border"
              />
              <button
                type="button"
                className="absolute top-0.5 right-0.5 rounded bg-background/80 hover:bg-red-700 p-0.5 text-[10px] transition-colors"
                disabled={!canEdit}
                title="Remove background image"
                onClick={() => onUpdateSlide({ backgroundImage: undefined })}
              >
                <LuX className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Clear background */}
        {(activeSlide.backgroundColor ||
          activeSlide.backgroundImage ||
          activeSlide.backgroundGradient) && (
          <button
            type="button"
            className={cn(
              BTN,
              "w-full text-center text-red-400 hover:text-red-300",
            )}
            disabled={!canEdit}
            onClick={() =>
              onUpdateSlide({
                backgroundColor: undefined,
                backgroundImage: undefined,
                backgroundGradient: undefined,
              })
            }
          >
            Clear Background
          </button>
        )}
      </div>

      {/* Master / Layout Background (template mode) */}
      {editTemplateMode &&
        onSetTemplateBackground &&
        onGetTemplateBackgroundColor && (
          <TemplateBackgroundCard
            activeSlide={activeSlide}
            slideMasters={slideMasters}
            canEdit={canEdit}
            onSetTemplateBackground={onSetTemplateBackground}
            onGetTemplateBackgroundColor={onGetTemplateBackgroundColor}
          />
        )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Template Background Card
// ---------------------------------------------------------------------------

function TemplateBackgroundCard({
  activeSlide,
  slideMasters,
  canEdit,
  onSetTemplateBackground,
  onGetTemplateBackgroundColor,
}: {
  activeSlide: PptxSlide;
  slideMasters: PptxSlideMaster[] | undefined;
  canEdit: boolean;
  onSetTemplateBackground: (path: string, color: string) => void;
  onGetTemplateBackgroundColor: (path: string) => string | undefined;
}): React.ReactElement {
  return (
    <div className={cn(CARD, "space-y-2")}>
      <div className={HEADING}>Template Backgrounds</div>

      {/* Layout background */}
      {activeSlide.layoutPath && (
        <label className="flex items-center gap-2 text-[11px]">
          <span
            className="text-muted-foreground w-14 shrink-0 truncate"
            title={activeSlide.layoutName ?? activeSlide.layoutPath}
          >
            Layout
          </span>
          <DebouncedColorInput
            value={normalizeHexColor(
              onGetTemplateBackgroundColor(activeSlide.layoutPath),
              "#ffffff",
            )}
            disabled={!canEdit}
            className="h-6 w-8 rounded border border-border bg-muted cursor-pointer"
            onCommit={(hex) =>
              onSetTemplateBackground(activeSlide.layoutPath!, hex)
            }
          />
          <span className="text-muted-foreground text-[10px] truncate">
            {activeSlide.layoutName ?? "Layout"}
          </span>
        </label>
      )}

      {/* Master background */}
      {(() => {
        const master = slideMasters?.find((m) =>
          m.layoutPaths?.includes(activeSlide.layoutPath ?? ""),
        );
        if (!master) return null;
        return (
          <label className="flex items-center gap-2 text-[11px]">
            <span
              className="text-muted-foreground w-14 shrink-0 truncate"
              title={master.name ?? master.path}
            >
              Master
            </span>
            <DebouncedColorInput
              value={normalizeHexColor(
                onGetTemplateBackgroundColor(master.path),
                "#ffffff",
              )}
              disabled={!canEdit}
              className="h-6 w-8 rounded border border-border bg-muted cursor-pointer"
              onCommit={(hex) => onSetTemplateBackground(master.path, hex)}
            />
            <span className="text-muted-foreground text-[10px] truncate">
              {master.name ?? "Master"}
            </span>
          </label>
        );
      })()}
    </div>
  );
}
