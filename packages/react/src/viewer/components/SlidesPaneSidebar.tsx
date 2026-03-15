import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { LuPanelLeftClose, LuPlus } from "react-icons/lu";

import { SectionContextMenu } from "./slides-pane/SectionContextMenu";
import { SectionHeader } from "./slides-pane/SectionHeader";
import { SlideContextMenu } from "./slides-pane/SlideContextMenu";
import { SlideItem } from "./slides-pane/SlideItem";
import type { SlidesPaneSidebarProps } from "./slides-pane/types";
import { useSlidePaneCallbacks } from "./slides-pane/useSlidePaneCallbacks";

export type { SlidesPaneSidebarProps } from "./slides-pane/types";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlidesPaneSidebar({
  slides,
  activeSlideIndex,
  canvasSize,
  sectionGroups,
  isOpen,
  canEdit,
  onSelectSlide,
  onSlideContextMenu,
  onMoveSlide,
  onAddSlide,
  onCollapse,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onMoveSectionUp,
  onMoveSectionDown,
  rehearsalTimings,
}: SlidesPaneSidebarProps): React.ReactElement | null {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const renameInputRef = useRef<HTMLInputElement>(null);

  const {
    collapsedSections,
    renamingSectionId,
    renameValue,
    sectionContextMenu,
    slideCtxMenu,
    setRenameValue,
    handleDragStart,
    handleDragOver,
    handleDrop,
    toggleSection,
    startRename,
    commitRename,
    cancelRename,
    handleSectionContextMenu,
    handleOpenSlideCtxMenu,
    closeSectionContextMenu,
    closeSlideCtxMenu,
  } = useSlidePaneCallbacks(onMoveSlide, onRenameSection);

  // ── Auto-scroll active slide into view ──
  useEffect(() => {
    const el = slideRefs.current.get(activeSlideIndex);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeSlideIndex]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingSectionId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingSectionId]);

  if (!isOpen) return null;

  const showSectionHeaders = sectionGroups.length > 1;

  // ── Render ──
  return (
    <aside
      role="navigation"
      aria-label="Slides"
      className="flex h-full flex-col border-r border-border bg-background/70 backdrop-blur-sm md:max-lg:w-40 lg:w-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("pptx.sections.slides")}
        </span>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={t("pptx.sections.collapsePane")}
          onClick={onCollapse}
        >
          <LuPanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scrollable list */}
      <div
        ref={scrollContainerRef}
        className="flex-1 space-y-1 overflow-y-auto px-1.5 pb-2"
      >
        {sectionGroups.map((section, sectionIndex) => {
          const isCollapsed = collapsedSections[section.id] ?? false;

          return (
            <div key={section.id} className="space-y-1">
              {showSectionHeaders && (
                <SectionHeader
                  sectionId={section.id}
                  label={section.label}
                  slideCount={section.slideIndexes.length}
                  isCollapsed={isCollapsed}
                  isRenaming={renamingSectionId === section.id}
                  renameValue={renameValue}
                  canEdit={canEdit}
                  sectionIndex={sectionIndex}
                  totalSections={sectionGroups.length}
                  renameInputRef={renameInputRef}
                  onToggle={toggleSection}
                  onContextMenu={handleSectionContextMenu}
                  onStartRename={startRename}
                  onRenameValueChange={setRenameValue}
                  onCommitRename={commitRename}
                  onCancelRename={cancelRename}
                />
              )}

              {!isCollapsed &&
                section.slideIndexes.map((idx) => {
                  const slide = slides[idx];
                  if (!slide) return null;
                  return (
                    <SlideItem
                      key={slide.id ?? idx}
                      slide={slide}
                      slideIndex={idx}
                      isActive={idx === activeSlideIndex}
                      canvasSize={canvasSize}
                      canEdit={canEdit}
                      rehearsalTimings={rehearsalTimings}
                      onSelectSlide={onSelectSlide}
                      onSlideContextMenu={onSlideContextMenu}
                      onAddSection={onAddSection}
                      onOpenSlideCtxMenu={handleOpenSlideCtxMenu}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      slideRef={(el) => {
                        if (el) {
                          slideRefs.current.set(idx, el);
                        } else {
                          slideRefs.current.delete(idx);
                        }
                      }}
                    />
                  );
                })}
            </div>
          );
        })}
      </div>

      {/* Bottom buttons */}
      <div className="border-t border-border/60 px-3 py-2 space-y-1">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1 rounded bg-muted/80 px-2 py-1.5 text-xs text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canEdit}
          onClick={onAddSlide}
        >
          <LuPlus className="h-3.5 w-3.5" />
          {t("pptx.sections.addSlide")}
        </button>
        {canEdit && onAddSection && (
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1 rounded bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() =>
              onAddSection(t("pptx.sections.defaultName"), activeSlideIndex)
            }
          >
            <LuPlus className="h-3 w-3" />
            {t("pptx.sections.addSection")}
          </button>
        )}
      </div>

      {/* Context menus */}
      {sectionContextMenu && (
        <SectionContextMenu
          state={sectionContextMenu}
          sectionGroups={sectionGroups}
          totalSlides={slides.length}
          onStartRename={startRename}
          onDeleteSection={onDeleteSection}
          onMoveSectionUp={onMoveSectionUp}
          onMoveSectionDown={onMoveSectionDown}
          onAddSection={onAddSection}
          onClose={closeSectionContextMenu}
        />
      )}

      {slideCtxMenu && (
        <SlideContextMenu
          state={slideCtxMenu}
          onAddSection={onAddSection}
          onClose={closeSlideCtxMenu}
        />
      )}
    </aside>
  );
}
