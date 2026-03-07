import React from "react";

import { SHORTCUT_REFERENCE_ITEMS } from "../constants";

interface ShortcutPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutPanel({
  isOpen,
  onClose,
}: ShortcutPanelProps): React.ReactElement | null {
  if (!isOpen) return null;

  return (
    <div
      data-pptx-shortcuts-panel="true"
      className="absolute top-14 right-3 z-40 w-[min(24rem,calc(100%-1.5rem))] rounded border border-border bg-popover shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-foreground">
          Keyboard shortcuts
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-[11px] text-foreground hover:bg-muted hover:text-foreground"
        >
          Close
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto p-2 space-y-1">
        {SHORTCUT_REFERENCE_ITEMS.map((shortcut) => (
          <div
            key={shortcut.action}
            className="flex items-center justify-between gap-3 rounded bg-muted/80 px-2 py-1.5"
          >
            <span className="text-xs text-foreground">{shortcut.action}</span>
            <span className="font-mono text-[11px] text-foreground whitespace-nowrap">
              {shortcut.shortcut}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
