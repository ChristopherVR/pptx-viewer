import React, { useCallback } from "react";

import { LuCalendarDays, LuCheck, LuHash, LuText, LuX } from "react-icons/lu";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HeaderFooterPanelProps {
  showDateTime: boolean;
  showSlideNumber: boolean;
  showFooter: boolean;
  footerText: string;
  onSetShowDateTime: (show: boolean) => void;
  onSetShowSlideNumber: (show: boolean) => void;
  onSetShowFooter: (show: boolean) => void;
  onSetFooterText: (text: string) => void;
  onApplyToAll: () => void;
  onApplyToCurrent: () => void;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface ToggleRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ReactNode;
  label: string;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  checked,
  onChange,
  icon,
  label,
}) => (
  <label className="flex items-center gap-2.5 cursor-pointer group select-none">
    <span className="relative flex items-center justify-center w-4 h-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded border border-border bg-muted transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50" />
      {checked && <LuCheck className="relative z-10 w-3 h-3 text-white" />}
    </span>
    <span className="flex items-center gap-1.5 text-xs text-foreground group-hover:text-foreground transition-colors">
      {icon}
      {label}
    </span>
  </label>
);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const HeaderFooterPanel: React.FC<HeaderFooterPanelProps> = ({
  showDateTime,
  showSlideNumber,
  showFooter,
  footerText,
  onSetShowDateTime,
  onSetShowSlideNumber,
  onSetShowFooter,
  onSetFooterText,
  onApplyToAll,
  onApplyToCurrent,
  onClose,
}) => {
  const handleFooterTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSetFooterText(e.target.value);
    },
    [onSetFooterText],
  );

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg border border-border bg-background shadow-2xl">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            Header &amp; Footer
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <LuX className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="space-y-4 px-4 py-4">
          {/* Toggle: Date/Time */}
          <ToggleRow
            checked={showDateTime}
            onChange={onSetShowDateTime}
            icon={<LuCalendarDays className="w-3.5 h-3.5" />}
            label="Date and time"
          />

          {/* Toggle: Slide number */}
          <ToggleRow
            checked={showSlideNumber}
            onChange={onSetShowSlideNumber}
            icon={<LuHash className="w-3.5 h-3.5" />}
            label="Slide number"
          />

          {/* Toggle: Footer */}
          <ToggleRow
            checked={showFooter}
            onChange={onSetShowFooter}
            icon={<LuText className="w-3.5 h-3.5" />}
            label="Footer"
          />

          {/* Footer text input — only visible when footer is enabled */}
          {showFooter && (
            <div className="pl-6">
              <input
                type="text"
                value={footerText}
                onChange={handleFooterTextChange}
                placeholder="Enter footer text…"
                className="w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onApplyToAll}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/80 transition-colors"
          >
            Apply to All
          </button>
          <button
            type="button"
            onClick={onApplyToCurrent}
            className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/80 transition-colors"
          >
            Apply to Current
          </button>
        </div>
      </div>
    </div>
  );
};
