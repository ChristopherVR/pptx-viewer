import React from "react";
import { cn } from "../../utils";
import { sep } from "./toolbar-constants";
import type { ToolbarProps } from "./toolbar-types";

export type CustomShowsControlsProps = Pick<
  ToolbarProps,
  | "customShows"
  | "activeCustomShowId"
  | "canEdit"
  | "isCurrentSlideInActiveShow"
  | "onSetActiveCustomShowId"
  | "onCreateCustomShow"
  | "onRenameActiveCustomShow"
  | "onDeleteActiveCustomShow"
  | "onToggleCurrentSlideInActiveShow"
>;

export function CustomShowsControls({
  customShows,
  activeCustomShowId,
  canEdit,
  isCurrentSlideInActiveShow,
  onSetActiveCustomShowId,
  onCreateCustomShow,
  onRenameActiveCustomShow,
  onDeleteActiveCustomShow,
  onToggleCurrentSlideInActiveShow,
}: CustomShowsControlsProps): React.ReactElement | null {
  if (customShows.length > 0) {
    return (
      <>
        {sep}
        <select
          value={activeCustomShowId ?? ""}
          onChange={(e) => onSetActiveCustomShowId(e.target.value || null)}
          className="h-6 px-1.5 text-[11px] rounded bg-muted text-foreground border border-border hover:bg-accent transition-colors cursor-pointer"
          title="Custom show"
          aria-label="Select custom show"
        >
          <option value="">All Slides</option>
          {customShows.map((cs) => (
            <option key={cs.id} value={cs.id}>
              {cs.name}
            </option>
          ))}
        </select>
        {canEdit && (
          <>
            <button
              type="button"
              onClick={onCreateCustomShow}
              className="px-2 py-1 rounded bg-muted hover:bg-accent text-[11px] transition-colors"
              title="Create custom show"
            >
              + Show
            </button>
            {activeCustomShowId && (
              <>
                <button
                  type="button"
                  onClick={onRenameActiveCustomShow}
                  className="px-2 py-1 rounded bg-muted hover:bg-accent text-[11px] transition-colors"
                  title="Rename active custom show"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={onDeleteActiveCustomShow}
                  className="px-2 py-1 rounded bg-red-700/80 hover:bg-red-600 text-[11px] transition-colors"
                  title="Delete active custom show"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={onToggleCurrentSlideInActiveShow}
                  className={cn(
                    "px-2 py-1 rounded text-[11px] transition-colors",
                    isCurrentSlideInActiveShow
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-accent",
                  )}
                  title="Include/exclude current slide in active custom show"
                >
                  {isCurrentSlideInActiveShow ? "In Show" : "Add Slide"}
                </button>
              </>
            )}
          </>
        )}
      </>
    );
  }

  if (canEdit) {
    return (
      <>
        {sep}
        <button
          type="button"
          onClick={onCreateCustomShow}
          className="px-2 py-1 rounded bg-muted hover:bg-accent text-[11px] transition-colors"
          title="Create custom show"
        >
          + Show
        </button>
      </>
    );
  }

  return null;
}
