import React from "react";
import { cn } from "../../utils";
import { MODES } from "./toolbar-constants";
import type { ToolbarProps } from "./toolbar-types";
import { PresentDropdown } from "./PresentDropdown";

export type ModeSwitcherProps = Pick<
  ToolbarProps,
  | "mode"
  | "onSetMode"
  | "onCloseMasterView"
  | "onToggleSlideSorter"
  | "onEnterPresenterView"
  | "onEnterRehearsalMode"
  | "onOpenSetUpSlideShow"
  | "onOpenBroadcastDialog"
  | "onToggleSubtitles"
  | "showSubtitles"
>;

export function ModeSwitcher({
  mode,
  onSetMode,
  onCloseMasterView,
  onToggleSlideSorter,
  onEnterPresenterView,
  onEnterRehearsalMode,
  onOpenSetUpSlideShow,
  onOpenBroadcastDialog,
  onToggleSubtitles,
  showSubtitles,
}: ModeSwitcherProps): React.ReactElement {
  if (mode === "master") {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-1 rounded bg-amber-600/90 text-[11px] text-amber-50">
          Slide Master View
        </span>
        <button
          type="button"
          onClick={onCloseMasterView}
          className="px-2.5 py-1 rounded bg-muted hover:bg-accent text-[11px] text-foreground transition-colors"
          title="Close master view"
        >
          Close Master View
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center rounded bg-muted text-[11px] overflow-hidden">
      {MODES.map((m) =>
        m === "present" ? (
          <PresentDropdown
            key={m}
            isActive={mode === m}
            onPresent={() => onSetMode(m)}
            onPresenterView={onEnterPresenterView}
            onRehearse={onEnterRehearsalMode}
            onSetUpSlideShow={onOpenSetUpSlideShow}
            onBroadcast={onOpenBroadcastDialog}
            onToggleSubtitles={onToggleSubtitles}
            showSubtitles={showSubtitles}
          />
        ) : (
          <button
            key={m}
            type="button"
            onClick={() => onSetMode(m)}
            className={cn(
              "px-2 py-1 transition-colors border-l border-border first:border-l-0",
              mode === m
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent text-foreground",
            )}
            title={`${m[0].toUpperCase()}${m.slice(1)} mode`}
          >
            {m[0].toUpperCase()}
            {m.slice(1)}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={onToggleSlideSorter}
        className="px-2 py-1 border-l border-border hover:bg-accent text-foreground transition-colors"
        title="Slide sorter"
      >
        Sorter
      </button>
    </div>
  );
}
