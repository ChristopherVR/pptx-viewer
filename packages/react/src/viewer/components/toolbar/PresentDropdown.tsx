import React, { useState } from "react";
import {
  LuCaptions,
  LuCheck,
  LuChevronDown,
  LuClock,
  LuMonitor,
  LuPlay,
  LuRadio,
  LuSettings,
} from "react-icons/lu";
import { cn } from "../../utils";

export interface PresentDropdownProps {
  isActive: boolean;
  onPresent: () => void;
  onPresenterView?: () => void;
  onRehearse?: () => void;
  onSetUpSlideShow?: () => void;
  onBroadcast?: () => void;
  onToggleSubtitles?: () => void;
  showSubtitles?: boolean;
}

export function PresentDropdown({
  isActive,
  onPresent,
  onPresenterView,
  onRehearse,
  onSetUpSlideShow,
  onBroadcast,
  onToggleSubtitles,
  showSubtitles,
}: PresentDropdownProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <div className="inline-flex border-l border-border">
        <button
          type="button"
          onClick={onPresent}
          className={cn(
            "px-2 py-1 transition-colors",
            isActive
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent text-foreground",
          )}
          title="Present (fullscreen)"
        >
          Present
        </button>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "px-1 py-1 transition-colors border-l border-border",
            open
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent text-foreground",
          )}
          title="Presentation options"
          aria-label="Presentation options"
        >
          <LuChevronDown className="w-3 h-3" />
        </button>
      </div>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onPresent();
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
            >
              <LuPlay className="w-3.5 h-3.5 text-muted-foreground" />
              Present
            </button>
            {onPresenterView && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPresenterView();
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
              >
                <LuMonitor className="w-3.5 h-3.5 text-muted-foreground" />
                Presenter View
              </button>
            )}
            {onRehearse && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onRehearse();
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
              >
                <LuClock className="w-3.5 h-3.5 text-muted-foreground" />
                Rehearse Timings
              </button>
            )}
            {/* Slide Show settings divider */}
            <div className="my-1 border-t border-border/60" />
            {onSetUpSlideShow && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSetUpSlideShow();
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
              >
                <LuSettings className="w-3.5 h-3.5 text-muted-foreground" />
                Set Up Slide Show
              </button>
            )}
            {onBroadcast && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onBroadcast();
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
              >
                <LuRadio className="w-3.5 h-3.5 text-muted-foreground" />
                Present Online
              </button>
            )}
            {onToggleSubtitles && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onToggleSubtitles();
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
              >
                <LuCaptions className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="flex-1 text-left">Subtitles</span>
                {showSubtitles && <LuCheck className="w-3 h-3 text-primary" />}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
