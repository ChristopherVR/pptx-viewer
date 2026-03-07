import React from "react";
import { useTranslation } from "react-i18next";

import { LuMinus, LuPlus } from "react-icons/lu";

import type { PptxSlide } from "../../core";
import type { SlideSorterOverlayProps } from "./slide-sorter/types";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from "./slide-sorter/types";
import { useSlideSorterState } from "./slide-sorter/useSlideSorterState";
import { SlideCard } from "./slide-sorter/SlideCard";
import { SectionBlock } from "./slide-sorter/SectionBlock";
import { SorterContextMenu } from "./slide-sorter/SorterContextMenu";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlideSorterOverlay({
  slides,
  activeSlideIndex,
  canvasSize,
  canEdit,
  sectionGroups,
  onSelectSlide,
  onMoveSlide,
  onDeleteSlides,
  onDuplicateSlides,
  onToggleHideSlides,
  onClose,
}: SlideSorterOverlayProps): React.ReactElement {
  const { t } = useTranslation();

  const state = useSlideSorterState({
    slides,
    activeSlideIndex,
    canEdit,
    sectionGroups,
    onSelectSlide,
    onMoveSlide,
    onDeleteSlides,
    onDuplicateSlides,
    onToggleHideSlides,
    onClose,
  });

  // -----------------------------------------------------------------------
  // Render a single slide card
  // -----------------------------------------------------------------------

  const renderSlideCard = (slide: PptxSlide, index: number) => (
    <SlideCard
      key={slide.id || index}
      slide={slide}
      index={index}
      isActive={index === activeSlideIndex}
      isDragTarget={state.dragOverIndex === index}
      isSelected={state.isSelected(slide.id)}
      selectedCount={state.selectedSlideIds.length}
      selectionOrder={state.selectedIndexes.indexOf(index) + 1}
      canvasSize={canvasSize}
      canEdit={canEdit}
      onSlideClick={state.handleSlideClick}
      onDoubleClick={state.handleDoubleClick}
      onContextMenu={state.handleContextMenu}
      onDragStart={state.handleDragStart}
      onDragOver={state.handleDragOver}
      onDragLeave={state.handleDragLeave}
      onDrop={state.handleDrop}
    />
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div
      ref={state.backdropRef}
      className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm"
      onClick={state.handleBackdropClick}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-foreground">
            {t("pptx.slideSorter.title")}
          </h2>
          {state.selectedSlideIds.length > 1 && (
            <span className="text-xs text-muted-foreground">
              {t("pptx.slideSorter.selectedCount", {
                count: state.selectedSlideIds.length,
              })}
            </span>
          )}
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground hover:bg-accent hover:text-white transition-colors"
          aria-label={t("pptx.slideSorter.close")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Grid container */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div
          className="mx-auto"
          style={{
            maxWidth: `${Math.max(600, state.gridCols * 220 * state.zoomScale)}px`,
          }}
        >
          {state.showSectionHeaders ? (
            sectionGroups.map((section) => (
              <SectionBlock
                key={section.id}
                section={section}
                slides={slides}
                gridCols={state.gridCols}
                zoomScale={state.zoomScale}
                renderSlideCard={renderSlideCard}
              />
            ))
          ) : (
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${state.gridCols}, minmax(0, 1fr))`,
              }}
            >
              {slides.map((slide, index) => renderSlideCard(slide, index))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom toolbar with zoom */}
      <div className="flex items-center justify-between px-6 py-2.5 border-t border-border/50 bg-background/50">
        <div className="text-xs text-muted-foreground">
          {t("pptx.slideSorter.slideCount", { count: slides.length })}
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            disabled={state.zoom <= MIN_ZOOM}
            onClick={() =>
              state.setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))
            }
            aria-label={t("pptx.slideSorter.zoomOut")}
          >
            <LuMinus className="h-3.5 w-3.5" />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            value={state.zoom}
            onChange={(e) => state.setZoom(Number(e.target.value))}
            className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-accent accent-primary"
            aria-label={t("pptx.slideSorter.zoom")}
          />
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            disabled={state.zoom >= MAX_ZOOM}
            onClick={() =>
              state.setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
            }
            aria-label={t("pptx.slideSorter.zoomIn")}
          >
            <LuPlus className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3ch] text-right text-xs text-muted-foreground">
            {state.zoom}%
          </span>
        </div>
      </div>

      {/* Context menu */}
      {state.contextMenu && canEdit && (
        <SorterContextMenu
          x={state.contextMenu.x}
          y={state.contextMenu.y}
          selectedCount={state.selectedSlideIds.length}
          hasClipboard={state.clipboardSlideIds.length > 0}
          hasHiddenInSelection={state.hasHiddenInSelection}
          hasVisibleInSelection={state.hasVisibleInSelection}
          sectionGroups={state.showSectionHeaders ? sectionGroups : []}
          onDelete={state.handleDeleteSelected}
          onDuplicate={state.handleDuplicateSelected}
          onCopy={state.handleCopySelected}
          onPaste={state.handlePaste}
          onToggleHide={state.handleToggleHideSelected}
          onClose={state.closeContextMenu}
        />
      )}
    </div>
  );
}
