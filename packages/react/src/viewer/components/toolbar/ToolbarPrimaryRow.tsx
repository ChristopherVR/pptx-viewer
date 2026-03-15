import React from "react";
import {
  LuPanelLeft,
  LuPanelRight,
  LuRedo,
  LuSearch,
  LuUndo,
  LuZoomIn,
  LuZoomOut,
} from "react-icons/lu";
import { cn } from "../../utils";
import { gB, gL, grp, ic, ics, sep } from "./toolbar-constants";
import type { ToolbarProps } from "./toolbar-types";
import { OverflowMenu } from "./OverflowMenu";
import { ModeSwitcher } from "./ModeSwitcher";
import { CustomShowsControls } from "./CustomShowsControls";

export function ToolbarPrimaryRow(p: ToolbarProps): React.ReactElement {
  const {
    mode,
    canEdit,
    isNarrowViewport,
    isSidebarCollapsed,
    isInspectorPaneOpen,
    isCompactToolbarOpen,
    scale,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    findReplaceOpen,
    onToggleSidebar,
    onToggleInspector,
    onToggleCompactToolbar,
    onZoomIn,
    onZoomOut,
    onZoomToFit,
    onUndo,
    onRedo,
    onToggleFindReplace,
  } = p;

  return (
    <div className="flex items-center gap-1.5 max-md:gap-0.5 flex-wrap">
      {mode !== "present" && (
        <button
          type="button"
          onClick={onToggleSidebar}
          className={cn(
            "p-1.5 max-md:p-2.5 max-md:min-h-[44px] max-md:min-w-[44px] rounded transition-colors",
            !isSidebarCollapsed
              ? "bg-primary/80 text-primary-foreground"
              : "bg-muted hover:bg-accent",
          )}
          title="Toggle slides panel"
          aria-label="Toggle slides panel"
        >
          <LuPanelLeft className={ic} />
        </button>
      )}
      {sep}
      <button
        onClick={onZoomOut}
        className="p-1.5 max-md:p-2.5 max-md:min-h-[44px] max-md:min-w-[44px] rounded bg-muted hover:bg-accent transition-colors"
        title="Zoom out"
        aria-label="Zoom out"
      >
        <LuZoomOut className={ics} />
      </button>
      <button
        onClick={onZoomToFit}
        className="px-1.5 py-1 max-md:min-h-[44px] rounded bg-muted hover:bg-accent text-[11px] text-muted-foreground tabular-nums min-w-[3rem] text-center transition-colors"
        title="Zoom to fit"
      >
        {Math.round(scale * 100)}%
      </button>
      <button
        onClick={onZoomIn}
        className="p-1.5 max-md:p-2.5 max-md:min-h-[44px] max-md:min-w-[44px] rounded bg-muted hover:bg-accent transition-colors"
        title="Zoom in"
        aria-label="Zoom in"
      >
        <LuZoomIn className={ics} />
      </button>
      {sep}
      <div className={grp}>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canEdit || !canUndo}
          className={gB}
          title={undoLabel ? `Undo: ${undoLabel}` : "Undo"}
          aria-label="Undo"
        >
          <LuUndo className={ics} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canEdit || !canRedo}
          className={gL}
          title={redoLabel ? `Redo: ${redoLabel}` : "Redo"}
          aria-label="Redo"
        >
          <LuRedo className={ics} />
        </button>
      </div>
      {/* Hide Find & Replace on mobile to save space — available via overflow menu */}
      {(mode === "edit" || mode === "master") && (
        <button
          type="button"
          onClick={onToggleFindReplace}
          className={cn(
            "p-1.5 max-md:p-2.5 max-md:min-h-[44px] max-md:min-w-[44px] rounded transition-colors max-md:hidden",
            findReplaceOpen
              ? "bg-primary/80 text-primary-foreground"
              : "bg-muted hover:bg-accent",
          )}
          title="Find & Replace"
          aria-label="Find and Replace"
        >
          <LuSearch className={ics} />
        </button>
      )}
      <div className="flex-1 min-w-2 max-md:min-w-1" />
      <ModeSwitcher
        mode={p.mode}
        onSetMode={p.onSetMode}
        onCloseMasterView={p.onCloseMasterView}
        onToggleSlideSorter={p.onToggleSlideSorter}
        onEnterPresenterView={p.onEnterPresenterView}
        onEnterRehearsalMode={p.onEnterRehearsalMode}
        onOpenSetUpSlideShow={p.onOpenSetUpSlideShow}
        onOpenBroadcastDialog={p.onOpenBroadcastDialog}
        onToggleSubtitles={p.onToggleSubtitles}
        showSubtitles={p.showSubtitles}
      />
      <CustomShowsControls
        customShows={p.customShows}
        activeCustomShowId={p.activeCustomShowId}
        canEdit={p.canEdit}
        isCurrentSlideInActiveShow={p.isCurrentSlideInActiveShow}
        onSetActiveCustomShowId={p.onSetActiveCustomShowId}
        onCreateCustomShow={p.onCreateCustomShow}
        onRenameActiveCustomShow={p.onRenameActiveCustomShow}
        onDeleteActiveCustomShow={p.onDeleteActiveCustomShow}
        onToggleCurrentSlideInActiveShow={p.onToggleCurrentSlideInActiveShow}
      />
      {sep}
      {(mode === "edit" || mode === "master") && (
        <button
          type="button"
          onClick={onToggleInspector}
          className={cn(
            "p-1.5 max-md:p-2.5 max-md:min-h-[44px] max-md:min-w-[44px] rounded transition-colors",
            isInspectorPaneOpen
              ? "bg-primary/80 text-primary-foreground"
              : "bg-muted hover:bg-accent",
          )}
          title="Toggle inspector panel"
          aria-label="Toggle inspector panel"
        >
          <LuPanelRight className={ic} />
        </button>
      )}
      {!canEdit && (
        <span className="inline-flex items-center px-2 py-1 rounded bg-amber-600/90 text-[11px] text-amber-50">
          Read-only
        </span>
      )}
      <OverflowMenu {...p} />
      {isNarrowViewport && (mode === "edit" || mode === "master") && (
        <button
          type="button"
          onClick={onToggleCompactToolbar}
          className={cn(
            "p-1.5 rounded text-[11px] transition-colors",
            isCompactToolbarOpen
              ? "bg-primary/80 text-primary-foreground"
              : "bg-muted hover:bg-accent",
          )}
          title="Toggle editing tools"
        >
          {isCompactToolbarOpen ? "Less" : "Tools"}
        </button>
      )}
    </div>
  );
}
